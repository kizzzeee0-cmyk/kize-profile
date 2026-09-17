import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { deleteRow, fetchAdminTable, saveRow } from '../../lib/data'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../../lib/soop'
import { supabase } from '../../lib/supabase'
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
      if (!resultForm.person_id && p[0]) setResultForm(v => ({ ...v, person_id: p[0].id }))
    } catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패') }
  }
  useEffect(() => { void load() }, [])

  async function savePerson(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      const soopId = String(personForm.soop_id || '').trim()
      const payload = {
        ...personForm,
        soop_id: soopId,
        profile_image_url: primarySoopProfileUrl(soopId) || null,
        sort_order: personId ? personForm.sort_order : people.reduce((max, p) => Math.max(max, Number(p.sort_order) || 0), 0) + 1,
      }
      const saved = await saveRow('upbo_people', payload, personId)
      let synced = false
      try {
        const { data: sessionData } = await supabase!.auth.getSession()
        const token = sessionData.session?.access_token
        if (token && saved?.id) {
          const response = await fetch('/api/soop-profile-sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ person_id: saved.id, soop_id: soopId }),
          })
          if (response.ok) synced = true
        }
      } catch {
        // Local Vite preview has no Pages Function. The public SOOP image URL remains as a fallback.
      }
      setPersonForm(emptyPerson); setPersonId(undefined);
      setMessage(synced ? '시청자 정보와 SOOP 프로필 사진을 자동 저장했습니다.' : '시청자 정보를 저장했습니다. 현재는 SOOP 프로필 사진을 자동 연결했고, Cloudflare 배포 후 서버 연동이 설정되면 이미지도 자동 저장됩니다.');
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') } finally { setBusy(false) }
  }

  async function saveResult(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      const samePerson = results.filter(r => r.person_id === resultForm.person_id)
      const payload = {
        ...resultForm,
        sort_order: resultId ? resultForm.sort_order : samePerson.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0) + 1,
      }
      await saveRow('upbo_results', payload, resultId)
      setResultForm({ ...emptyResult, person_id: people[0]?.id || '' }); setResultId(undefined); setMessage('룰렛 결과가 저장되었습니다.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') } finally { setBusy(false) }
  }

  async function remove(table: 'upbo_people' | 'upbo_results', id: string) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    try { await deleteRow(table, id); await load() } catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
  }

  async function movePerson(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= people.length) return
    const current = people[index]
    const target = people[targetIndex]
    setBusy(true); setError(null)
    try {
      await saveRow('upbo_people', { sort_order: target.sort_order }, current.id)
      await saveRow('upbo_people', { sort_order: current.sort_order }, target.id)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '정렬 순서 변경 실패') }
    finally { setBusy(false) }
  }

  async function moveResult(result: UpboResult, direction: -1 | 1) {
    const siblings = results.filter(r => r.person_id === result.person_id).sort((a, b) => a.sort_order - b.sort_order)
    const index = siblings.findIndex(r => r.id === result.id)
    const target = siblings[index + direction]
    if (!target) return
    setBusy(true); setError(null)
    try {
      await saveRow('upbo_results', { sort_order: target.sort_order }, result.id)
      await saveRow('upbo_results', { sort_order: result.sort_order }, target.id)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '정렬 순서 변경 실패') }
    finally { setBusy(false) }
  }

  const personName = useMemo(() => new Map(people.map(p => [p.id, p.soop_name])), [people])
  const profilePreview = primarySoopProfileUrl(String(personForm.soop_id || ''))

  return <>
    <div className="admin-page-title"><span>UPBO CMS</span><h1>업보 관리</h1><p>SOOP 이름/아이디와 시청자별 룰렛 결과 및 개수를 관리합니다.</p></div>
    {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}

    <AdminPanel title="SOOP 시청자" description="정렬 순서는 자동입니다. ↑ ↓ 버튼으로 순서를 바꿀 수 있습니다. SOOP 아이디를 입력하면 프로필 이미지는 자동으로 연결됩니다.">
      <div className="admin-split">
        <form className="admin-form" onSubmit={savePerson}>
          <FormField label="SOOP 이름"><input required value={personForm.soop_name || ''} onChange={e => setPersonForm(v => ({ ...v, soop_name: e.target.value }))}/></FormField>
          <FormField label="SOOP 아이디"><input required value={personForm.soop_id || ''} onChange={e => setPersonForm(v => ({ ...v, soop_id: e.target.value }))}/></FormField>
          <FormField label="프로필 사진 자동 미리보기">
            <div className="soop-auto-profile-preview" key={String(personForm.soop_id || '')}>
              {profilePreview ? <><img src={profilePreview} data-profile-index="0" onError={e => { void advanceSoopProfileImage(e.currentTarget, String(personForm.soop_id || '')) }} alt="SOOP 프로필 미리보기"/><span>{String(personForm.soop_name || '?').slice(0, 1)}</span></> : <div className="soop-profile-help">SOOP 아이디를 입력하면 자동으로 표시됩니다.</div>}
            </div>
          </FormField>
          <FormField label="메모"><textarea value={personForm.note || ''} onChange={e => setPersonForm(v => ({ ...v, note: e.target.value }))}/></FormField>
          <FormField label="공개"><input type="checkbox" checked={Boolean(personForm.is_visible)} onChange={e => setPersonForm(v => ({ ...v, is_visible: e.target.checked }))}/></FormField>
          <div className="form-actions"><button className="admin-primary" disabled={busy}>{personId ? '수정 저장' : '추가'}</button>{personId && <button className="admin-secondary" type="button" onClick={() => { setPersonId(undefined); setPersonForm(emptyPerson) }}>취소</button>}</div>
        </form>
        <div className="admin-list">{people.map((p, index) => <article className="admin-list-row" key={p.id}><div><strong>{p.soop_name}</strong><small>@{p.soop_id}</small></div><div className="admin-list-actions"><button className="order-button" disabled={busy || index === 0} type="button" onClick={() => void movePerson(index, -1)}>↑</button><button className="order-button" disabled={busy || index === people.length - 1} type="button" onClick={() => void movePerson(index, 1)}>↓</button><button type="button" onClick={() => { setPersonId(p.id); setPersonForm({ ...p }) }}>수정</button><button className="danger" type="button" onClick={() => void remove('upbo_people', p.id)}>삭제</button></div></article>)}</div>
      </div>
    </AdminPanel>

    <AdminPanel title="룰렛 결과 / 개수" description="새 결과는 해당 시청자의 마지막 순서에 자동으로 추가됩니다. ↑ ↓ 버튼은 같은 시청자 안에서만 순서를 바꿉니다.">
      <div className="admin-split">
        <form className="admin-form" onSubmit={saveResult}>
          <FormField label="시청자"><select required value={resultForm.person_id || ''} onChange={e => setResultForm(v => ({ ...v, person_id: e.target.value }))}><option value="">선택</option>{people.map(p => <option key={p.id} value={p.id}>{p.soop_name} (@{p.soop_id})</option>)}</select></FormField>
          <FormField label="룰렛 결과"><input required value={resultForm.result_label || ''} onChange={e => setResultForm(v => ({ ...v, result_label: e.target.value }))}/></FormField>
          <FormField label="개수"><input type="number" min="0" value={resultForm.quantity ?? 1} onChange={e => setResultForm(v => ({ ...v, quantity: Number(e.target.value) }))}/></FormField>
          <FormField label="메모"><textarea value={resultForm.note || ''} onChange={e => setResultForm(v => ({ ...v, note: e.target.value }))}/></FormField>
          <div className="form-actions"><button className="admin-primary" disabled={busy}>{resultId ? '수정 저장' : '추가'}</button>{resultId && <button className="admin-secondary" type="button" onClick={() => { setResultId(undefined); setResultForm({ ...emptyResult, person_id: people[0]?.id || '' }) }}>취소</button>}</div>
        </form>
        <div className="admin-list">{results.map(r => {
          const siblings = results.filter(x => x.person_id === r.person_id).sort((a, b) => a.sort_order - b.sort_order)
          const index = siblings.findIndex(x => x.id === r.id)
          return <article className="admin-list-row" key={r.id}><div><strong>{personName.get(r.person_id) || '알 수 없음'} · {r.result_label}</strong><small>× {r.quantity}</small></div><div className="admin-list-actions"><button className="order-button" disabled={busy || index <= 0} type="button" onClick={() => void moveResult(r, -1)}>↑</button><button className="order-button" disabled={busy || index < 0 || index >= siblings.length - 1} type="button" onClick={() => void moveResult(r, 1)}>↓</button><button type="button" onClick={() => { setResultId(r.id); setResultForm({ ...r }) }}>수정</button><button className="danger" type="button" onClick={() => void remove('upbo_results', r.id)}>삭제</button></div></article>
        })}</div>
      </div>
    </AdminPanel>

    <AdminPanel title="WEFLAB 자동 연동 준비">
      <div className="weflab-ready-box">
        <strong>Webhook 수신 주소 준비 완료</strong>
        <code>/api/weflab-webhook</code>
        <p>WEFLAB이 외부 Webhook/API 전송을 지원하는 경우, Cloudflare의 비밀 환경변수를 설정한 뒤 이 주소로 룰렛 결과를 자동 적재할 수 있습니다. 현재 공개된 WEFLAB 안내에서는 외부 Webhook 규격을 확인할 수 없어 실제 자동 전송은 WEFLAB 측 지원 여부/전송 형식 확인 후 활성화해야 합니다.</p>
      </div>
    </AdminPanel>
  </>
}
