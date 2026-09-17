import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

type AuthValue = {
  session: Session | null
  user: User | null
  loading: boolean
  adminLoading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
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
    async signIn(email, password) {
      if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 연결이 필요합니다.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
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
