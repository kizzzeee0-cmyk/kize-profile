import { useMemo, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { usePublicData } from '../lib/PublicDataContext'
import type { AppIconName } from './AppIcon'

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

function PublicNavigation() {
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

  return <nav className="public-top-nav" aria-label="주요 메뉴">
    {nav.map(item => {
      const path = normalizePath(item.url)
      return <NavLink key={item.id} to={path} end={path === '/'}>
        <span>{menuMeta[path].label}</span>
      </NavLink>
    })}
  </nav>
}

function Header() {
  const { data } = usePublicData()
  const name = data.profile?.english_name || 'NAMRA'

  return <header className="public-topbar">
    <div className="public-topbar-inner">
      <Link className="public-brand" to="/" aria-label="NAMRA 프로필 홈">{name}</Link>
      <PublicNavigation />
    </div>
  </header>
}

function Footer() {
  const { data } = usePublicData()
  return <footer className="public-footer"><div className="site-container">{data.settings?.footer_text || '© 2026 NAMRA. ALL RIGHTS RESERVED.'}</div></footer>
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <div className="public-shell">
    <Header />
    <main className="public-main">{children}</main>
    <Footer />
  </div>
}
