import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, type AppIconName } from '../components/AppIcon'
import { EmptyState, LoadingBlocks, Modal, StatusMessage } from '../components/Ui'
import { fetchSchedules } from '../lib/data'
import { formatDate, formatShortDate, formatTime, toDateKey } from '../lib/dates'
import { usePublicData } from '../lib/PublicDataContext'
import { makeTextGetter } from '../lib/text'
import type { ScheduleItem, SignatureItem } from '../types'

function youtubeThumb(url: string) {
  try {
    const parsed = new URL(url)
    const id = parsed.hostname.includes('youtu.be') ? parsed.pathname.slice(1) : parsed.searchParams.get('v')
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
  } catch { return null }
}

function parseNumbers(value: string) {
  return value.match(/\d+/g)?.map(Number) ?? []
}

function birthdayCountdown(value: string) {
  const nums = parseNumbers(value)
  if (nums.length < 2) return null
  const [month, day] = nums
  if (!month || !day || month > 12 || day > 31) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(now.getFullYear(), month - 1, day)
  if (next < today) next = new Date(now.getFullYear() + 1, month - 1, day)
  const days = Math.round((next.getTime() - today.getTime()) / 86400000)
  return days === 0 ? 'D-DAY' : `D-${days}`
}

function debutElapsed(value: string) {
  const nums = parseNumbers(value)
  if (nums.length < 3) return null
  const [year, month, day] = nums
  if (!year || !month || !day) return null
  const debut = new Date(year, month - 1, day)
  if (Number.isNaN(debut.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((today.getTime() - new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()).getTime()) / 86400000)
  return days < 0 ? null : `D+${days}`
}

function SectionTitle({ icon, eyebrow, title, action }: { icon?: AppIconName; eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="diary-section-title">
    <div>{icon && <span className="diary-title-icon"><AppIcon name={icon} /></span>}<div><h2>{title}</h2><small>{eyebrow}</small></div></div>
    {action}
  </div>
}

function weekStartOf(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function statIcon(label: string, index: number): AppIconName {
  const key = label.toLowerCase()
  if (/birth|생일/.test(key)) return 'cake'
  if (/debut|데뷔/.test(key)) return 'sprout'
  if (/live|방송/.test(key)) return 'clock'
  if (/off|휴방/.test(key)) return 'calendar'
  return (['cake', 'sprout', 'clock', 'calendar'] as AppIconName[])[index % 4]
}

function statLabel(label: string) {
  const key = label.toLowerCase()
  if (/birth/.test(key)) return '생일'
  if (/debut/.test(key)) return '데뷔일'
  if (/live/.test(key)) return '생방송 시간'
  if (/off/.test(key)) return '휴방 일정'
  return label
}

export default function HomePage() {
  const { data, loading, error } = usePublicData()
  const { profile } = data
  const t = makeTextGetter(data.siteTexts)
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([])
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [selectedSignature, setSelectedSignature] = useState<SignatureItem | null>(null)
  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => weekStartOf(today), [today])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + index)
    return d
  }), [weekStart])

  useEffect(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    fetchSchedules(toDateKey(weekStart), toDateKey(end))
      .then(setWeekItems)
      .catch(e => setScheduleError(e instanceof Error ? e.message : '이번 주 일정을 불러오지 못했습니다.'))
  }, [weekStart])

  const social = data.socialLinks
  const heroLinks = [
    { key: 'fan', label: '팬카페', icon: 'cafe' as AppIconName, item: social.find(link => /팬카페|cafe/i.test(link.name)) },
    { key: 'soop', label: '방송국', icon: 'broadcast' as AppIconName, item: social.find(link => /soop|방송국/i.test(link.name)) },
    { key: 'youtube', label: '유튜브', icon: 'youtube' as AppIconName, item: social.find(link => /youtube|유튜브/i.test(link.name)) },
  ].filter(entry => entry.item)

  const heroStyle = {
    '--hero-x': `${profile?.hero_position_x ?? 70}%`,
    '--hero-y': `${profile?.hero_position_y ?? 50}%`,
    '--hero-mobile-x': `${profile?.hero_mobile_position_x ?? 72}%`,
    '--hero-mobile-y': `${profile?.hero_mobile_position_y ?? 50}%`,
    '--hero-overlay': String(profile?.hero_overlay_strength ?? 0.72),
  } as CSSProperties

  const statRows = data.stats.slice(0, 4)
  const weekMap = new Map<string, ScheduleItem[]>()
  weekItems.forEach(item => weekMap.set(item.schedule_date, [...(weekMap.get(item.schedule_date) || []), item]))

  if (loading) return <div className="diary-page"><LoadingBlocks /></div>

  return <div className="diary-page home-diary-page">
    {(error || scheduleError) && <StatusMessage tone="error">{error || scheduleError}</StatusMessage>}

    <section className={`home-photo-hero text-${profile?.hero_text_position || 'left'}`} style={heroStyle}>
      {profile?.profile_image_url ? <img className="home-photo-hero-image" src={profile.profile_image_url} alt={`${profile.korean_name} 프로필`} /> : <div className="home-photo-placeholder"><AppIcon name="image" /><span>관리자에서 16:9 메인 이미지를 등록해 주세요.</span></div>}
      <div className="home-photo-overlay" />
      <div className="home-photo-copy">
        <div className="home-name-row"><h1>{profile?.korean_name || '유남라'}</h1></div>
        <small className="home-english-name">{profile?.english_name || 'NAMRA'}</small>
        <p>{profile?.intro || '좋아하는 것을 기록하는 작은 공간, 함께 즐겁게 이야기해요.'}</p>
        {heroLinks.length > 0 && <div className="home-social-buttons">
          {heroLinks.map(link => <a key={link.key} href={link.item!.url} target="_blank" rel="noopener noreferrer"><AppIcon name={link.icon} /><span>{link.label}</span></a>)}
        </div>}
      </div>
    </section>

    <section className="home-stat-grid">
      {statRows.length ? statRows.map((stat, index) => {
        const key = stat.label.toLowerCase()
        const badge = /birth|생일/.test(key) ? birthdayCountdown(stat.value) : /debut|데뷔/.test(key) ? debutElapsed(stat.value) : null
        return <article className={`home-stat-card tone-${index + 1}`} key={stat.id}>
          <span className="home-stat-icon"><AppIcon name={statIcon(stat.label, index)} /></span>
          <div><small>{statLabel(stat.label)}</small><strong>{stat.value}</strong>{badge && <em>{badge}</em>}{!badge && stat.description && <p>{stat.description}</p>}</div>
        </article>
      }) : <EmptyState>프로필 기본 정보를 등록해 주세요.</EmptyState>}
    </section>

    <section className="diary-card home-week-card" id="weekly">
      <SectionTitle icon="calendar" eyebrow="WEEKLY SCHEDULE" title="이번 주 일정표" action={<a className="soft-link-button" href="/schedule/">전체 일정 보기 <AppIcon name="chevron-right" /></a>} />
      <div className="home-week-list">
        {weekDays.map(day => {
          const key = toDateKey(day)
          const items = weekMap.get(key) || []
          const isToday = key === toDateKey(today)
          return <div className={`home-week-day ${isToday ? 'today' : ''}`} key={key}>
            <div className="home-week-date"><span>{['일','월','화','수','목','금','토'][day.getDay()]}</span><strong>{day.getDate()}</strong></div>
            <div className="home-week-events">{items.length ? items.map(item => <div className={`home-week-event ${/휴방/.test(item.category?.name || '') ? 'is-off' : ''}`} key={item.id} style={{ '--event': item.category?.color || '#A79BD9' } as CSSProperties}>
              <small>{item.category?.name || '기타'}</small><span>{formatTime(item.start_time) || '시간 미정'}</span><strong>{item.title}</strong>
            </div>) : <small className="home-week-empty">일정 없음</small>}</div>
          </div>
        })}
      </div>
    </section>

    <section className="diary-card signature-section" id="signature">
      <SectionTitle icon="heart" eyebrow="SIGNATURE BALLOONS" title={t('home_signature_title', '시그니처 풍선')} />
      {data.signatures.length ? <div className="signature-diary-grid">
        {data.signatures.map(item => <button type="button" className="signature-diary-card" key={item.id} onClick={() => setSelectedSignature(item)}>
          <img src={item.image_url} alt={item.title || '시그니처 풍선'} loading="lazy" />
          <div><strong>{item.title || '시그니처 풍선'}</strong>{item.description && <p>{item.description}</p>}{item.important_info && <em>{item.important_info}</em>}</div>
        </button>)}
      </div> : <EmptyState>등록된 시그니처 풍선이 없습니다.</EmptyState>}
    </section>

    <section className="diary-card archive-section" id="archive">
      <SectionTitle icon="play" eyebrow="CLIP & REPLAY" title={t('home_archive_title', '클립 및 다시보기')} />
      {data.archives.length ? <div className="archive-diary-grid">{data.archives.map(item => {
        const thumb = item.thumbnail_url || (item.platform.toLowerCase().includes('youtube') ? youtubeThumb(item.video_url) : null)
        return <a className="archive-diary-card" key={item.id} href={item.video_url} target="_blank" rel="noopener noreferrer">
          <div className="archive-diary-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : <div><AppIcon name="play" /></div>}<span>{item.category}</span></div>
          <div className="archive-diary-copy"><small>{formatShortDate(item.date)} · {item.platform}</small><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
        </a>
      })}</div> : <EmptyState>{t('home_archive_empty', '등록된 클립 및 다시보기가 없습니다.')}</EmptyState>}
    </section>

    <section className="diary-card journey-section" id="milestone">
      <SectionTitle icon="crown" eyebrow="MILESTONE" title={t('home_milestone_title', '남라의 여정')} />
      {data.milestones.length ? <div className="journey-timeline">{data.milestones.map(item => <article className={item.is_highlight ? 'highlight' : ''} key={item.id}>
        <div className="journey-line"><i /></div>
        <div className="journey-content"><time>{formatDate(item.date)}</time><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer">관련 링크 <AppIcon name="external" /></a>}</div>
      </article>)}</div> : <EmptyState>{t('home_milestone_empty', '아직 등록된 여정이 없습니다.')}</EmptyState>}
    </section>

    <Modal open={Boolean(selectedSignature)} onClose={() => setSelectedSignature(null)} title={selectedSignature?.title || '시그니처 풍선'}>
      {selectedSignature && <img className="signature-modal-image" src={selectedSignature.image_url} alt={selectedSignature.title || '시그니처 풍선 크게 보기'} />}
    </Modal>
  </div>
}
