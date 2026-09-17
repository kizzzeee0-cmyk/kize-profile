import { EmptyState, LoadingBlocks, SectionHeading, StatusMessage } from '../components/Ui'
import { usePublicData } from '../lib/PublicDataContext'
import { formatDate } from '../lib/dates'
import { isSupabaseConfigured } from '../lib/supabase'
import { makeTextGetter } from '../lib/text'

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
  const start = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate())
  const days = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return days < 0 ? null : `D+${days}`
}

export default function HomePage() {
  const { data, loading, error } = usePublicData()
  const { profile } = data
  const t = makeTextGetter(data.siteTexts)
  const shortcutLinks = data.socialLinks.filter(link => /팬카페|soop|방송국|youtube|유튜브/i.test(link.name))
  const extraLinks = data.socialLinks.filter(link => !shortcutLinks.some(item => item.id === link.id))
  const signatureSlots = Array.from({ length: Math.max(6, Math.min(12, data.signatures.length || 0)) }, (_, index) => data.signatures[index] ?? null)

  if (loading) return <div className="container page-space"><LoadingBlocks /></div>

  return (
    <>
      <section className="hero section-pad">
        <div className="container">
          {!isSupabaseConfigured && <StatusMessage>{t('preview_notice', '현재는 미리보기 데이터입니다. Supabase를 연결하면 관리자 CMS의 데이터로 자동 전환됩니다.')}</StatusMessage>}
          {error && <StatusMessage tone="error">{error}</StatusMessage>}
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow-row">
                <span>SINCE {profile?.since_date ? profile.since_date.replaceAll('-', '. ') : 'YYYY. MM. DD'}</span>
                <i />
                <span>{profile?.badge_text || 'SOOP STREAMER'}</span>
              </div>
              <h1><span className="hero-name-ko">{profile?.korean_name || '키제'}</span><small>{profile?.english_name || 'KIZE'}</small></h1>
              <p className="hero-intro">{profile?.intro || t('home_intro_fallback', '프로필 소개 문구를 관리자 페이지에서 입력해 주세요.')}</p>

              {shortcutLinks.length > 0 && <div className="shortcut-grid">
                {shortcutLinks.map(link => {
                  const kind = /youtube|유튜브/i.test(link.name) ? 'youtube' : /팬카페/i.test(link.name) ? 'fan' : 'soop'
                  const displayName = kind === 'youtube' ? 'YouTube' : kind === 'fan' ? '공식 팬카페' : 'SOOP 방송국'
                  return <a className={`shortcut-card ${kind}`} key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">
                    <span>{link.icon || '↗'}</span><strong>{displayName}</strong>
                  </a>
                })}
              </div>}

              {!!extraLinks.length && <div className="social-row">
                {extraLinks.map(link => <a className="outline-button" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"><span>{link.icon || '↗'}</span>{link.name}</a>)}
              </div>}
            </div>
            <div className="hero-art" aria-label="프로필 이미지 영역">
              <div className="orb orb-one"/><div className="orb orb-two"/>
              {profile?.profile_image_url ? <img src={profile.profile_image_url} alt={`${profile.korean_name} 프로필`} /> : (
                <div className="profile-placeholder"><span>{t('profile_image_label', 'PROFILE IMAGE')}</span><strong>{profile?.english_name || 'KIZE'}</strong><small>{t('profile_image_help', '프로필 이미지를 업로드해 주세요')}</small></div>
              )}
            </div>
          </div>

          <div className="stat-grid four-stats">
            {data.stats
              .filter(stat => ['birthday', 'debut', 'livetime', 'offday'].includes(stat.label.toLowerCase().replace(/[^a-z]/g, '')))
              .slice(0, 4)
              .map(stat => {
                const key = stat.label.toLowerCase().replace(/[^a-z]/g, '')
                const badge = key === 'birthday' ? birthdayCountdown(stat.value) : key === 'debut' ? debutElapsed(stat.value) : null
                return <article className="stat-card" key={stat.id}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  {badge ? <div className="stat-badge">{badge}</div> : stat.description && <p>{stat.description}</p>}
                </article>
              })}
          </div>

          <div className="home-profile-sections signature-only">
            <section className="signature-section">
              <div className="mini-section-heading signature-heading"><span>{t('home_signature_label', 'SIGNATURE')}</span><h2>{t('home_signature_title', '시그니처 풍선')}</h2></div>
              <div className="signature-grid">
                {signatureSlots.map((item, index) => <article className="signature-card" key={item?.id || `signature-slot-${index}`}>
                  {item?.image_url ? <img src={item.image_url} alt={item.title || `Signature ${index + 1}`} /> : <div className="signature-placeholder"><span>Signature {String(index + 1).padStart(2, '0')}</span></div>}
                </article>)}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="section-pad" id="milestone">
        <div className="container narrow">
          <SectionHeading eyebrow={t('home_milestone_label', 'MILESTONE')} title={t('home_milestone_title', '키제의 여정')} />
          {data.milestones.length ? <div className="timeline">{data.milestones.map(item => <article className={`timeline-item ${item.is_highlight ? 'highlight' : ''}`} key={item.id}>
            <div className="timeline-date">{formatDate(item.date)}</div><div className="timeline-dot"/><div className="timeline-content"><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.external_url && <a href={item.external_url} target="_blank" rel="noopener noreferrer">{t('home_milestone_link', '관련 링크 ↗')}</a>}</div>
          </article>)}</div> : <EmptyState>{t('home_milestone_empty', '아직 등록된 여정이 없습니다.')}</EmptyState>}
        </div>
      </section>

      <section className="section-pad soft-section" id="archive">
        <div className="container">
          <SectionHeading eyebrow={t('home_archive_label', 'ARCHIVE')} title={t('home_archive_title', '클립 및 다시보기')} />
          {data.archives.length ? <div className="archive-grid">{data.archives.map(item => {
            const thumb = item.thumbnail_url || (item.platform.toLowerCase().includes('youtube') ? youtubeThumb(item.video_url) : null)
            return <a className="archive-card" key={item.id} href={item.video_url} target="_blank" rel="noopener noreferrer"><div className="archive-thumb">{thumb ? <img src={thumb} alt={item.title} /> : <div className="archive-empty">{t('archive_no_image', 'NO IMAGE')}</div>}<span>{item.category}</span></div><div className="archive-copy"><small>{formatDate(item.date)} · {item.platform}</small><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></a>
          })}</div> : <EmptyState>{t('home_archive_empty', '등록된 아카이브가 없습니다.')}</EmptyState>}
        </div>
      </section>
    </>
  )
}
