import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, StatusMessage } from '../components/Ui'
import { fetchUpboPeople, fetchUpboResults, fetchUpboUpdatedAt } from '../lib/data'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { UpboPerson, UpboResult } from '../types'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../lib/soop'

function formatUpboUpdatedDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const pick = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${pick('year')}.${pick('month')}.${pick('day')}`
}

function Avatar({ person }: { person: UpboPerson }) {
  return <div className="upbo-avatar reference">
    <img
      src={person.profile_image_url || primarySoopProfileUrl(person.soop_id)}
      alt=""
      onError={e => { void advanceSoopProfileImage(e.currentTarget, person.soop_id) }}
    />
    <span className="upbo-avatar-fallback">{person.soop_name.slice(0, 1)}</span>
  </div>
}

function timeValue(...values: Array<string | undefined | null>) {
  return Math.max(0, ...values.map(value => value ? new Date(value).getTime() || 0 : 0))
}

export default function WorkPage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [view, setView] = useState<'viewer' | 'item'>('viewer')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'quantity' | 'name' | 'recent'>('quantity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchUpboPeople(), fetchUpboResults(), fetchUpboUpdatedAt()])
      .then(([p, r, updatedAt]) => {
        setPeople(p)
        setResults(r.filter(item => Number(item.quantity || 0) > 0))
        setLastUpdatedAt(updatedAt)
      })
      .catch(e => setError(e instanceof Error ? e.message : '업보 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const personMap = useMemo(() => new Map(people.map(person => [person.id, person])), [people])

  const resultMap = useMemo(() => {
    const map = new Map<string, UpboResult[]>()
    results.forEach(result => map.set(result.person_id, [...(map.get(result.person_id) || []), result]))
    return map
  }, [results])

  const viewerRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const rows = people
      .map(person => {
        const personResults = (resultMap.get(person.id) || []).filter(item => Number(item.quantity || 0) > 0)
        const total = personResults.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        const recent = Math.max(timeValue(person.updated_at, person.created_at), ...personResults.map(item => timeValue(item.updated_at, item.created_at)))
        return { person, results: personResults, total, recent }
      })
      .filter(row => row.total > 0)
      .filter(row => !q || row.person.soop_name.toLocaleLowerCase().includes(q) || row.person.soop_id.toLocaleLowerCase().includes(q))

    if (sort === 'name') return rows.sort((a, b) => a.person.soop_name.localeCompare(b.person.soop_name, 'ko'))
    if (sort === 'recent') return rows.sort((a, b) => b.recent - a.recent)
    return rows.sort((a, b) => b.total - a.total || a.person.sort_order - b.person.sort_order)
  }, [people, resultMap, query, sort])

  const itemRows = useMemo(() => {
    const byItem = new Map<string, { label: string; total: number; recent: number; viewers: Array<{ person: UpboPerson; quantity: number }> }>()
    results.forEach(result => {
      const quantity = Number(result.quantity || 0)
      const person = personMap.get(result.person_id)
      if (!person || quantity <= 0) return
      const label = String(result.result_label || '업보')
      const current = byItem.get(label) || { label, total: 0, recent: 0, viewers: [] }
      current.total += quantity
      current.recent = Math.max(current.recent, timeValue(result.updated_at, result.created_at))
      const viewer = current.viewers.find(row => row.person.id === person.id)
      if (viewer) viewer.quantity += quantity
      else current.viewers.push({ person, quantity })
      byItem.set(label, current)
    })

    const q = query.trim().toLocaleLowerCase()
    const rows = [...byItem.values()].filter(row => !q || row.label.toLocaleLowerCase().includes(q))
    rows.forEach(row => row.viewers.sort((a, b) => b.quantity - a.quantity || a.person.soop_name.localeCompare(b.person.soop_name, 'ko')))
    if (sort === 'name') return rows.sort((a, b) => a.label.localeCompare(b.label, 'ko'))
    if (sort === 'recent') return rows.sort((a, b) => b.recent - a.recent)
    return rows.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'ko'))
  }, [results, personMap, query, sort])

  const pendingTotal = useMemo(() => results.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0), [results])
  const activeViewerCount = useMemo(() => new Set(results.filter(item => Number(item.quantity || 0) > 0).map(item => item.person_id)).size, [results])
  const updatedLabel = formatUpboUpdatedDate(lastUpdatedAt)

  return <div className="diary-page upbo-diary-page">
    <div className="diary-page-heading upbo-page-heading">
      <div><h1>{t('upbo_title', '업보 현황')}</h1><small>{t('upbo_label', 'UPBO')}</small></div>
      {updatedLabel && <div className="upbo-last-updated"><span>마지막 업데이트</span><strong>{updatedLabel}</strong></div>}
    </div>

    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="upbo-summary-strip" aria-label="업보 요약">
      <div><span>미처리 총수량</span><strong>{pendingTotal}</strong></div>
      <div><span>시청자</span><strong>{activeViewerCount}명</strong></div>
    </section>

    <div className="upbo-view-tabs" role="tablist" aria-label="업보 보기 방식">
      <button type="button" className={view === 'viewer' ? 'active' : ''} onClick={() => { setView('viewer'); setQuery('') }}>시청자별</button>
      <button type="button" className={view === 'item' ? 'active' : ''} onClick={() => { setView('item'); setQuery('') }}>항목별</button>
    </div>

    <section className="upbo-filter-bar compact">
      <label className="diary-search">
        <AppIcon name="search" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={view === 'viewer' ? '시청자 이름 또는 SOOP 아이디 검색' : '업보 항목명 검색'}
          aria-label="업보 검색"
        />
      </label>
      <select value={sort} onChange={e => setSort(e.target.value as 'quantity' | 'name' | 'recent')}>
        <option value="quantity">미처리 수량순</option>
        <option value="name">이름순</option>
        <option value="recent">최근 등록순</option>
      </select>
    </section>

    {loading
      ? <LoadingBlocks />
      : view === 'viewer'
        ? viewerRows.length
          ? <section className="upbo-reference-grid">
            {viewerRows.map(row => <details className="upbo-reference-card" key={row.person.id}>
              <summary>
                <Avatar person={row.person} />
                <strong>{row.person.soop_name}</strong>
                <small>@{row.person.soop_id}</small>
                <em>업보 {row.total}</em>
              </summary>
              <div className="upbo-reference-card-items">
                {row.results
                  .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0) || a.result_label.localeCompare(b.result_label, 'ko'))
                  .map(item => <div key={item.id}><span>{item.result_label}</span><strong>× {item.quantity}</strong></div>)}
              </div>
            </details>)}
          </section>
          : <EmptyState>검색 조건에 맞는 미처리 업보가 없습니다.</EmptyState>
        : itemRows.length
          ? <section className="upbo-overview-list item-list">
            {itemRows.map(row => <details className="upbo-overview-row" key={row.label}>
              <summary>
                <div className="upbo-overview-item-name"><strong>{row.label}</strong><small>{row.viewers.length}명</small></div>
                <span className="upbo-total-pill">총 {row.total}개</span>
                <AppIcon name="chevron-right" />
              </summary>
              <div className="upbo-overview-items">
                {row.viewers.map(viewer => <div key={viewer.person.id}>
                  <span>{viewer.person.soop_name} <small>@{viewer.person.soop_id}</small></span>
                  <strong>× {viewer.quantity}</strong>
                </div>)}
              </div>
            </details>)}
          </section>
          : <EmptyState>검색 조건에 맞는 미처리 업보가 없습니다.</EmptyState>}
  </div>
}
