import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { usePublicData } from '../lib/PublicDataContext'
import { useTheme } from '../lib/ThemeContext'

function Header() {
  const { data } = usePublicData()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const logo = data.settings?.logo_text || 'KIZE'
  const links = data.navigationLinks.length ? data.navigationLinks : [
    { id: 'profile', label: '프로필', url: '/', is_external: false, open_new_tab: false, sort_order: 1, is_visible: true },
    { id: 'schedule', label: '일정', url: '/schedule/', is_external: false, open_new_tab: false, sort_order: 2, is_visible: true },
    { id: 'songs', label: '노래책', url: '/songs/', is_external: false, open_new_tab: false, sort_order: 3, is_visible: true },
    { id: 'roulette', label: '룰렛', url: '/roulette/', is_external: false, open_new_tab: false, sort_order: 4, is_visible: true },
    { id: 'work', label: '업보', url: '/work/', is_external: false, open_new_tab: false, sort_order: 5, is_visible: true },
  ]

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link className="brand" to="/" onClick={() => setOpen(false)}>{logo}</Link>
        <button className="mobile-menu-button" type="button" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span /><span /><span />
        </button>
        <nav className={`nav-links ${open ? 'is-open' : ''}`} aria-label="주요 메뉴">
          {links.map((item) => item.is_external ? (
            <a key={item.id} href={item.url} target={item.open_new_tab ? '_blank' : undefined} rel={item.open_new_tab ? 'noopener noreferrer' : undefined} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ) : (
            <NavLink key={item.id} to={item.url} onClick={() => setOpen(false)}>{item.label}</NavLink>
          ))}
          {data.settings?.dark_mode_enabled !== false && (
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  const { data } = usePublicData()
  return <footer className="site-footer"><div className="container">{data.settings?.footer_text || '© 2026 KIZE. ALL RIGHTS RESERVED.'}</div></footer>
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <><Header /><main>{children}</main><Footer /></>
}
