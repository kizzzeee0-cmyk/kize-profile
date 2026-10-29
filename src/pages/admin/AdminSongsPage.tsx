import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AdminPanel, Notice } from '../../components/AdminCommon'
import { AdminSortableList } from '../../components/AdminSortableList'
import { AppIcon } from '../../components/AppIcon'
import { Modal } from '../../components/Ui'
import {
  deleteRow,
  fetchAdminTable,
  reorderRows,
  saveRow,
  searchAlbumArtwork,
  uploadImage,
  type AlbumArtworkCandidate,
} from '../../lib/data'
import type { SongItem } from '../../types'

type SongForm = {
  title: string
  artist: string
  image_url: string
  image_source: string
  image_source_id: string
  image_origin: 'auto' | 'manual' | ''
  image_registered_at: string
  song_key: string
  genre: string
  status: string
  note: string
  sort_order: number
  is_visible: boolean
}

const emptyForm = (): SongForm => ({
  title: '',
  artist: '',
  image_url: '',
  image_source: '',
  image_source_id: '',
  image_origin: '',
  image_registered_at: '',
  song_key: '',
  genre: 'K-POP',
  status: '',
  note: '',
  sort_order: 0,
  is_visible: true,
})

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

export default function AdminSongsPage() {
  const [rows, setRows] = useState<SongItem[]>([])
  const [form, setForm] = useState<SongForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<AlbumArtworkCandidate[]>([])
  const [albumState, setAlbumState] = useState<'idle' | 'searching' | 'found' | 'choose' | 'none' | 'error'>('idle')
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true)
  const [batch, setBatch] = useState<{ done: number; total: number; found: number; review: number; missing: number; failed: number } | null>(null)
  const searchNonce = useRef(0)

  async function load() {
    setBusy(true)
    try {
      setRows(await fetchAdminTable<SongItem>('songs', 'sort_order'))
      setLoaded(true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '노래 목록을 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (!loaded) void load() }, [loaded])

  function resetSearch() {
    searchNonce.current += 1
    setCandidates([])
    setAlbumState('idle')
  }

  function openNew() {
    setEditingId(undefined)
    setForm(emptyForm())
    setAutoSearchEnabled(true)
    resetSearch()
    setMessage(null)
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(row: SongItem) {
    setEditingId(row.id)
    setForm({
      title: row.title || '',
      artist: row.artist || '',
      image_url: row.image_url || '',
      image_source: row.image_source || '',
      image_source_id: row.image_source_id || '',
      image_origin: row.image_origin || '',
      image_registered_at: row.image_registered_at || '',
      song_key: row.song_key || '',
      genre: row.genre || 'K-POP',
      status: row.status || '',
      note: row.note || '',
      sort_order: row.sort_order || 0,
      is_visible: row.is_visible !== false,
    })
    setAutoSearchEnabled(!row.image_url)
    resetSearch()
    setMessage(null)
    setError(null)
    setEditorOpen(true)
  }

  function applyCandidate(candidate: AlbumArtworkCandidate) {
    setForm(value => ({
      ...value,
      image_url: candidate.imageUrl,
      image_source: candidate.source,
      image_source_id: candidate.sourceId,
      image_origin: 'auto',
      image_registered_at: new Date().toISOString(),
    }))
    setCandidates([])
    setAlbumState('found')
    setAutoSearchEnabled(false)
  }

  async function runAlbumSearch(force = false, requireChoice = false) {
    const title = form.title.trim()
    const artist = form.artist.trim()
    if (!title || !artist) return

    const nonce = ++searchNonce.current
    setAlbumState('searching')
    setCandidates([])

    try {
      const result = await searchAlbumArtwork(title, artist, force)
      if (nonce !== searchNonce.current) return

      if (!result.candidates.length) {
        setAlbumState('none')
        return
      }

      setCandidates(result.candidates)
      if (!requireChoice && result.autoSelect) {
        const candidate = result.candidates.find(item => item.id === result.autoSelect)
        if (candidate) {
          applyCandidate(candidate)
          return
        }
      }

      setAlbumState('choose')
    } catch (e) {
      if (nonce !== searchNonce.current) return
      setAlbumState('error')
      setError(e instanceof Error ? e.message : '앨범 이미지를 검색하지 못했습니다.')
    }
  }

  useEffect(() => {
    // Invalidate an older in-flight result as soon as the query changes, not only
    // when the next delayed request begins.
    searchNonce.current += 1
    if (!editorOpen || !autoSearchEnabled || form.image_url || !form.title.trim() || !form.artist.trim()) return
    setCandidates([])
    setAlbumState('idle')
    const timer = window.setTimeout(() => void runAlbumSearch(false, false), 1000)
    return () => window.clearTimeout(timer)
  }, [editorOpen, autoSearchEnabled, form.title, form.artist, form.image_url])

  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, 'songs')
      setForm(value => ({
        ...value,
        image_url: url,
        image_source: '직접 업로드',
        image_source_id: '',
        image_origin: 'manual',
        image_registered_at: new Date().toISOString(),
      }))
      setAutoSearchEnabled(false)
      resetSearch()
      setMessage('직접 업로드한 앨범 이미지를 적용했습니다. 저장 버튼을 눌러 확정해 주세요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!editingId) payload.sort_order = rows.length + 1
      await saveRow('songs', payload, editingId)
      setEditorOpen(false)
      setEditingId(undefined)
      setForm(emptyForm())
      resetSearch()
      setMessage('노래를 저장했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '노래 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('이 노래를 삭제하시겠습니까?')) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await deleteRow('songs', id)
      setMessage('노래를 삭제했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  async function persistOrder(next: SongItem[]) {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await reorderRows('songs', next.map(row => row.id))
      setRows(next.map((row, index) => ({ ...row, sort_order: index + 1 })))
      setMessage('노래 순서를 저장했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '정렬 순서 저장 실패')
      throw e
    } finally {
      setBusy(false)
    }
  }

  async function findMissingArtwork() {
    const targets = rows.filter(row => !row.image_url && row.title.trim() && row.artist.trim())
    if (!targets.length) {
      setMessage('앨범 이미지가 없는 노래가 없습니다.')
      return
    }
    if (!window.confirm(`앨범 이미지가 없는 ${targets.length}곡을 순서대로 검색할까요?\n정확히 하나만 일치하는 경우에만 자동 등록합니다.`)) return

    setBusy(true)
    setMessage(null)
    setError(null)
    const progress = { done: 0, total: targets.length, found: 0, review: 0, missing: 0, failed: 0 }
    setBatch({ ...progress })

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const song = targets[index]
        try {
          const result = await searchAlbumArtwork(song.title, song.artist, false)
          if (result.autoSelect) {
            const candidate = result.candidates.find(item => item.id === result.autoSelect)
            if (candidate) {
              await saveRow('songs', {
                ...song,
                image_url: candidate.imageUrl,
                image_source: candidate.source,
                image_source_id: candidate.sourceId,
                image_origin: 'auto',
                image_registered_at: new Date().toISOString(),
              }, song.id)
              progress.found += 1
            } else {
              progress.review += 1
            }
          } else if (result.candidates.length) {
            progress.review += 1
          } else {
            progress.missing += 1
          }
        } catch {
          progress.failed += 1
        }

        progress.done += 1
        setBatch({ ...progress })
        if (index < targets.length - 1) await sleep(1100)
      }

      await load()
      setMessage(`앨범 이미지 검색 완료 · 자동 등록 ${progress.found}곡 · 확인 필요 ${progress.review}곡 · 결과 없음 ${progress.missing}곡${progress.failed ? ` · 오류 ${progress.failed}곡` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const albumMessage = albumState === 'searching' ? '앨범 이미지를 찾고 있어요...'
    : albumState === 'found' ? '앨범 이미지를 찾았어요!'
    : albumState === 'choose' ? '일치하는 앨범을 선택해 주세요.'
    : albumState === 'none' ? '일치하는 앨범 이미지를 찾지 못했어요.'
    : albumState === 'error' ? '앨범 이미지 검색 중 문제가 발생했어요.'
    : ''

  return <>
    <div className="admin-page-title">
      <span>SONGBOOK CMS</span>
      <h1>노래책 관리</h1>
      <p>곡 정보와 앨범 이미지를 관리합니다. 제목과 가수를 입력하면 실제 앨범 커버를 자동으로 검색합니다.</p>
    </div>

    <AdminPanel
      title="노래 목록"
      description="기존 앨범 이미지는 제목·가수·장르 등을 수정해도 자동으로 바뀌지 않습니다."
      actions={<div className="admin-song-actions">
        <button className="admin-secondary compact" type="button" disabled={busy} onClick={() => void findMissingArtwork()}>앨범 이미지 없는 노래 자동 찾기</button>
        <button className="admin-primary compact" type="button" disabled={busy} onClick={openNew}><AppIcon name="plus" /> 새 노래</button>
      </div>}
    >
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {batch && batch.done < batch.total && <div className="album-batch-progress">
        <div><strong>앨범 이미지 검색 중</strong><span>{batch.done} / {batch.total}</span></div>
        <progress value={batch.done} max={batch.total} />
        <small>자동 등록 {batch.found} · 확인 필요 {batch.review} · 결과 없음 {batch.missing}</small>
      </div>}
      <div className="admin-sort-help"><AppIcon name="grip" /> 핸들을 길게 누른 뒤 드래그해 순서를 바꿀 수 있습니다. 키보드는 핸들에서 ↑/↓를 사용하세요.</div>

      <AdminSortableList
        rows={rows}
        sortable
        disabled={busy}
        onReorder={persistOrder}
        renderMain={row => <div className="admin-list-summary admin-song-row-summary">
          {row.image_url ? <img src={row.image_url} alt="" /> : <div className="admin-song-no-cover"><AppIcon name="music" /></div>}
          <div>
            <strong>{row.title}</strong>
            <small>{row.artist} · {row.genre}{row.image_source ? ` · ${row.image_origin === 'manual' ? '직접 이미지' : '자동 이미지'}` : ''}</small>
          </div>
        </div>}
        renderActions={row => <>
          <button type="button" onClick={() => openEdit(row)}><AppIcon name="edit" /><span>수정</span></button>
          <button className="danger" type="button" onClick={() => void remove(row.id)}><AppIcon name="trash" /><span>삭제</span></button>
        </>}
      />
    </AdminPanel>

    <Modal open={editorOpen} onClose={() => !busy && setEditorOpen(false)} title={editingId ? '노래 수정' : '노래 추가'}>
      {error && <Notice error>{error}</Notice>}
      <form className="admin-form admin-modal-form song-admin-form" onSubmit={submit}>
        <div className="admin-profile-basic-grid">
          <label className="form-field"><span>노래 제목</span><input required value={form.title} onChange={e => setForm(value => ({ ...value, title: e.target.value }))} /></label>
          <label className="form-field"><span>가수</span><input required value={form.artist} onChange={e => setForm(value => ({ ...value, artist: e.target.value }))} /></label>
        </div>

        <div className="album-artwork-editor">
          <div className="album-artwork-head">
            <div><strong>앨범 이미지</strong><small>직접 업로드한 이미지와 이미 저장된 이미지는 자동 검색으로 덮어쓰지 않습니다.</small></div>
            <button className="admin-secondary compact" type="button" disabled={busy || !form.title.trim() || !form.artist.trim()} onClick={() => void runAlbumSearch(true, true)}>앨범 이미지 다시 찾기</button>
          </div>

          <div className="album-artwork-current">
            {form.image_url
              ? <img src={form.image_url} alt="현재 앨범 이미지" />
              : <div className="album-artwork-empty"><AppIcon name="music" /><span>아직 등록된 앨범 이미지가 없습니다.</span></div>}
            <div className="album-artwork-controls">
              {form.image_url && <div className="album-artwork-source">
                <strong>{form.image_origin === 'manual' ? '직접 등록 이미지' : '등록된 앨범 이미지'}</strong>
                {form.image_source && <small>{form.image_source}</small>}
              </div>}
              <label className="admin-secondary compact album-upload-button">직접 이미지 업로드<input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])} /></label>
              {form.image_url && <button className="admin-secondary compact" type="button" onClick={() => {
                setForm(value => ({ ...value, image_url: '', image_source: '', image_source_id: '', image_origin: '', image_registered_at: '' }))
                setAutoSearchEnabled(false)
                resetSearch()
              }}>이미지 제거</button>}
            </div>
          </div>

          {albumMessage && <div className={`album-search-status ${albumState}`}>{albumMessage}</div>}

          {candidates.length > 0 && <div className="album-candidate-grid">
            {candidates.map(candidate => <button type="button" key={candidate.id} className="album-candidate" onClick={() => applyCandidate(candidate)}>
              <img src={candidate.imageUrl} alt="" loading="lazy" />
              <span><strong>{candidate.releaseTitle}</strong><small>{candidate.artist}{candidate.date ? ` · ${candidate.date.slice(0, 4)}` : ''}</small>{candidate.exact && <em>정확히 일치</em>}</span>
            </button>)}
          </div>}
        </div>

        <div className="admin-profile-basic-grid">
          <label className="form-field"><span>키</span><input value={form.song_key} placeholder="예: Cm / +2 / 원키" onChange={e => setForm(value => ({ ...value, song_key: e.target.value }))} /></label>
          <label className="form-field"><span>장르</span><input required value={form.genre} placeholder="예: K-POP / 발라드 / J-POP / R&B" onChange={e => setForm(value => ({ ...value, genre: e.target.value }))} /></label>
          <label className="form-field"><span>상태</span><input value={form.status} placeholder="예: 신청 가능 / 연습 중" onChange={e => setForm(value => ({ ...value, status: e.target.value }))} /></label>
          <label className="form-field"><span>공개</span><input type="checkbox" checked={form.is_visible} onChange={e => setForm(value => ({ ...value, is_visible: e.target.checked }))} /></label>
        </div>

        <label className="form-field"><span>메모</span><textarea value={form.note} placeholder="곡 관련 참고 메모" onChange={e => setForm(value => ({ ...value, note: e.target.value }))} /></label>

        <div className="form-actions">
          <button className="admin-primary" disabled={busy} type="submit">{busy ? '저장 중...' : editingId ? '수정 저장' : '추가'}</button>
          <button className="admin-secondary" type="button" disabled={busy} onClick={() => setEditorOpen(false)}>취소</button>
        </div>
      </form>
    </Modal>
  </>
}
