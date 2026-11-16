import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { AppIcon } from '../../components/AppIcon'
import { Modal } from '../../components/Ui'
import { deleteRow, fetchAdminTable, fetchSchedules, saveRow, uploadImage } from '../../lib/data'
import { formatDate, formatTime, getMonthGrid, monthLabel, toDateKey } from '../../lib/dates'
import type { ScheduleCategory, ScheduleItem } from '../../types'

const emptySchedule = (date = toDateKey(new Date())) => ({
  title: '',
  schedule_date: date,
  start_time: '',
  end_time: '',
  category_id: '',
  description: '',
  participants: '',
  related_url: '',
  image_url: '',
  note: '',
  is_visible: true,
})

export default function AdminSchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [categories, setCategories] = useState<ScheduleCategory[]>([])
  const [form, setForm] = useState<Record<string, any>>(() => emptySchedule())
  const [editingId, setEditingId] = useState<string | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => getMonthGrid(month), [month])
  const range = useMemo(() => [toDateKey(days[0]), toDateKey(days[days.length - 1])] as const, [days])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [schedules, cats] = await Promise.all([
        fetchSchedules(range[0], range[1], true),
        fetchAdminTable<ScheduleCategory>('schedule_categories', 'sort_order'),
      ])
      setItems(schedules)
      setCategories(cats)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const item of items) {
      map.set(item.schedule_date, [...(map.get(item.schedule_date) || []), item])
    }
    return map
  }, [items])

  function openNew(date = toDateKey(new Date())) {
    setEditingId(undefined)
    setForm(emptySchedule(date))
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(item: ScheduleItem) {
    setEditingId(item.id)
    setForm({
      ...item,
      start_time: item.start_time?.slice(0, 5) || '',
      end_time: item.end_time?.slice(0, 5) || '',
    })
    setError(null)
    setEditorOpen(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const payload = {
        ...form,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        category_id: form.category_id || null,
        image_url: form.image_url || null,
        related_url: form.related_url || null,
      }
      await saveRow('schedules', payload, editingId)
      setMessage(editingId ? '일정을 수정했습니다.' : '일정을 추가했습니다.')
      setEditorOpen(false)
      setEditingId(undefined)
      setForm(emptySchedule(form.schedule_date || toDateKey(new Date())))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await deleteRow('schedules', id)
      setMessage('일정을 삭제했습니다.')
      setEditorOpen(false)
      setEditingId(undefined)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  async function image(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, 'schedule')
      setForm(value => ({ ...value, image_url: url }))
      setMessage('이미지가 업로드되었습니다. 저장 버튼을 눌러 적용해 주세요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  return <>
    <div className="admin-page-title admin-schedule-page-title">
      <div>
        <span>SCHEDULE CMS</span>
        <h1>일정 관리</h1>
        <p>사이트와 같은 달력에서 날짜나 일정을 바로 선택해 수정합니다.</p>
      </div>
      <button className="admin-primary" type="button" onClick={() => openNew()}>+ 새 일정</button>
    </div>

    {message && <Notice>{message}</Notice>}
    {error && <Notice error>{error}</Notice>}

    <AdminPanel
      title="일정 달력"
      description="빈 날짜를 더블클릭하거나 + 버튼을 누르면 새 일정을 추가할 수 있습니다. 등록된 일정은 클릭하면 바로 수정됩니다."
    >
      <div className="admin-schedule-calendar">
        <div className="schedule-calendar-head">
          <button type="button" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))} aria-label="이전 달"><AppIcon name="chevron-left" /></button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))} aria-label="다음 달"><AppIcon name="chevron-right" /></button>
        </div>
        <div className="admin-schedule-today-row"><button className="admin-secondary compact" type="button" onClick={() => setMonth(new Date())}>오늘로 이동</button></div>
        <div className="schedule-legend">
          {categories.filter(category => category.is_visible !== false).map(category => <span key={category.id}><i style={{ background: category.color }} />{category.name}</span>)}
        </div>

        <div className="schedule-weekdays">{weekday.map(day => <span key={day}>{day}</span>)}</div>

        <div className="schedule-month-grid">
          {days.map(date => {
            const key = toDateKey(date)
            const dateItems = byDate.get(key) || []
            const sameMonth = date.getMonth() === month.getMonth()
            const isToday = key === toDateKey(new Date())
            return <div
              className={'schedule-day admin-schedule-day ' + (sameMonth ? '' : 'outside ') + (isToday ? 'today' : '')}
              key={key}
              onDoubleClick={() => openNew(key)}
            >
              <span className="schedule-day-number">{date.getDate()}</span>
              <button
                className="admin-calendar-add"
                type="button"
                aria-label={formatDate(key) + ' 일정 추가'}
                title="일정 추가"
                onClick={e => { e.stopPropagation(); openNew(key) }}
              >+</button>
              <div className="schedule-day-events">
                {dateItems.map(item => <button
                  type="button"
                  className={'schedule-cell-event admin-schedule-event ' + (item.is_visible ? '' : 'is-hidden')}
                  key={item.id}
                  style={{ '--event': item.category?.color || '#A79BD9' } as CSSProperties}
                  onClick={e => { e.stopPropagation(); openEdit(item) }}
                  onDoubleClick={e => e.stopPropagation()}
                  title={item.title + ' · 클릭해서 수정'}
                >
                  {item.start_time && <small>{formatTime(item.start_time)}</small>}
                  <strong className="schedule-event-title">{item.title}</strong>
                  {!item.is_visible && <em>비공개</em>}
                </button>)}
              </div>
            </div>
          })}
        </div>
      </div>
    </AdminPanel>

    <Modal
      open={editorOpen}
      onClose={() => { if (!busy) setEditorOpen(false) }}
      title={editingId ? '일정 수정' : '일정 추가'}
    >
      <form className="admin-form two-col admin-schedule-editor" onSubmit={submit}>
        <FormField label="일정 이름"><input required autoFocus value={form.title || ''} onChange={e => setForm(value => ({ ...value, title: e.target.value }))}/></FormField>
        <FormField label="날짜"><input required type="date" value={form.schedule_date || ''} onChange={e => setForm(value => ({ ...value, schedule_date: e.target.value }))}/></FormField>
        <FormField label="시작 시간"><input type="time" value={form.start_time || ''} onChange={e => setForm(value => ({ ...value, start_time: e.target.value }))}/></FormField>
        <FormField label="종료 시간"><input type="time" value={form.end_time || ''} onChange={e => setForm(value => ({ ...value, end_time: e.target.value }))}/></FormField>
        <FormField label="카테고리">
          <select value={form.category_id || ''} onChange={e => setForm(value => ({ ...value, category_id: e.target.value }))}>
            <option value="">기타 / 미지정</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </FormField>
        <FormField label="참여자"><input value={form.participants || ''} onChange={e => setForm(value => ({ ...value, participants: e.target.value }))}/></FormField>
        <FormField label="상세 설명"><textarea value={form.description || ''} onChange={e => setForm(value => ({ ...value, description: e.target.value }))}/></FormField>
        <FormField label="비고"><textarea value={form.note || ''} onChange={e => setForm(value => ({ ...value, note: e.target.value }))}/></FormField>
        <FormField label="관련 URL"><input type="url" value={form.related_url || ''} onChange={e => setForm(value => ({ ...value, related_url: e.target.value }))}/></FormField>
        <FormField label="이미지">
          <input type="file" accept="image/*" onChange={e => void image(e.target.files?.[0])}/>
          {form.image_url && <img className="admin-preview" src={form.image_url} alt="일정 미리보기"/>}
        </FormField>
        <FormField label="사이트 공개"><input type="checkbox" checked={Boolean(form.is_visible)} onChange={e => setForm(value => ({ ...value, is_visible: e.target.checked }))}/></FormField>

        <div className="form-actions span-all admin-schedule-editor-actions">
          {editingId && <button className="admin-secondary danger" type="button" disabled={busy} onClick={() => void remove(editingId)}>삭제</button>}
          <span />
          <button className="admin-secondary" type="button" disabled={busy} onClick={() => setEditorOpen(false)}>취소</button>
          <button className="admin-primary" disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
        </div>
      </form>
    </Modal>
  </>
}
