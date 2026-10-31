import { useEffect, useState, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { AdminSortableList } from '../../components/AdminSortableList'
import { AppIcon } from '../../components/AppIcon'
import { deleteRow, fetchAdminTable, reorderRows, saveRow } from '../../lib/data'
import { advanceSoopProfileImage, primarySoopProfileUrl } from '../../lib/soop'
import type { UpboItem, UpboPerson, UpboResult } from '../../types'

const emptyPerson = { soop_name: '', soop_id: '', profile_image_url: '', note: '', sort_order: 0, is_visible: true }
const emptyItem = { name: '', note: '', sort_order: 0, is_visible: true }

export default function AdminUpboPage() {
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [items, setItems] = useState<UpboItem[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [personForm, setPersonForm] = useState<Record<string, any>>(emptyPerson)
  const [itemForm, setItemForm] = useState<Record<string, any>>(emptyItem)
  const [personId, setPersonId] = useState<string | undefined>()
  const [itemId, setItemId] = useState<string | undefined>()
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const [p, i, r] = await Promise.all([
        fetchAdminTable<UpboPerson>('upbo_people', 'sort_order'),
        fetchAdminTable<UpboItem>('upbo_items', 'sort_order'),
        fetchAdminTable<UpboResult>('upbo_results', 'sort_order'),
      ])
      setPeople(p)
      setItems(i)
      setResults(r)
      setSelectedPersonId(current => current && p.some(person => person.id === current) ? current : (p[0]?.id || ''))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    }
  }

  useEffect(() => { void load() }, [])

  async function savePerson(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    try {
      const soopId = String(personForm.soop_id || '').trim()
      const payload = {
        ...personForm,
        soop_id: soopId,
        profile_image_url: primarySoopProfileUrl(soopId) || null,
        sort_order: personId ? personForm.sort_order : people.length + 1,
      }
      const saved = await saveRow('upbo_people', payload, personId)
      try {
        if (saved?.id) {
          await fetch('/api/soop-profile-sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ person_id: saved.id, soop_id: soopId }),
          })
        }
      } catch { /* public profile URL remains as fallback */ }
      setPersonForm(emptyPerson)
      setPersonId(undefined)
      setMessage('시청자 정보를 저장했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    try {
      await saveRow('upbo_items', {
        ...itemForm,
        name: String(itemForm.name || '').trim(),
        sort_order: itemId ? itemForm.sort_order : items.length + 1,
      }, itemId)
      setItemForm(emptyItem)
      setItemId(undefined)
      setMessage('업보 항목을 저장했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업보 항목 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function remove(table: 'upbo_people' | 'upbo_items', id: string) {
    if (!window.confirm(table === 'upbo_people'
      ? '이 시청자를 삭제하면 연결된 업보 개수도 함께 삭제됩니다. 삭제하시겠습니까?'
      : '이 항목을 삭제하면 연결된 업보 개수도 함께 삭제됩니다. 삭제하시겠습니까?')) return

    setBusy(true); setError(null); setMessage(null)
    try {
      await deleteRow(table, id)
      setMessage(table === 'upbo_people' ? '시청자를 삭제했습니다.' : '업보 항목을 삭제했습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  async function reorderPeople(next: UpboPerson[]) {
    setBusy(true)
    try {
      await reorderRows('upbo_people', next.map(row => row.id))
      setPeople(next.map((row, index) => ({ ...row, sort_order: index + 1 })))
    } catch (e) {
      setError(e instanceof Error ? e.message : '시청자 순서 저장 실패')
      throw e
    } finally {
      setBusy(false)
    }
  }

  async function reorderItems(next: UpboItem[]) {
    setBusy(true)
    try {
      await reorderRows('upbo_items', next.map(row => row.id))
      setItems(next.map((row, index) => ({ ...row, sort_order: index + 1 })))
    } catch (e) {
      setError(e instanceof Error ? e.message : '항목 순서 저장 실패')
      throw e
    } finally {
      setBusy(false)
    }
  }

  function findResult(item: UpboItem) {
    return results.find(result =>
      result.person_id === selectedPersonId &&
      (String(result.item_id || '') === item.id || (!result.item_id && result.result_label === item.name))
    )
  }

  function quantityFor(item: UpboItem) {
    return Math.max(0, Number(findResult(item)?.quantity || 0))
  }

  async function changeQuantity(item: UpboItem, delta: number) {
    if (!selectedPersonId || busyItemId) return
    const existing = findResult(item)
    const nextQuantity = Math.max(0, Number(existing?.quantity || 0) + delta)
    if (!existing && nextQuantity === 0) return

    setBusyItemId(item.id)
    setError(null)
    setMessage(null)

    try {
      if (existing && nextQuantity === 0) {
        await deleteRow('upbo_results', existing.id)
        setResults(current => current.filter(row => row.id !== existing.id))
      } else {
        const saved = await saveRow('upbo_results', {
          person_id: selectedPersonId,
          item_id: item.id,
          result_label: item.name,
          quantity: nextQuantity,
          note: existing?.note || '',
          sort_order: item.sort_order || items.findIndex(row => row.id === item.id) + 1,
        }, existing?.id) as UpboResult

        setResults(current => existing
          ? current.map(row => row.id === existing.id ? saved : row)
          : [...current, saved])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '업보 개수 저장 실패')
    } finally {
      setBusyItemId(null)
    }
  }

  const profilePreview = primarySoopProfileUrl(String(personForm.soop_id || ''))
  const selectedPerson = people.find(person => person.id === selectedPersonId)

  return <>
    <div className="admin-page-title">
      <span>UPBO CMS</span>
      <h1>업보 관리</h1>
      <p>시청자와 업보 항목을 미리 등록한 뒤, 시청자별 개수를 − / + 버튼으로 바로 관리합니다.</p>
    </div>

    {message && <Notice>{message}</Notice>}
    {error && <Notice error>{error}</Notice>}

    <AdminPanel title="SOOP 시청자" description="시청자를 먼저 등록해 두고 아래에서 선택해 업보 개수를 조정합니다.">
      <AdminSortableList
        rows={people}
        disabled={busy}
        onReorder={reorderPeople}
        renderMain={row => <div className="admin-list-summary">
          <div className="admin-mini-avatar">
            <img
              src={row.profile_image_url || primarySoopProfileUrl(row.soop_id)}
              alt=""
              onError={e => { void advanceSoopProfileImage(e.currentTarget, row.soop_id) }}
            />
          </div>
          <div><strong>{row.soop_name}</strong><small>@{row.soop_id}</small></div>
        </div>}
        renderActions={row => <>
          <button type="button" onClick={() => { setPersonId(row.id); setPersonForm({ ...row }) }}>
            <AppIcon name="edit" /> 수정
          </button>
          <button className="danger" type="button" onClick={() => void remove('upbo_people', row.id)}>
            <AppIcon name="trash" /> 삭제
          </button>
        </>}
      />

      <div className="admin-inline-editor">
        <h3>{personId ? '시청자 수정' : '새 시청자 추가'}</h3>
        <form className="admin-form admin-profile-basic-grid" onSubmit={savePerson}>
          <FormField label="SOOP 이름">
            <input required value={personForm.soop_name || ''} onChange={e => setPersonForm(value => ({ ...value, soop_name: e.target.value }))}/>
          </FormField>
          <FormField label="SOOP 아이디">
            <input required value={personForm.soop_id || ''} onChange={e => setPersonForm(value => ({ ...value, soop_id: e.target.value }))}/>
          </FormField>
          <FormField label="프로필 사진 자동 미리보기">
            <div className="soop-auto-profile-preview">
              {profilePreview
                ? <img src={profilePreview} data-profile-index="0" onError={e => { void advanceSoopProfileImage(e.currentTarget, String(personForm.soop_id || '')) }} alt="SOOP 프로필 미리보기"/>
                : <span>SOOP 아이디를 입력해 주세요.</span>}
            </div>
          </FormField>
          <FormField label="메모">
            <textarea value={personForm.note || ''} onChange={e => setPersonForm(value => ({ ...value, note: e.target.value }))}/>
          </FormField>
          <FormField label="공개">
            <input type="checkbox" checked={Boolean(personForm.is_visible)} onChange={e => setPersonForm(value => ({ ...value, is_visible: e.target.checked }))}/>
          </FormField>
          <div className="form-actions">
            <button className="admin-primary" disabled={busy}>{personId ? '수정 저장' : '추가'}</button>
            {personId && <button className="admin-secondary" type="button" onClick={() => { setPersonId(undefined); setPersonForm(emptyPerson) }}>취소</button>}
          </div>
        </form>
      </div>
    </AdminPanel>

    <AdminPanel title="업보 항목" description="자주 사용하는 업보 항목을 카테고리처럼 한 번만 등록합니다. 드래그로 표시 순서를 바꿀 수 있습니다.">
      <AdminSortableList
        rows={items}
        disabled={busy}
        onReorder={reorderItems}
        emptyText="등록된 업보 항목이 없습니다."
        renderMain={row => <div className="admin-list-summary">
          <div>
            <strong>{row.name}</strong>
            <small>{row.note || (row.is_visible === false ? '숨김 항목' : '업보 항목')}</small>
          </div>
        </div>}
        renderActions={row => <>
          <button type="button" onClick={() => { setItemId(row.id); setItemForm({ ...row }) }}>
            <AppIcon name="edit" /> 수정
          </button>
          <button className="danger" type="button" onClick={() => void remove('upbo_items', row.id)}>
            <AppIcon name="trash" /> 삭제
          </button>
        </>}
      />

      <div className="admin-inline-editor">
        <h3>{itemId ? '업보 항목 수정' : '새 업보 항목 추가'}</h3>
        <form className="admin-form admin-profile-basic-grid" onSubmit={saveItem}>
          <FormField label="항목 이름">
            <input required placeholder="예: 상단배너 / 시그풍 1개 / 당일마감" value={itemForm.name || ''} onChange={e => setItemForm(value => ({ ...value, name: e.target.value }))}/>
          </FormField>
          <FormField label="설명 또는 금액 (선택)">
            <input placeholder="예: 30,000원" value={itemForm.note || ''} onChange={e => setItemForm(value => ({ ...value, note: e.target.value }))}/>
          </FormField>
          <FormField label="사용">
            <input type="checkbox" checked={Boolean(itemForm.is_visible)} onChange={e => setItemForm(value => ({ ...value, is_visible: e.target.checked }))}/>
          </FormField>
          <div className="form-actions">
            <button className="admin-primary" disabled={busy}>{itemId ? '수정 저장' : '항목 추가'}</button>
            {itemId && <button className="admin-secondary" type="button" onClick={() => { setItemId(undefined); setItemForm(emptyItem) }}>취소</button>}
          </div>
        </form>
      </div>
    </AdminPanel>

    <AdminPanel title="시청자별 업보 개수" description="시청자를 선택한 뒤 각 항목의 − / + 버튼으로 개수를 바로 조정합니다. 변경 내용은 버튼을 누를 때마다 자동 저장됩니다.">
      <div className="upbo-counter-toolbar">
        <FormField label="시청자 선택">
          <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)}>
            <option value="">시청자를 선택해 주세요.</option>
            {people.map(person => <option key={person.id} value={person.id}>{person.soop_name} (@{person.soop_id})</option>)}
          </select>
        </FormField>
        {selectedPerson && <div className="upbo-selected-person">
          <strong>{selectedPerson.soop_name}</strong>
          <span>@{selectedPerson.soop_id}</span>
        </div>}
      </div>

      {!people.length
        ? <p className="admin-empty">먼저 SOOP 시청자를 추가해 주세요.</p>
        : !items.length
          ? <p className="admin-empty">먼저 업보 항목을 추가해 주세요.</p>
          : !selectedPersonId
            ? <p className="admin-empty">업보 개수를 수정할 시청자를 선택해 주세요.</p>
            : <div className="upbo-counter-grid">
              {items.filter(item => item.is_visible !== false).map(item => {
                const quantity = quantityFor(item)
                const isSaving = busyItemId === item.id
                return <div className="upbo-counter-card" key={item.id}>
                  <div className="upbo-counter-copy">
                    <strong>{item.name}</strong>
                    {item.note && <small>{item.note}</small>}
                  </div>
                  <div className="upbo-counter-stepper" aria-label={`${item.name} 개수`}>
                    <button type="button" disabled={quantity <= 0 || Boolean(busyItemId)} onClick={() => void changeQuantity(item, -1)} aria-label={`${item.name} 1개 빼기`}>−</button>
                    <span>{isSaving ? '…' : quantity}</span>
                    <button type="button" disabled={Boolean(busyItemId)} onClick={() => void changeQuantity(item, 1)} aria-label={`${item.name} 1개 더하기`}>+</button>
                  </div>
                </div>
              })}
            </div>}
    </AdminPanel>
  </>
}
