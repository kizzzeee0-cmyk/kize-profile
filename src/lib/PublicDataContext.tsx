import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PublicData } from '../types'
import { fetchPublicData } from './data'

type PublicDataValue = {
  data: PublicData
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const empty: PublicData = {
  settings: null,
  profile: null,
  stats: [],
  features: [],
  socialLinks: [],
  navigationLinks: [],
  milestones: [],
  archives: [],
  categories: [],
  siteTexts: [],
  signatures: [],
}

const PublicDataContext = createContext<PublicDataValue | null>(null)

export function PublicDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PublicData>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchPublicData())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  const value = useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh])
  return <PublicDataContext.Provider value={value}>{children}</PublicDataContext.Provider>
}

export function usePublicData() {
  const value = useContext(PublicDataContext)
  if (!value) throw new Error('usePublicData must be used inside PublicDataProvider')
  return value
}
