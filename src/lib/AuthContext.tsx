import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

type AuthValue = {
  session: Session | null
  user: User | null
  loading: boolean
  adminLoading: boolean
  isAdmin: boolean
  signIn: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    async function checkAdmin() {
      if (active) setAdminLoading(Boolean(session?.user && supabase))
      if (!session?.user || !supabase) {
        if (active) { setIsAdmin(false); setAdminLoading(false) }
        return
      }
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (active) { setIsAdmin(Boolean(data && !error)); setAdminLoading(false) }
    }
    checkAdmin()
    return () => { active = false }
  }, [session])

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    adminLoading,
    isAdmin,
    async signIn(password) {
      if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 연결이 필요합니다.')

      try {
        const response = await fetch('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })

        if (response.ok) {
          const payload = await response.json() as { access_token?: string; refresh_token?: string }
          if (!payload.access_token || !payload.refresh_token) throw new Error('로그인 응답이 올바르지 않습니다.')
          const { data, error } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          })
          if (error) throw error
          setSession(data.session)
          return
        }

        if (response.status !== 404 && response.status !== 405) {
          const message = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(message?.error || '비밀번호가 올바르지 않습니다.')
        }
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
      }

      const localAdminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim()
      if (!localAdminEmail) throw new Error('배포 환경의 ADMIN_EMAIL 설정을 확인해 주세요.')
      const { data, error } = await supabase.auth.signInWithPassword({ email: localAdminEmail, password })
      if (error) throw new Error('비밀번호가 올바르지 않습니다.')
      setSession(data.session)
    },
    async signOut() {
      if (!supabase) return
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [session, loading, adminLoading, isAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
