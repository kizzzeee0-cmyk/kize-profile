import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type AdminUser = { login: string }

type AuthValue = {
  user: AdminUser | null
  loading: boolean
  adminLoading: boolean
  isAdmin: boolean
  signIn: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || '요청을 처리하지 못했습니다.')
  return payload
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api<{ user: AdminUser }>('/api/admin/session')
      .then(data => { if (active) setUser(data.user) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    adminLoading: false,
    isAdmin: Boolean(user),
    async signIn(password) {
      await api<{ ok: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      const session = await api<{ user: AdminUser }>('/api/admin/session')
      setUser(session.user)
    },
    async signOut() {
      await api<{ ok: boolean }>('/auth/logout', { method: 'POST' }).catch(() => ({ ok: true }))
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
