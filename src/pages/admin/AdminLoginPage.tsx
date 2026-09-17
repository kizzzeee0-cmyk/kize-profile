import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function AdminLoginPage() {
  const { user, isAdmin, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user && isAdmin) return <Navigate to="/admin/dashboard" replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try { await signIn(email, password); navigate('/admin/dashboard') }
    catch (err) { setError(err instanceof Error ? err.message : '로그인에 실패했습니다.') }
    finally { setBusy(false) }
  }

  return <div className="login-page">
    <div className="login-card">
      <a className="login-brand" href="/">KIZE</a>
      <span className="login-eyebrow">CONTENT MANAGER</span>
      <h1>관리자 로그인</h1>
      <p>프로필, 일정, Milestone, Archive와 외부 링크를 관리합니다.</p>
      {!isSupabaseConfigured && <div className="admin-notice error">먼저 .env에 Supabase URL과 Publishable Key를 설정해 주세요.</div>}
      {error && <div className="admin-notice error">{error}</div>}
      <form className="admin-form" onSubmit={submit}>
        <label className="form-field"><span>이메일</span><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="form-field"><span>비밀번호</span><input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="admin-primary full" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? '로그인 중...' : '로그인'}</button>
      </form>
      <small className="login-help">관리자 계정은 Supabase Authentication에서 생성한 뒤 admin_profiles에 등록합니다.</small>
    </div>
  </div>
}
