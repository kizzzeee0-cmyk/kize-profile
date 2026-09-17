import { useEffect, useMemo, useState } from 'react'
import { EmptyState, LoadingBlocks, SectionHeading, StatusMessage } from '../components/Ui'
import { fetchSongs } from '../lib/data'
import type { SongItem } from '../types'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'

export default function SongbookPage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [songs, setSongs] = useState<SongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('전체')

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

  const grouped = useMemo(() => {
    const map = new Map<string, SongItem[]>()
    for (const song of filtered) {
      const key = song.genre || '기타'
      const list = map.get(key) || []
      list.push(song)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  return <section className="section-pad page-top songbook-page">
    <div className="container songbook-container">
      <SectionHeading eyebrow={t('songbook_label', 'SONGBOOK')} title={t('songbook_title', '노래책')} />
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div className="songbook-tools">
        <label className="song-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('songbook_search_placeholder', '제목, 가수 또는 장르 검색')} aria-label="노래 검색" />
        </label>
        <div className="song-genre-tabs" aria-label="노래 장르">
          {genres.map(item => <button key={item} type="button" className={genre === item ? 'active' : ''} onClick={() => setGenre(item)}>{item}</button>)}
        </div>
      </div>

      {loading ? <LoadingBlocks /> : grouped.length ? <div className="song-groups">
        {grouped.map(([group, items]) => <section className="song-group" key={group}>
          <div className="song-group-head"><h2>{group}</h2><span>{items.length}곡</span></div>
          <div className="song-list">
            {items.map(song => <article className="song-row" key={song.id}>
              <div className="song-main"><strong>{song.title}</strong><span>{song.artist}</span></div>
              <div className="song-meta">{song.song_key && <span className="song-key">KEY {song.song_key}</span>}{song.note && <span className="song-note">{song.note}</span>}</div>
            </article>)}
          </div>
        </section>)}
      </div> : <EmptyState>{t('songbook_empty', '조건에 맞는 노래가 없습니다.')}</EmptyState>}
    </div>
  </section>
}
