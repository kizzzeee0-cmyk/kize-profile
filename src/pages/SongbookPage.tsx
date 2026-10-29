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
  const [status, setStatus] = useState('전체 상태')
  const [sort, setSort] = useState<'default' | 'title' | 'artist'>('default')
  const [view, setView] = useState<'card' | 'list'>('card')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchSongs().then(setSongs).catch(e => setError(e instanceof Error ? e.message : '노래책을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])

  const genres = useMemo(() => ['전체', ...Array.from(new Set<string>(songs.map(song => song.genre).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))], [songs])
  const statuses = useMemo(() => {
    const values = Array.from(new Set(songs.map(song => String(song.status || song.note || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))
    return ['전체 상태', ...values, '상태 없음']
  }, [songs])

  const genreCounts = useMemo(() => new Map(genres.map(item => [item, item === '전체' ? songs.length : songs.filter(song => song.genre === item).length])), [genres, songs])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const result = songs.filter(song => {
      const songStatus = String(song.status || song.note || '').trim()
      const genreOk = genre === '전체' || song.genre === genre
      const statusOk = status === '전체 상태' || (status === '상태 없음' ? !songStatus : songStatus === status)
      const searchOk = !q || [song.title, song.artist, song.genre, song.song_key || '', songStatus].some(value => value.toLocaleLowerCase().includes(q))
      return genreOk && statusOk && searchOk
    })
    if (sort === 'title') return [...result].sort((a, b) => a.title.localeCompare(b.title, 'ko'))
    if (sort === 'artist') return [...result].sort((a, b) => a.artist.localeCompare(b.artist, 'ko') || a.title.localeCompare(b.title, 'ko'))
    return [...result].sort((a, b) => a.sort_order - b.sort_order)
  }, [songs, query, genre, status, sort])

  useEffect(() => { setPage(1) }, [query, genre, status, sort, view])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleSongs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return <div className="diary-page songbook-diary-page">
    <div className="diary-page-heading"><div><h1>{t('songbook_title', '노래책')}</h1><small>{t('songbook_label', 'SONGBOOK')}</small></div></div>
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <section className="songbook-browser">
      <aside className="songbook-filter-panel">
        <label className="diary-search"><AppIcon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목 또는 가수명" aria-label="노래 검색" /></label>
        <div className="songbook-filter-block">
          <strong>장르</strong>
          <div className="songbook-genre-list">{genres.map(item => <button key={item} type="button" className={genre === item ? 'active' : ''} onClick={() => setGenre(item)}>
            <span>{item}</span><em>{genreCounts.get(item) || 0}</em>
          </button>)}</div>
        </div>
        <div className="songbook-filter-block">
          <strong>상태</strong>
          <select value={status} onChange={e => setStatus(e.target.value)}>{statuses.map(item => <option key={item}>{item}</option>)}</select>
        </div>
      </aside>

      <div className="songbook-results-panel">
        <div className="songbook-results-toolbar">
          <strong>총 {filtered.length}곡</strong>
          <div>
            <select value={sort} onChange={e => setSort(e.target.value as 'default' | 'title' | 'artist')} aria-label="정렬">
              <option value="default">기본순</option><option value="title">제목순</option><option value="artist">가수순</option>
            </select>
            <div className="songbook-view-toggle">
              <button type="button" className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>카드</button>
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>목록</button>
            </div>
          </div>
        </div>

        {loading ? <LoadingBlocks /> : visibleSongs.length ? view === 'card' ? <div className="songbook-card-grid">
          {visibleSongs.map(song => {
            const songStatus = String(song.status || song.note || '').trim()
            return <article className="songbook-song-card" key={song.id}>
              <div className="songbook-album">{song.image_url ? <img src={song.image_url} alt="" loading="lazy" /> : <div><AppIcon name="music" /><span>{song.title}</span></div>}</div>
              <div className="songbook-song-copy"><strong>{song.title}</strong><span>{song.artist}</span><div><em>{song.genre}</em>{song.song_key && <small>KEY {song.song_key}</small>}{songStatus && <small className="cream">{songStatus}</small>}</div></div>
            </article>
          })}
        </div> : <div className="songbook-table">
          <div className="songbook-table-head"><span>곡 제목</span><span>가수</span><span>장르</span><span>상태 / 키</span></div>
          {visibleSongs.map(song => <article className="songbook-table-row" key={song.id}>
            <strong>{song.title}</strong><span>{song.artist}</span><em>{song.genre}</em><small>{[song.status || song.note || '', song.song_key ? `KEY ${song.song_key}` : ''].filter(Boolean).join(' · ') || '-'}</small>
          </article>)}
        </div> : <EmptyState>{t('songbook_empty', '조건에 맞는 노래가 없습니다.')}</EmptyState>}

        {pageCount > 1 && <div className="diary-pagination">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(v => Math.max(1, v - 1))}><AppIcon name="chevron-left" /></button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(num => <button key={num} type="button" className={num === currentPage ? 'active' : ''} onClick={() => setPage(num)}>{num}</button>)}
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}><AppIcon name="chevron-right" /></button>
        </div>}
      </div>
    </section>
  </div>
}
