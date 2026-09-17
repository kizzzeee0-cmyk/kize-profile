import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { deleteRow, fetchAdminTable, saveRow, uploadImage } from '../lib/data'

type FieldType = 'text' | 'textarea' | 'date' | 'time' | 'url' | 'number' | 'checkbox' | 'color' | 'select' | 'image'
export type FieldConfig = {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

export function AdminPanel({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="admin-panel"><div className="admin-panel-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>{children}</section>
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`admin-notice ${error ? 'error' : ''}`}>{children}</div>
}

function defaultFor(type?: FieldType) {
  if (type === 'checkbox') return false
  if (type === 'number') return 0
  return ''
}

export function CrudEditor({
  table,
  title,
  description,
  fields,
  defaults = {},
  orderBy = 'sort_order',
}: {
  table: string
  title: string
  description?: string
  fields: FieldConfig[]
  defaults?: Record<string, unknown>
  orderBy?: string
}) {
  const hasSortOrder = fields.some(field => field.key === 'sort_order')
  const editableFields = useMemo(() => fields.filter(field => field.key !== 'sort_order'), [fields])
  const makeEmpty = () => Object.fromEntries(fields.map(f => [f.key, defaults[f.key] ?? defaultFor(f.type)]))
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [form, setForm] = useState<Record<string, any>>(makeEmpty)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setBusy(true)
    try { setRows(await fetchAdminTable<Record<string, any>>(table, orderBy)); setLoaded(true); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패') }
    finally { setBusy(false) }
  }

  useEffect(() => { if (!loaded) void load() }, [loaded])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null); setError(null)
    try {
      const payload = { ...form }
      if (hasSortOrder && !editingId) {
        payload.sort_order = rows.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0) + 1
      }
      await saveRow(table, payload, editingId)
      setForm(makeEmpty()); setEditingId(undefined); setMessage('저장되었습니다.'); await load()
    } catch (err) { setError(err instanceof Error ? err.message : '저장 중 문제가 발생했습니다.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    setBusy(true)
    try { await deleteRow(table, id); setMessage('삭제되었습니다.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
    finally { setBusy(false) }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!hasSortOrder) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= rows.length) return
    const current = rows[index]
    const target = rows[targetIndex]
    const currentOrder = Number(current.sort_order) || index + 1
    const targetOrder = Number(target.sort_order) || targetIndex + 1
    setBusy(true); setMessage(null); setError(null)
    try {
      await saveRow(table, { sort_order: targetOrder }, current.id)
      await saveRow(table, { sort_order: currentOrder }, target.id)
      setMessage('정렬 순서를 변경했습니다.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '정렬 순서 변경 실패') }
    finally { setBusy(false) }
  }

  async function handleFile(key: string, file?: File) {
    if (!file) return
    setBusy(true)
    try { const url = await uploadImage(file, table); setForm(v => ({ ...v, [key]: url })); setMessage('이미지를 업로드했습니다.') }
    catch (e) { setError(e instanceof Error ? e.message : '이미지 업로드 실패') }
    finally { setBusy(false) }
  }

  return <AdminPanel title={title} description={description} actions={<button className="admin-secondary" type="button" onClick={() => { setEditingId(undefined); setForm(makeEmpty()) }}>새 항목</button>}>
    {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
    {hasSortOrder && <div className="admin-sort-help">정렬 순서는 자동으로 입력됩니다. 목록의 ↑ ↓ 버튼으로 위치만 바꿔 주세요.</div>}
    <div className="admin-split">
      <form className="admin-form" onSubmit={submit}>
        {editableFields.map(field => <FormField key={field.key} label={field.label}>
          {field.type === 'textarea' ? <textarea required={field.required} value={form[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setForm(v => ({ ...v, [field.key]: e.target.value }))} />
          : field.type === 'checkbox' ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={e => setForm(v => ({ ...v, [field.key]: e.target.checked }))} />
          : field.type === 'select' ? <select value={form[field.key] ?? ''} onChange={e => setForm(v => ({ ...v, [field.key]: e.target.value }))}>{field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : field.type === 'image' ? <><input type="file" accept="image/*" onChange={e => void handleFile(field.key, e.target.files?.[0])}/>{form[field.key] && <img className="admin-preview" src={form[field.key]} alt="업로드 미리보기"/>}</>
          : <input type={field.type || 'text'} required={field.required} value={form[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setForm(v => ({ ...v, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))} />}
        </FormField>)}
        <div className="form-actions"><button className="admin-primary" disabled={busy} type="submit">{busy ? '저장 중...' : editingId ? '수정 저장' : '추가'}</button>{editingId && <button className="admin-secondary" type="button" onClick={() => { setEditingId(undefined); setForm(makeEmpty()) }}>취소</button>}</div>
      </form>
      <div className="admin-list">
        {busy && !rows.length ? <p>불러오는 중...</p> : rows.length ? rows.map((row, index) => <article key={row.id} className="admin-list-row">
          <div><strong>{String(row.title ?? row.label ?? row.name ?? row.site_title ?? '항목')}</strong><small>{String(row.date ?? row.value ?? row.url ?? '')}</small></div>
          <div className="admin-list-actions">{hasSortOrder && <><button className="order-button" type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)} aria-label="위로 이동" title="위로 이동">↑</button><button className="order-button" type="button" disabled={busy || index === rows.length - 1} onClick={() => void move(index, 1)} aria-label="아래로 이동" title="아래로 이동">↓</button></>}<button type="button" onClick={() => { setEditingId(row.id); setForm({ ...row }) }}>수정</button><button className="danger" type="button" onClick={() => void remove(row.id)}>삭제</button></div>
        </article>) : <p className="admin-empty">등록된 항목이 없습니다.</p>}
      </div>
    </div>
  </AdminPanel>
}
