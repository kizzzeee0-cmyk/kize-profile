import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, StatusMessage } from '../components/Ui'
import { fetchSongs } from '../lib/data'
import type { SongItem } from '../types'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'

const PAGE_SIZE = 12

export default function SongbookPage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [songs, setSongs] = useState<SongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('전체')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchSongs().then(setSongs).catch(e => setError(e instanceof Error ? e.message : '노래책을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])

  const genres = useMemo(() => ['전체', ...Array.from(new Set<string>(songs.map(song => song.genre).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))], [songs])
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return songs.filter(song => {
      const genreOk = genre === '전체' || song.genre === genre
      const searchOk = !q || [song.title, song.artist, song.genre, song.song_key || '', song.note || ''].some(value => value.toLocaleLowerCase().includes(q))
      return genreOk && searchOk
    })
  }, [songs, query, genre])

  useEffect(() => { setPage(1) }, [query, genre])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleSongs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return <div className="diary-page songbook-diary-page">
    <div className="diary-page-heading"><div><h1>{t('songbook_title', '노래책')}</h1><small>{t('songbook_label', 'SONGBOOK')}</small></div></div>
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="diary-card songbook-diary-card">
      <label className="diary-search"><AppIcon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('songbook_search_placeholder', '제목, 가수 또는 장르 검색')} aria-label="노래 검색" /></label>
      <div className="diary-filter-tabs">{genres.map(item => <button key={item} type="button" className={genre === item ? 'active' : ''} onClick={() => setGenre(item)}>{item}</button>)}</div>

      {loading ? <LoadingBlocks /> : visibleSongs.length ? <div className="songbook-table">
        <div className="songbook-table-head"><span>곡 제목</span><span>가수</span><span>장르</span><span>키 / 메모</span></div>
        {visibleSongs.map(song => <article className="songbook-table-row" key={song.id}>
          <strong>{song.title}</strong><span>{song.artist}</span><em>{song.genre}</em><small>{[song.song_key ? `KEY ${song.song_key}` : '', song.note || ''].filter(Boolean).join(' · ') || '-'}</small>
        </article>)}
      </div> : <EmptyState>{t('songbook_empty', '조건에 맞는 노래가 없습니다.')}</EmptyState>}

      {pageCount > 1 && <div className="diary-pagination">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(v => Math.max(1, v - 1))}><AppIcon name="chevron-left" /></button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(num => <button key={num} type="button" className={num === currentPage ? 'active' : ''} onClick={() => setPage(num)}>{num}</button>)}
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}><AppIcon name="chevron-right" /></button>
      </div>}
    </section>
  </div>
}
