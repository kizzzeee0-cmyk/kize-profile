import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AppIcon } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, Modal, StatusMessage } from '../components/Ui'
import { fetchSchedules } from '../lib/data'
import { formatDate, formatShortDate, formatTime, getMonthGrid, monthLabel, toDateKey } from '../lib/dates'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { ScheduleItem } from '../types'

export default function SchedulePage() {
  const { data } = usePublicData()
  const t = makeTextGetter(data.siteTexts)
  const [month, setMonth] = useState(() => new Date())
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ScheduleItem | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const days = useMemo(() => getMonthGrid(month), [month])
  const today = useMemo(() => new Date(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const firstGrid = days[0]
      const lastGrid = days[days.length - 1]
      const upcomingEnd = new Date(today)
      upcomingEnd.setDate(today.getDate() + 14)
      const [monthItems, upcomingItems] = await Promise.all([
        fetchSchedules(toDateKey(firstGrid), toDateKey(lastGrid)),
        fetchSchedules(toDateKey(today), toDateKey(upcomingEnd)),
      ])
      const merged = new Map([...monthItems, ...upcomingItems].map(item => [item.id, item]))
      setItems(Array.from(merged.values()).sort((a, b) => `${a.schedule_date}${a.start_time || ''}`.localeCompare(`${b.schedule_date}${b.start_time || ''}`)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.')
    } finally { setLoading(false) }
  }, [days, today])

  useEffect(() => { void load() }, [load])

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const item of items) map.set(item.schedule_date, [...(map.get(item.schedule_date) || []), item])
    return map
  }, [items])

  const selectedItems = byDate.get(selectedDate) || []
  const upcomingEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 14)
    return d
  }, [today])
  const upcoming = items.filter(item => item.schedule_date >= toDateKey(today) && item.schedule_date <= toDateKey(upcomingEnd))
  const changeMonth = (amount: number) => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1))
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  return <div className="diary-page schedule-diary-page" style={{ '--calendar-title-size': String(data.settings?.calendar_event_title_size ?? 14) + 'px' } as CSSProperties}>
    <div className="diary-page-heading"><div><h1>{t('schedule_title', '일정')}</h1><small>{t('schedule_label', 'SCHEDULE')}</small></div></div>
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    {loading ? <LoadingBlocks /> : <section className="schedule-dashboard-grid">
      <div className="diary-card schedule-calendar-card">
        <div className="schedule-calendar-head">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달"><AppIcon name="chevron-left" /></button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달"><AppIcon name="chevron-right" /></button>
        </div>
        <div className="schedule-legend">{data.categories.map(cat => <span key={cat.id}><i style={{ background: cat.color }} />{cat.name}</span>)}</div>
        <div className="schedule-weekdays">{weekday.map(day => <span key={day}>{day}</span>)}</div>
        <div className="schedule-month-grid">
          {days.map(date => {
            const key = toDateKey(date)
            const dateItems = byDate.get(key) || []
            const sameMonth = date.getMonth() === month.getMonth()
            const isToday = key === toDateKey(today)
            const isSelected = key === selectedDate
            return <button type="button" className={`schedule-day ${sameMonth ? '' : 'outside'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} key={key} onClick={() => setSelectedDate(key)}>
              <span className="schedule-day-number">{date.getDate()}</span>
              <div className="schedule-day-events">
                {dateItems.slice(0, 3).map(item => <div className="schedule-cell-event" key={item.id} style={{ '--event': item.category?.color || '#A79BD9' } as CSSProperties}>
                  <span className="schedule-event-time">{formatTime(item.start_time) || '시간 미정'}</span>
                  <strong className="schedule-event-title">{item.title}</strong>
                </div>)}
                {dateItems.length > 3 && <small className="schedule-more">+{dateItems.length - 3}</small>}
              </div>
            </button>
          })}
        </div>
      </div>

      <aside className="schedule-right-column">
        <section className="diary-card schedule-side-card">
          <div className="schedule-side-title"><div><h2>{formatShortDate(selectedDate)} 일정</h2><small>SELECTED DAY</small></div><span>{selectedItems.length}개</span></div>
          <div className="schedule-selected-list">
            {selectedItems.length ? selectedItems.map(item => <button type="button" key={item.id} onClick={() => setSelected(item)}>
              <i style={{ background: item.category?.color || '#A79BD9' }} />
              <span>{formatTime(item.start_time) || '시간 미정'}</span>
              <strong>{item.title}</strong>
              <AppIcon name="chevron-right" />
            </button>) : <EmptyState>선택한 날짜에 등록된 일정이 없습니다.</EmptyState>}
          </div>
        </section>

        <section className="diary-card schedule-upcoming-side" id="upcoming">
          <div className="schedule-side-title"><div><h2>다가오는 일정</h2><small>UPCOMING</small></div></div>
          {upcoming.length ? <div className="schedule-upcoming-list">{upcoming.slice(0, 8).map(item => <button type="button" key={item.id} onClick={() => setSelected(item)}>
            <time>{formatShortDate(item.schedule_date)}</time><span>{formatTime(item.start_time) || '-'}</span><strong>{item.title}</strong>
          </button>)}</div> : <EmptyState>다가오는 일정이 없습니다.</EmptyState>}
        </section>
      </aside>
    </section>}

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="일정 상세">
      {selected && <div className="schedule-detail diary-schedule-detail">
        <div className="detail-date">{formatDate(selected.schedule_date)} · {formatTime(selected.start_time)}{selected.end_time ? ` ~ ${formatTime(selected.end_time)}` : ''}</div>
        <h2>{selected.title}</h2>
        {selected.category && <span className="category-pill" style={{ '--event': selected.category.color } as CSSProperties}>{selected.category.name}</span>}
        {selected.description && <p>{selected.description}</p>}
        {selected.participants && <dl><dt>참여자</dt><dd>{selected.participants}</dd></dl>}
        {selected.note && <dl><dt>비고</dt><dd>{selected.note}</dd></dl>}
        {selected.image_url && <img className="detail-image" src={selected.image_url} alt="일정 관련 이미지" />}
        {selected.related_url && <a className="admin-primary inline" href={selected.related_url} target="_blank" rel="noopener noreferrer">관련 링크 열기 <AppIcon name="external" /></a>}
      </div>}
    </Modal>
  </div>
}
