import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

export default function AdminLoginPage() {
  const { isAdmin, signIn } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isAdmin) return <Navigate to="/admin/dashboard" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await signIn(password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <a className="login-brand" href="/">유남라</a>
        <span className="login-eyebrow">CONTENT MANAGER</span>
        <h1>관리자 로그인</h1>
        <p>지정한 관리자 비밀번호를 입력해 주세요.</p>

        {error && <div className="admin-notice error">{error}</div>}

        <form className="admin-form" onSubmit={submit}>
          <label className="form-field">
            <span>관리자 비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          <button className="admin-primary full" type="submit" disabled={busy}>
            {busy ? '확인 중...' : '로그인'}
          </button>
        </form>

        <small className="login-help">
          Cloudflare에 지정한 관리자 비밀번호 하나만 사용합니다.
        </small>
      </div>
    </div>
  )
}
