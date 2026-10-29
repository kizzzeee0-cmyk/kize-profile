import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { AppIcon, type AppIconName } from './AppIcon'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, adminLoading, isAdmin } = useAuth()
  if (loading || adminLoading) return <div className="admin-center">로그인 정보를 확인하는 중...</div>
  if (!isAdmin) return <Navigate to="/admin/" replace />
  return <>{children}</>
}

const groups: Array<{ title: string; links: Array<[string, string, AppIconName]> }> = [
  { title: '기본 정보', links: [
    ['/admin/dashboard', '대시보드', 'home'],
    ['/admin/profile', '프로필 · 시그니처', 'profile'],
  ]},
  { title: '콘텐츠 관리', links: [
    ['/admin/schedule', '일정 관리', 'calendar'],
    ['/admin/songs', '노래책 관리', 'music'],
    ['/admin/wardrobe', '옷장 관리', 'wardrobe'],
    ['/admin/milestones', '남라의 여정', 'crown'],
    ['/admin/archive', '클립 · 다시보기', 'play'],
    ['/admin/upbo', '업보 관리', 'upbo'],
  ]},
  { title: '사이트 설정', links: [
    ['/admin/texts', '문구 관리', 'edit'],
    ['/admin/navigation', '메뉴 · 링크', 'external'],
    ['/admin/settings', '사이트 설정', 'settings'],
  ]},
]

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { signOut, user } = useAuth()
  const location = useLocation()
  const pageName = useMemo(() => groups.flatMap(group => group.links).find(([path]) => location.pathname.startsWith(path))?.[1] || '관리자', [location.pathname])

  return <div className="admin-shell admin-redesign">
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
      <div className="admin-logo"><strong>유남라</strong><small>CONTENT MANAGER</small></div>
      <nav className="admin-nav-groups">
        {groups.map(group => <section key={group.title}><span>{group.title}</span>{group.links.map(([to, label, icon]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><AppIcon name={icon} /><em>{label}</em></NavLink>)}</section>)}
      </nav>
      <div className="admin-account"><small>{user?.login || 'NAMRA ADMIN'}</small><button type="button" onClick={() => void signOut()}><AppIcon name="logout" /> 로그아웃</button></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar">
        <button className="admin-menu-toggle" type="button" onClick={() => setOpen(value => !value)} aria-label="관리자 메뉴"><AppIcon name="menu" /></button>
        <div><small>CONTENT MANAGER</small><strong>{pageName}</strong></div>
        <a href="/" target="_blank" rel="noopener noreferrer">공개 사이트 보기 <AppIcon name="external" /></a>
      </header>
      {open && <button className="admin-sidebar-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}
      <div className="admin-content">{children}</div>
    </div>
  </div>
}
