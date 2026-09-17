import { useEffect, useMemo, useState } from 'react'
import { EmptyState, LoadingBlocks, Modal, SectionHeading, StatusMessage } from '../components/Ui'
import { fetchUpboPeople, fetchUpboResults } from '../lib/data'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { UpboPerson, UpboResult } from '../types'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../lib/soop'

function Avatar({ person, large = false }: { person: UpboPerson; large?: boolean }) {
  return <div className={`upbo-avatar ${large ? 'large' : ''}`}>
    <img
      src={person.profile_image_url || primarySoopProfileUrl(person.soop_id)}
      alt={`${person.soop_name} 프로필`}
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

  return <section className="section-pad page-top upbo-page">
    <div className="container upbo-container">
      <SectionHeading eyebrow={t('upbo_label', 'UPBO')} title={t('upbo_title', '업보 현황')} />
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <label className="upbo-search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('upbo_search_placeholder', 'SOOP 이름 또는 아이디 검색')} aria-label="업보 검색" /></label>

      {loading ? <LoadingBlocks /> : filtered.length ? <div className="upbo-list upbo-summary-list">
        {filtered.map(person => <button className="upbo-summary-card" type="button" key={person.id} onClick={() => setSelected(person)}>
          <Avatar person={person} />
          <div className="upbo-summary-copy"><h3>{person.soop_name}</h3><span>@{person.soop_id}</span></div>
        </button>)}
      </div> : <EmptyState>{t('upbo_empty', '검색 조건에 맞는 시청자가 없습니다.')}</EmptyState>}
    </div>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="룰렛 결과">
      {selected && <div className="upbo-detail">
        <div className="upbo-detail-person">
          <Avatar person={selected} large />
          <div>
            <h2>{selected.soop_name}</h2>
            <a href={`https://www.sooplive.com/station/${encodeURIComponent(selected.soop_id)}`} target="_blank" rel="noopener noreferrer">@{selected.soop_id} ↗</a>
            {selected.note && <p>{selected.note}</p>}
          </div>
        </div>
        <div className="upbo-results upbo-detail-results">
          {selectedResults.length ? selectedResults.map(item => <div className="upbo-result" key={item.id}><span>{item.result_label}</span><strong>× {item.quantity}</strong>{item.note && <small>{item.note}</small>}</div>) : <div className="upbo-result-empty">{t('upbo_no_result', '등록된 룰렛 결과가 없습니다.')}</div>}
        </div>
      </div>}
    </Modal>
  </section>
}
