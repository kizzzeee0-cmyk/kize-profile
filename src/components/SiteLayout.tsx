import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { usePublicData } from '../lib/PublicDataContext'
import { useTheme } from '../lib/ThemeContext'
import { AppIcon, type AppIconName } from './AppIcon'

const menuMeta: Record<string, { label: string; icon: AppIconName }> = {
  '/': { label: '프로필', icon: 'profile' },
  '/schedule/': { label: '일정', icon: 'calendar' },
  '/songs/': { label: '노래책', icon: 'music' },
  '/roulette/': { label: '옷장', icon: 'wardrobe' },
  '/work/': { label: '업보', icon: 'upbo' },
}

function normalizePath(url: string) {
  if (url === '/') return '/'
  const base = url.split('?')[0].split('#')[0]
  return base.endsWith('/') ? base : `${base}/`
}

function PublicNavigation({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { data } = usePublicData()
  const defaults = Object.entries(menuMeta).map(([url, meta], index) => ({
    id: url,
    label: meta.label,
    url,
    sort_order: index + 1,
  }))

  const nav = useMemo(() => {
    const allowed = new Set(Object.keys(menuMeta))
    const saved = data.navigationLinks
      .filter(item => !item.is_external && allowed.has(normalizePath(item.url)))
      .map(item => ({ ...item, url: normalizePath(item.url) }))
    const source = saved.length ? saved : defaults
    return source
      .filter(item => menuMeta[normalizePath(item.url)])
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
  }, [data.navigationLinks])

  return <nav className={mobile ? 'public-mobile-nav' : 'public-side-nav'} aria-label="주요 메뉴">
    {nav.map(item => {
      const path = normalizePath(item.url)
      const meta = menuMeta[path]
      return <NavLink key={item.id} to={path} end={path === '/'} onClick={onNavigate}>
        <AppIcon name={meta.icon} />
        <span>{meta.label}</span>
      </NavLink>
    })}
  </nav>
}

function Sidebar() {
  const { data } = usePublicData()
  const { theme, toggleTheme } = useTheme()
  const name = data.profile?.korean_name || '유남라'
  const social = data.socialLinks.slice(0, 4)

  return <aside className="public-sidebar">
    <Link className="public-logo" to="/" aria-label="프로필 홈">{name}</Link>
    <PublicNavigation />
    <div className="public-sidebar-bottom">
      {social.length > 0 && <div className="public-social-icons">
        {social.map(link => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.name}>
          <AppIcon name={/youtube|유튜브/i.test(link.name) ? 'youtube' : /팬카페|cafe/i.test(link.name) ? 'cafe' : 'external'} />
        </a>)}
      </div>}
      {data.settings?.dark_mode_enabled !== false && <button className="public-theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
        {theme === 'dark' ? '라이트 모드' : '다크 모드'}
      </button>}
    </div>
  </aside>
}

function MobileHeader() {
  const { data } = usePublicData()
  const [open, setOpen] = useState(false)
  const name = data.profile?.korean_name || '유남라'

  return <header className="public-mobile-header">
    <Link className="public-mobile-logo" to="/" onClick={() => setOpen(false)}>{name}</Link>
    <button className="public-mobile-menu-button" type="button" aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <AppIcon name={open ? 'close' : 'menu'} />
    </button>
    {open && <div className="public-mobile-menu-panel"><PublicNavigation mobile onNavigate={() => setOpen(false)} /></div>}
  </header>
}

function Footer() {
  const { data } = usePublicData()
  return <footer className="public-footer">{data.settings?.footer_text || '© 2026 NAMRA. ALL RIGHTS RESERVED.'}</footer>
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <div className="public-shell">
    <Sidebar />
    <MobileHeader />
    <div className="public-main">
      <main>{children}</main>
      <Footer />
    </div>
  </div>
}
