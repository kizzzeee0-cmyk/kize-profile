import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { AdminSortableList } from '../../components/AdminSortableList'
import { AppIcon } from '../../components/AppIcon'
import { deleteRow, fetchAdminTable, reorderRows, saveRow } from '../../lib/data'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../../lib/soop'
import type { UpboPerson, UpboResult } from '../../types'

const emptyPerson = { soop_name: '', soop_id: '', profile_image_url: '', note: '', sort_order: 0, is_visible: true }
const emptyResult = { person_id: '', result_label: '', quantity: 1, note: '', sort_order: 0 }

export default function AdminUpboPage() {
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [personForm, setPersonForm] = useState<Record<string, any>>(emptyPerson)
  const [resultForm, setResultForm] = useState<Record<string, any>>(emptyResult)
  const [personId, setPersonId] = useState<string | undefined>()
  const [resultId, setResultId] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [p, r] = await Promise.all([fetchAdminTable<UpboPerson>('upbo_people', 'sort_order'), fetchAdminTable<UpboResult>('upbo_results', 'sort_order')])
      setPeople(p); setResults(r)
      if (!resultForm.person_id && p[0]) setResultForm(value => ({ ...value, person_id: p[0].id }))
    } catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패') }
  }
  useEffect(() => { void load() }, [])

  async function savePerson(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      const soopId = String(personForm.soop_id || '').trim()
      const payload = { ...personForm, soop_id: soopId, profile_image_url: primarySoopProfileUrl(soopId) || null, sort_order: personId ? personForm.sort_order : people.length + 1 }
      const saved = await saveRow('upbo_people', payload, personId)
      try {
        if (saved?.id) await fetch('/api/soop-profile-sync', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person_id: saved.id, soop_id: soopId }) })
      } catch { /* public profile URL remains as fallback */ }
      setPersonForm(emptyPerson); setPersonId(undefined); setMessage('시청자 정보를 저장했습니다.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function saveResult(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      await saveRow('upbo_results', { ...resultForm, sort_order: resultId ? resultForm.sort_order : results.length + 1 }, resultId)
      setResultForm({ ...emptyResult, person_id: people[0]?.id || '' }); setResultId(undefined); setMessage('룰렛 결과가 저장되었습니다.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function remove(table: 'upbo_people' | 'upbo_results', id: string) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    setBusy(true)
    try { await deleteRow(table, id); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
    finally { setBusy(false) }
  }

  async function reorderPeople(next: Record<string, any>[]) {
    setBusy(true)
    try { await reorderRows('upbo_people', next.map(row => row.id)); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '정렬 저장 실패'); throw e }
    finally { setBusy(false) }
  }

  async function reorderResults(next: Record<string, any>[]) {
    setBusy(true)
    try { await reorderRows('upbo_results', next.map(row => row.id)); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '정렬 저장 실패'); throw e }
    finally { setBusy(false) }
  }

  const personName = useMemo(() => new Map(people.map(person => [person.id, person.soop_name])), [people])
  const profilePreview = primarySoopProfileUrl(String(personForm.soop_id || ''))

  return <>
    <div className="admin-page-title"><span>UPBO CMS</span><h1>업보 관리</h1><p>SOOP 시청자와 룰렛 결과를 목록 중심으로 관리합니다.</p></div>
    {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}

    <AdminPanel title="SOOP 시청자" description="⠿ 핸들을 길게 누르면 PC와 모바일에서 드래그 정렬할 수 있습니다.">
      <AdminSortableList
        rows={people}
        disabled={busy}
        onReorder={reorderPeople}
        renderMain={row => <div className="admin-list-summary"><div className="admin-mini-avatar"><img src={row.profile_image_url || primarySoopProfileUrl(row.soop_id)} alt="" onError={e => { void advanceSoopProfileImage(e.currentTarget, row.soop_id) }} /></div><div><strong>{row.soop_name}</strong><small>@{row.soop_id}</small></div></div>}
        renderActions={row => <><button type="button" onClick={() => { setPersonId(row.id); setPersonForm({ ...row }) }}><AppIcon name="edit" /> 수정</button><button className="danger" type="button" onClick={() => void remove('upbo_people', row.id)}><AppIcon name="trash" /> 삭제</button></>}
      />

      <div className="admin-inline-editor">
        <h3>{personId ? '시청자 수정' : '새 시청자 추가'}</h3>
        <form className="admin-form admin-profile-basic-grid" onSubmit={savePerson}>
          <FormField label="SOOP 이름"><input required value={personForm.soop_name || ''} onChange={e => setPersonForm(value => ({ ...value, soop_name: e.target.value }))}/></FormField>
          <FormField label="SOOP 아이디"><input required value={personForm.soop_id || ''} onChange={e => setPersonForm(value => ({ ...value, soop_id: e.target.value }))}/></FormField>
          <FormField label="프로필 사진 자동 미리보기"><div className="soop-auto-profile-preview">{profilePreview ? <img src={profilePreview} data-profile-index="0" onError={e => { void advanceSoopProfileImage(e.currentTarget, String(personForm.soop_id || '')) }} alt="SOOP 프로필 미리보기"/> : <span>SOOP 아이디를 입력해 주세요.</span>}</div></FormField>
          <FormField label="메모"><textarea value={personForm.note || ''} onChange={e => setPersonForm(value => ({ ...value, note: e.target.value }))}/></FormField>
          <FormField label="공개"><input type="checkbox" checked={Boolean(personForm.is_visible)} onChange={e => setPersonForm(value => ({ ...value, is_visible: e.target.checked }))}/></FormField>
          <div className="form-actions"><button className="admin-primary" disabled={busy}>{personId ? '수정 저장' : '추가'}</button>{personId && <button className="admin-secondary" type="button" onClick={() => { setPersonId(undefined); setPersonForm(emptyPerson) }}>취소</button>}</div>
        </form>
      </div>
    </AdminPanel>

    <AdminPanel title="룰렛 결과 / 개수" description="결과도 동일하게 드래그 정렬됩니다.">
      <AdminSortableList
        rows={results}
        disabled={busy}
        onReorder={reorderResults}
        renderMain={row => <div className="admin-list-summary"><div><strong>{personName.get(row.person_id) || '알 수 없음'} · {row.result_label}</strong><small>× {row.quantity}{row.note ? ` · ${row.note}` : ''}</small></div></div>}
        renderActions={row => <><button type="button" onClick={() => { setResultId(row.id); setResultForm({ ...row }) }}><AppIcon name="edit" /> 수정</button><button className="danger" type="button" onClick={() => void remove('upbo_results', row.id)}><AppIcon name="trash" /> 삭제</button></>}
      />

      <div className="admin-inline-editor">
        <h3>{resultId ? '룰렛 결과 수정' : '새 룰렛 결과 추가'}</h3>
        <form className="admin-form admin-profile-basic-grid" onSubmit={saveResult}>
          <FormField label="시청자"><select required value={resultForm.person_id || ''} onChange={e => setResultForm(value => ({ ...value, person_id: e.target.value }))}><option value="">선택</option>{people.map(person => <option key={person.id} value={person.id}>{person.soop_name} (@{person.soop_id})</option>)}</select></FormField>
          <FormField label="룰렛 결과"><input required value={resultForm.result_label || ''} onChange={e => setResultForm(value => ({ ...value, result_label: e.target.value }))}/></FormField>
          <FormField label="개수"><input type="number" min="0" value={resultForm.quantity ?? 1} onChange={e => setResultForm(value => ({ ...value, quantity: Number(e.target.value) }))}/></FormField>
          <FormField label="메모"><textarea value={resultForm.note || ''} onChange={e => setResultForm(value => ({ ...value, note: e.target.value }))}/></FormField>
          <div className="form-actions"><button className="admin-primary" disabled={busy}>{resultId ? '수정 저장' : '추가'}</button>{resultId && <button className="admin-secondary" type="button" onClick={() => { setResultId(undefined); setResultForm({ ...emptyResult, person_id: people[0]?.id || '' }) }}>취소</button>}</div>
        </form>
      </div>
    </AdminPanel>
  </>
}
