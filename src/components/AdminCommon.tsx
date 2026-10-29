import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { deleteRow, fetchAdminTable, reorderRows, saveRow, uploadImage } from '../lib/data'
import { Modal } from './Ui'
import { AdminSortableList } from './AdminSortableList'
import { AppIcon } from './AppIcon'

type FieldType = 'text' | 'textarea' | 'date' | 'time' | 'url' | 'number' | 'checkbox' | 'color' | 'select' | 'image'
type AdminRow = { id: string } & Record<string, any>
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

function rowTitle(row: AdminRow) {
  return String(row.title ?? row.label ?? row.name ?? row.site_title ?? row.value ?? row.soop_name ?? '항목')
}

function rowMeta(row: AdminRow) {
  return String(row.date ?? row.schedule_date ?? row.artist ?? row.url ?? row.text_key ?? row.description ?? '')
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
  const makeEmpty = () => Object.fromEntries(fields.map(field => [field.key, defaults[field.key] ?? defaultFor(field.type)]))
  const [rows, setRows] = useState<AdminRow[]>([])
  const [form, setForm] = useState<Record<string, any>>(makeEmpty)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setBusy(true)
    try {
      setRows(await fetchAdminTable<AdminRow>(table, orderBy))
      setLoaded(true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally { setBusy(false) }
  }

  useEffect(() => { if (!loaded) void load() }, [loaded])

  function openNew() {
    setEditingId(undefined)
    setForm(makeEmpty())
    setEditorOpen(true)
    setMessage(null)
    setError(null)
  }

  function openEdit(row: AdminRow) {
    setEditingId(row.id)
    setForm({ ...row })
    setEditorOpen(true)
    setMessage(null)
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMessage(null); setError(null)
    try {
      const payload = { ...form }
      if (hasSortOrder && !editingId) payload.sort_order = rows.length + 1
      await saveRow(table, payload, editingId)
      setEditorOpen(false)
      setEditingId(undefined)
      setForm(makeEmpty())
      setMessage('저장되었습니다.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 문제가 발생했습니다.')
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    setBusy(true); setMessage(null); setError(null)
    try {
      await deleteRow(table, id)
      setMessage('삭제되었습니다.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally { setBusy(false) }
  }

  async function persistOrder(next: AdminRow[]) {
    if (!hasSortOrder) return
    setBusy(true); setMessage(null); setError(null)
    try {
      await reorderRows(table, next.map(row => row.id))
      setRows(next.map((row, index) => ({ ...row, sort_order: index + 1 })))
      setMessage('순서를 저장했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '정렬 순서 저장 실패')
      throw e
    } finally { setBusy(false) }
  }

  async function handleFile(key: string, file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, table)
      setForm(value => ({ ...value, [key]: url }))
      setMessage('이미지를 업로드했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패')
    } finally { setBusy(false) }
  }

  return <AdminPanel title={title} description={description} actions={<button className="admin-primary compact" type="button" onClick={openNew}><AppIcon name="plus" /> 새 항목</button>}>
    {message && <Notice>{message}</Notice>}
    {error && <Notice error>{error}</Notice>}
    {hasSortOrder && <div className="admin-sort-help"><AppIcon name="grip" /> 핸들을 길게 누른 뒤 드래그해 순서를 바꿀 수 있습니다. 키보드는 핸들에서 ↑/↓를 사용하세요.</div>}

    <AdminSortableList
      rows={rows}
      sortable={hasSortOrder}
      disabled={busy}
      onReorder={hasSortOrder ? persistOrder : undefined}
      renderMain={row => <div className="admin-list-summary">
        {(row.image_url || row.thumbnail_url) && <img src={row.image_url || row.thumbnail_url} alt="" />}
        <div><strong>{rowTitle(row)}</strong>{rowMeta(row) && <small>{rowMeta(row)}</small>}</div>
      </div>}
      renderActions={row => <>
        <button type="button" onClick={() => openEdit(row)}><AppIcon name="edit" /><span>수정</span></button>
        <button className="danger" type="button" onClick={() => void remove(row.id)}><AppIcon name="trash" /><span>삭제</span></button>
      </>}
    />

    <Modal open={editorOpen} onClose={() => !busy && setEditorOpen(false)} title={editingId ? `${title} 수정` : `${title} 추가`}>
      {error && <Notice error>{error}</Notice>}
      <form className="admin-form admin-modal-form" onSubmit={submit}>
        {editableFields.map(field => <FormField key={field.key} label={field.label}>
          {field.type === 'textarea' ? <textarea required={field.required} value={form[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setForm(value => ({ ...value, [field.key]: e.target.value }))} />
          : field.type === 'checkbox' ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={e => setForm(value => ({ ...value, [field.key]: e.target.checked }))} />
          : field.type === 'select' ? <select value={form[field.key] ?? ''} onChange={e => setForm(value => ({ ...value, [field.key]: e.target.value }))}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.type === 'image' ? <div className="admin-image-field"><input type="file" accept="image/*" onChange={e => void handleFile(field.key, e.target.files?.[0])}/>{form[field.key] && <><img className="admin-preview" src={form[field.key]} alt="업로드 미리보기"/><button className="admin-secondary compact" type="button" onClick={() => setForm(value => ({ ...value, [field.key]: '' }))}>이미지 제거</button></>}</div>
          : <input type={field.type || 'text'} required={field.required} value={form[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setForm(value => ({ ...value, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))} />}
        </FormField>)}
        <div className="form-actions"><button className="admin-primary" disabled={busy} type="submit">{busy ? '저장 중...' : editingId ? '수정 저장' : '추가'}</button><button className="admin-secondary" type="button" disabled={busy} onClick={() => setEditorOpen(false)}>취소</button></div>
      </form>
    </Modal>
  </AdminPanel>
}
