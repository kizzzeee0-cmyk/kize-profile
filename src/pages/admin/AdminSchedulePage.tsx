import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { deleteRow, fetchAdminTable, fetchSchedules, saveRow, uploadImage } from '../../lib/data'
import { formatDate, formatTime, toDateKey } from '../../lib/dates'
import type { ScheduleCategory, ScheduleItem } from '../../types'

const empty = {
  title: '', schedule_date: toDateKey(new Date()), start_time: '', end_time: '', category_id: '', description: '', participants: '', related_url: '', image_url: '', note: '', is_visible: true,
}

export default function AdminSchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [categories, setCategories] = useState<ScheduleCategory[]>([])
  const [form, setForm] = useState<Record<string, any>>(empty)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [month, setMonth] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [toDateKey(start), toDateKey(end)] as const
  }, [month])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [schedules, cats] = await Promise.all([fetchSchedules(range[0], range[1], true), fetchAdminTable<ScheduleCategory>('schedule_categories', 'sort_order')])
      setItems(schedules); setCategories(cats); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.') }
    finally { setBusy(false) }
  }, [range])

  useEffect(() => { void load() }, [load])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null); setError(null)
    try {
      const payload = { ...form, start_time: form.start_time || null, end_time: form.end_time || null, category_id: form.category_id || null, image_url: form.image_url || null, related_url: form.related_url || null }
      await saveRow('schedules', payload, editingId)
      setForm({ ...empty, schedule_date: form.schedule_date }); setEditingId(undefined); setMessage('일정이 저장되었습니다.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return
    setBusy(true)
    try { await deleteRow('schedules', id); setMessage('삭제되었습니다.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
    finally { setBusy(false) }
  }

  async function duplicate(item: ScheduleItem) {
    const { id: _id, category: _category, created_at: _created, ...copy } = item
    await saveRow('schedules', { ...copy, title: `${item.title} 복사본` })
    setMessage('일정을 복제했습니다.'); await load()
  }

  async function image(file?: File) {
    if (!file) return
    setBusy(true)
    try { const url = await uploadImage(file, 'schedule'); setForm(v => ({ ...v, image_url: url })); setMessage('이미지가 업로드되었습니다.') }
    catch (e) { setError(e instanceof Error ? e.message : '업로드 실패') }
    finally { setBusy(false) }
  }

  return <>
    <div className="admin-page-title"><span>SCHEDULE CMS</span><h1>일정 관리</h1><p>방송, 휴방, 이벤트, 합방, 대회, 기타 일정을 등록합니다.</p></div>
    <AdminPanel title="일정 작성" actions={<button className="admin-secondary" type="button" onClick={() => { setEditingId(undefined); setForm(empty) }}>새 일정</button>}>
      {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
      <form className="admin-form two-col" onSubmit={submit}>
        <FormField label="일정 제목"><input required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}/></FormField>
        <FormField label="날짜"><input required type="date" value={form.schedule_date} onChange={e => setForm(v => ({ ...v, schedule_date: e.target.value }))}/></FormField>
        <FormField label="시작 시간"><input type="time" value={form.start_time || ''} onChange={e => setForm(v => ({ ...v, start_time: e.target.value }))}/></FormField>
        <FormField label="종료 시간"><input type="time" value={form.end_time || ''} onChange={e => setForm(v => ({ ...v, end_time: e.target.value }))}/></FormField>
        <FormField label="카테고리"><select value={form.category_id || ''} onChange={e => setForm(v => ({ ...v, category_id: e.target.value }))}><option value="">기타 / 미지정</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
        <FormField label="참여자"><input value={form.participants || ''} onChange={e => setForm(v => ({ ...v, participants: e.target.value }))}/></FormField>
        <FormField label="상세 설명"><textarea value={form.description || ''} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></FormField>
        <FormField label="비고"><textarea value={form.note || ''} onChange={e => setForm(v => ({ ...v, note: e.target.value }))}/></FormField>
        <FormField label="관련 URL"><input type="url" value={form.related_url || ''} onChange={e => setForm(v => ({ ...v, related_url: e.target.value }))}/></FormField>
        <FormField label="이미지"><input type="file" accept="image/*" onChange={e => void image(e.target.files?.[0])}/>{form.image_url && <img className="admin-preview" src={form.image_url} alt="일정 미리보기"/>}</FormField>
        <FormField label="공개"><input type="checkbox" checked={Boolean(form.is_visible)} onChange={e => setForm(v => ({ ...v, is_visible: e.target.checked }))}/></FormField>
        <div className="form-actions span-all"><button className="admin-primary" disabled={busy}>{editingId ? '수정 저장' : '일정 추가'}</button>{editingId && <button className="admin-secondary" type="button" onClick={() => { setEditingId(undefined); setForm(empty) }}>취소</button>}</div>
      </form>
    </AdminPanel>

    <AdminPanel title={`${month.getFullYear()}년 ${month.getMonth()+1}월 일정`} actions={<div className="calendar-actions"><button onClick={() => setMonth(v => new Date(v.getFullYear(), v.getMonth()-1, 1))}>←</button><button onClick={() => setMonth(new Date())}>오늘</button><button onClick={() => setMonth(v => new Date(v.getFullYear(), v.getMonth()+1, 1))}>→</button></div>}>
      <div className="admin-schedule-list">{items.length ? items.map(item => <article key={item.id}>
        <div className="admin-schedule-date"><strong>{formatDate(item.schedule_date)}</strong><span>{formatTime(item.start_time)}</span></div>
        <div className="admin-schedule-main"><span className="category-pill" style={{ '--event': item.category?.color || '#9389DE' } as CSSProperties}>{item.category?.name || '기타'}</span><h3>{item.title}</h3><small>{item.is_visible ? '공개' : '비공개'}</small></div>
        <div className="admin-row-actions"><button onClick={() => { setEditingId(item.id); setForm({ ...item, start_time: item.start_time?.slice(0,5) || '', end_time: item.end_time?.slice(0,5) || '' }); window.scrollTo({top:0, behavior:'smooth'}) }}>수정</button><button onClick={() => void duplicate(item)}>복제</button><button className="danger" onClick={() => void remove(item.id)}>삭제</button></div>
      </article>) : <p className="admin-empty">이 달에 등록된 일정이 없습니다.</p>}</div>
    </AdminPanel>
  </>
}
