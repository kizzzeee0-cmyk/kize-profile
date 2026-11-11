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

export default function WorkPage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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


  const resultMap = useMemo(() => {
    const map = new Map<string, UpboResult[]>()
    results.forEach(result => map.set(result.person_id, [...(map.get(result.person_id) || []), result]))
    return map
  }, [results])

  const viewerRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return people
      .map(person => {
        const personResults = (resultMap.get(person.id) || []).filter(item => Number(item.quantity || 0) > 0)
        const total = personResults.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        return { person, results: personResults, total }
      })
      .filter(row => row.total > 0)
      .filter(row => !q || row.person.soop_name.toLocaleLowerCase().includes(q) || row.person.soop_id.toLocaleLowerCase().includes(q))
      .sort((a, b) => b.total - a.total || a.person.sort_order - b.person.sort_order)
  }, [people, resultMap, query])

  const updatedLabel = formatUpboUpdatedDate(lastUpdatedAt)

  return <div className="diary-page upbo-diary-page">
    <div className="diary-page-heading upbo-page-heading">
      <div><h1>{t('upbo_title', '업보 현황')}</h1><small>{t('upbo_label', 'UPBO')}</small></div>
      {updatedLabel && <div className="upbo-last-updated"><span>마지막 업데이트</span><strong>{updatedLabel}</strong></div>}
    </div>

    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="upbo-filter-bar compact public-search-only">
      <label className="diary-search">
        <AppIcon name="search" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="시청자 이름 또는 SOOP 아이디 검색"
          aria-label="시청자 이름 또는 SOOP 아이디 검색"
        />
      </label>
    </section>

    {loading
      ? <LoadingBlocks />
      : viewerRows.length
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
        : <EmptyState>검색 조건에 맞는 미처리 업보가 없습니다.</EmptyState>}
  </div>
}
