import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, Modal, StatusMessage } from '../components/Ui'
import { fetchUpboPeople, fetchUpboResults } from '../lib/data'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { UpboPerson, UpboResult } from '../types'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../lib/soop'

function Avatar({ person, large = false }: { person: UpboPerson; large?: boolean }) {
  return <div className={`upbo-avatar ${large ? 'large' : ''}`}>
    <img src={person.profile_image_url || primarySoopProfileUrl(person.soop_id)} alt={`${person.soop_name} 프로필`} onError={e => { void advanceSoopProfileImage(e.currentTarget, person.soop_id) }} />
    <span className="upbo-avatar-fallback">{person.soop_name.slice(0, 1)}</span>
  </div>
}

export default function WorkPage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [query, setQuery] = useState('')
  const [resultType, setResultType] = useState('전체 업보')
  const [status, setStatus] = useState('전체 상태')
  const [sort, setSort] = useState<'quantity' | 'name' | 'default'>('quantity')
  const [selected, setSelected] = useState<UpboPerson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchUpboPeople(), fetchUpboResults()])
      .then(([p, r]) => { setPeople(p); setResults(r) })
      .catch(e => setError(e instanceof Error ? e.message : '업보 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const resultMap = useMemo(() => {
    const map = new Map<string, UpboResult[]>()
    results.forEach(result => map.set(result.person_id, [...(map.get(result.person_id) || []), result]))
    return map
  }, [results])

  const resultTypes = useMemo(() => ['전체 업보', ...Array.from(new Set(results.map(item => item.result_label).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))], [results])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = people.filter(person => {
      const personResults = resultMap.get(person.id) || []
      const quantity = personResults.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      const queryOk = !q || person.soop_name.toLowerCase().includes(q) || person.soop_id.toLowerCase().includes(q)
      const typeOk = resultType === '전체 업보' || personResults.some(item => item.result_label === resultType)
      const statusOk = status === '전체 상태' || (status === '업보 있음' ? quantity > 0 : quantity === 0)
      return queryOk && typeOk && statusOk
    })
    if (sort === 'name') return [...rows].sort((a, b) => a.soop_name.localeCompare(b.soop_name, 'ko'))
    if (sort === 'quantity') return [...rows].sort((a, b) => {
      const aq = (resultMap.get(a.id) || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      const bq = (resultMap.get(b.id) || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      return bq - aq || a.sort_order - b.sort_order
    })
    return [...rows].sort((a, b) => a.sort_order - b.sort_order)
  }, [people, query, resultType, status, sort, resultMap])

  const selectedResults = selected ? (resultMap.get(selected.id) || []) : []

  return <div className="diary-page upbo-diary-page">
    <div className="diary-page-heading"><div><h1>{t('upbo_title', '업보 현황')}</h1><small>{t('upbo_label', 'UPBO')}</small></div></div>
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="upbo-filter-bar">
      <label className="diary-search"><AppIcon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('upbo_search_placeholder', 'SOOP 이름 또는 아이디 검색')} aria-label="업보 검색" /></label>
      <select value={resultType} onChange={e => setResultType(e.target.value)}>{resultTypes.map(item => <option key={item}>{item}</option>)}</select>
      <select value={status} onChange={e => setStatus(e.target.value)}><option>전체 상태</option><option>업보 있음</option><option>업보 없음</option></select>
      <select value={sort} onChange={e => setSort(e.target.value as 'quantity' | 'name' | 'default')}><option value="quantity">업보 많은 순</option><option value="name">이름순</option><option value="default">등록순</option></select>
    </section>

    {loading ? <LoadingBlocks /> : filtered.length ? <section className="upbo-card-grid">
      {filtered.map(person => {
        const personResults = resultMap.get(person.id) || []
        const quantity = personResults.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        return <button className="upbo-person-card" type="button" key={person.id} onClick={() => setSelected(person)}>
          <Avatar person={person} />
          <strong>{person.soop_name}</strong>
          <span>@{person.soop_id}</span>
          <em>업보 {quantity}</em>
        </button>
      })}
    </section> : <EmptyState>{t('upbo_empty', '검색 조건에 맞는 시청자가 없습니다.')}</EmptyState>}

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="업보 상세">
      {selected && <div className="upbo-detail">
        <div className="upbo-detail-person"><Avatar person={selected} large /><div><h2>{selected.soop_name}</h2><a href={`https://www.sooplive.com/station/${encodeURIComponent(selected.soop_id)}`} target="_blank" rel="noopener noreferrer">@{selected.soop_id} <AppIcon name="external" /></a>{selected.note && <p>{selected.note}</p>}</div></div>
        <div className="upbo-results upbo-detail-results">{selectedResults.length ? selectedResults.map(item => <div className="upbo-result" key={item.id}><span>{item.result_label}</span><strong>× {item.quantity}</strong>{item.note && <small>{item.note}</small>}</div>) : <div className="upbo-result-empty">{t('upbo_no_result', '등록된 룰렛 결과가 없습니다.')}</div>}</div>
      </div>}
    </Modal>
  </div>
}
