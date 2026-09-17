import { useState, type ReactNode } from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, adminLoading, user, isAdmin } = useAuth()
  if (loading || adminLoading) return <div className="admin-center">로그인 정보를 확인하는 중...</div>
  if (!user) return <Navigate to="/admin/" replace />
  if (!isAdmin) return <div className="admin-center"><div><h2>관리자 권한이 없습니다.</h2><p>Supabase의 admin_profiles 테이블에 현재 계정을 등록해 주세요.</p></div></div>
  return <>{children}</>
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { signOut, user } = useAuth()
  const links = [
    ['/admin/dashboard', 'Dashboard'], ['/admin/profile', '프로필'], ['/admin/schedule', '일정'], ['/admin/songs', '노래책'], ['/admin/wardrobe', '룰렛 / 옷장'], ['/admin/upbo', '업보'], ['/admin/milestones', 'Milestone'], ['/admin/archive', 'Archive'], ['/admin/texts', '문구 관리'], ['/admin/navigation', '메뉴 / 링크'], ['/admin/settings', '사이트 설정'],
  ]
  return <div className="admin-shell">
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
      <div className="admin-logo">KIZE<small>CONTENT MANAGER</small></div>
      <nav>{links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}</nav>
      <div className="admin-account"><small>{user?.email}</small><button type="button" onClick={() => void signOut()}>로그아웃</button></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><button type="button" onClick={() => setOpen(v => !v)}>☰</button><a href="/" target="_blank" rel="noopener noreferrer">공개 사이트 보기 ↗</a></header>
      <div className="admin-content">{children}</div>
    </div>
  </div>
}
