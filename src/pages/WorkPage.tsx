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
  const [selected, setSelected] = useState<UpboPerson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchUpboPeople(), fetchUpboResults()])
      .then(([p, r]) => { setPeople(p); setResults(r) })
      .catch(e => setError(e instanceof Error ? e.message : '업보 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter(person => person.soop_name.toLowerCase().includes(q) || person.soop_id.toLowerCase().includes(q))
  }, [people, query])

  const resultMap = useMemo(() => {
    const map = new Map<string, UpboResult[]>()
    results.forEach(result => map.set(result.person_id, [...(map.get(result.person_id) || []), result]))
    return map
  }, [results])
  const selectedResults = selected ? (resultMap.get(selected.id) || []) : []
  const totalQuantity = results.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  return <div className="diary-page upbo-diary-page">
    <div className="diary-page-heading"><div><h1>{t('upbo_title', '업보 현황')}</h1><small>{t('upbo_label', 'UPBO')}</small></div></div>
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <label className="diary-search upbo-diary-search"><AppIcon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('upbo_search_placeholder', 'SOOP 이름 또는 아이디 검색')} aria-label="업보 검색" /></label>

    <section className="diary-card upbo-summary-panel">
      <div className="upbo-summary-heading"><span className="diary-title-icon"><AppIcon name="upbo" /></span><div><h2>내 업보</h2><small>등록된 업보 데이터 요약</small></div></div>
      <div className="upbo-number-grid">
        <div><span>등록 시청자</span><strong>{people.length}</strong><small>명</small></div>
        <div><span>룰렛 결과</span><strong>{results.length}</strong><small>개</small></div>
        <div><span>총 수량</span><strong>{totalQuantity}</strong><small>개</small></div>
      </div>
    </section>

    <section className="diary-card upbo-list-card">
      {loading ? <LoadingBlocks /> : filtered.length ? <div className="upbo-diary-list">
        {filtered.map(person => {
          const personResults = resultMap.get(person.id) || []
          const quantity = personResults.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
          return <button type="button" key={person.id} onClick={() => setSelected(person)}>
            <Avatar person={person} /><div><strong>{person.soop_name}</strong><span>@{person.soop_id}</span></div><em>{personResults.length}종 · {quantity}개</em><AppIcon name="chevron-right" />
          </button>
        })}
      </div> : <EmptyState>{t('upbo_empty', '검색 조건에 맞는 시청자가 없습니다.')}</EmptyState>}
    </section>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="업보 상세">
      {selected && <div className="upbo-detail">
        <div className="upbo-detail-person"><Avatar person={selected} large /><div><h2>{selected.soop_name}</h2><a href={`https://www.sooplive.com/station/${encodeURIComponent(selected.soop_id)}`} target="_blank" rel="noopener noreferrer">@{selected.soop_id} <AppIcon name="external" /></a>{selected.note && <p>{selected.note}</p>}</div></div>
        <div className="upbo-results upbo-detail-results">{selectedResults.length ? selectedResults.map(item => <div className="upbo-result" key={item.id}><span>{item.result_label}</span><strong>× {item.quantity}</strong>{item.note && <small>{item.note}</small>}</div>) : <div className="upbo-result-empty">{t('upbo_no_result', '등록된 룰렛 결과가 없습니다.')}</div>}</div>
      </div>}
    </Modal>
  </div>
}
