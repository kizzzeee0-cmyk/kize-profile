import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EmptyState, LoadingBlocks, Modal, SectionHeading, StatusMessage } from '../components/Ui'
import { fetchSchedules } from '../lib/data'
import { formatDate, formatShortDate, formatTime, getMonthGrid, monthLabel, toDateKey } from '../lib/dates'
import { usePublicData } from '../lib/PublicDataContext'
import { isSupabaseConfigured } from '../lib/supabase'
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
  const days = useMemo(() => getMonthGrid(month), [month])
  const today = useMemo(() => new Date(), [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setItems([]); return }
    setLoading(true)
    try {
      const firstGrid = days[0]
      const lastGrid = days[days.length - 1]
      const upcomingEnd = new Date(today)
      upcomingEnd.setDate(today.getDate() + 6)
      const [monthItems, weekItems] = await Promise.all([
        fetchSchedules(toDateKey(firstGrid), toDateKey(lastGrid)),
        fetchSchedules(toDateKey(today), toDateKey(upcomingEnd)),
      ])
      const merged = new Map([...monthItems, ...weekItems].map(item => [item.id, item]))
      setItems(Array.from(merged.values()).sort((a, b) => `${a.schedule_date}${a.start_time || ''}`.localeCompare(`${b.schedule_date}${b.start_time || ''}`)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.')
    } finally { setLoading(false) }
  }, [days, today])

  useEffect(() => { void load() }, [load])

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const item of items) {
      const list = map.get(item.schedule_date) || []
      list.push(item)
      map.set(item.schedule_date, list)
    }
    return map
  }, [items])

  const upcoming = useMemo(() => {
    const start = toDateKey(today)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 6)
    const end = toDateKey(endDate)
    return items.filter(x => x.schedule_date >= start && x.schedule_date <= end)
  }, [items, today])

  const changeMonth = (amount: number) => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1))
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const eventTitleSize = Math.min(20, Math.max(8, Number(data.settings?.calendar_event_title_size ?? 12)))

  return <section className="section-pad page-top schedule-page">
    <div className="container">
      <SectionHeading eyebrow={t('schedule_label', 'SCHEDULE')} title={t('schedule_title', '방송 일정')} />
      {!isSupabaseConfigured && <StatusMessage>Supabase 연결 전 미리보기 상태입니다. 관리자 CMS를 연결하면 등록한 일정이 이곳에 표시됩니다.</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <div className="calendar-toolbar">
        <button className="month-arrow" type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">←</button>
        <div className="calendar-month-center"><h2>{monthLabel(month)}</h2></div>
        <button className="month-arrow" type="button" onClick={() => changeMonth(1)} aria-label="다음 달">→</button>
      </div>

      <div className="legend" aria-label="일정 카테고리">
        {data.categories.map(cat => <span key={cat.id} style={{ '--category': cat.color } as CSSProperties}><i style={{ background: cat.color }} />{cat.name}</span>)}
      </div>

      {loading ? <LoadingBlocks /> : <div className="calendar-shell" style={{ '--calendar-event-title-size': `${eventTitleSize}px` } as CSSProperties}>
        <div className="calendar-inner">
          <div className="weekday-row">{weekday.map(day => <div key={day}>{day}</div>)}</div>
          <div className="calendar-grid">
            {days.map(date => {
              const key = toDateKey(date)
              const dateItems = byDate.get(key) || []
              const sameMonth = date.getMonth() === month.getMonth()
              const isToday = key === toDateKey(today)
              return <div className={`day-cell ${sameMonth ? '' : 'outside'} ${isToday ? 'today' : ''}`} key={key}>
                <div className="day-number">{date.getDate()}</div>
                <div className="day-events">
                  {dateItems.map(item => <button type="button" className="event-chip" style={{ '--event': item.category?.color || '#9389DE' } as CSSProperties} key={item.id} onClick={() => setSelected(item)}>
                    <span className="event-time">{formatTime(item.start_time)}</span><strong className="event-title">{item.title}</strong>
                  </button>)}
                </div>
              </div>
            })}
          </div>
        </div>
      </div>}

      <div className="upcoming-block">
        <SectionHeading eyebrow={t('schedule_upcoming_label', 'UPCOMING SCHEDULES')} title={t('schedule_upcoming_title', '다가오는 일정')} />
        {upcoming.length ? <div className="upcoming-table-wrap"><table className="upcoming-table"><thead><tr><th>날짜</th><th>시간</th><th>종류</th><th>일정</th></tr></thead><tbody>
          {upcoming.map(item => <tr key={item.id} onClick={() => setSelected(item)}><td>{formatShortDate(item.schedule_date)}</td><td>{formatTime(item.start_time)}</td><td><span className="category-pill" style={{ '--event': item.category?.color || '#9389DE' } as CSSProperties}>{item.category?.name || '기타'}</span></td><td>{item.title}</td></tr>)}
        </tbody></table></div> : <EmptyState>{t('schedule_empty', '이번 주에 등록된 일정이 없습니다.')}</EmptyState>}
      </div>
    </div>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="SCHEDULE DETAILS">
      {selected && <div className="schedule-detail">
        <div className="detail-date">{formatDate(selected.schedule_date)} · {formatTime(selected.start_time)}{selected.end_time ? ` ~ ${formatTime(selected.end_time)}` : ''}</div>
        <h2>{selected.title}</h2>
        {selected.category && <span className="category-pill" style={{ '--event': selected.category.color } as CSSProperties}>{selected.category.name}</span>}
        {selected.description && <p>{selected.description}</p>}
        {selected.participants && <dl><dt>참여자</dt><dd>{selected.participants}</dd></dl>}
        {selected.note && <dl><dt>비고</dt><dd>{selected.note}</dd></dl>}
        {selected.image_url && <img className="detail-image" src={selected.image_url} alt="일정 관련 이미지" />}
        {selected.related_url && <a className="primary-button inline" href={selected.related_url} target="_blank" rel="noopener noreferrer">관련 링크 열기 ↗</a>}
      </div>}
    </Modal>
  </section>
}
