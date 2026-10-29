import type {
  ArchiveItem,
  Milestone,
  NavigationLink,
  Profile,
  ProfileFeature,
  ProfileStat,
  PublicData,
  ScheduleCategory,
  ScheduleItem,
  SiteSettings,
  SocialLink,
  SongItem,
  SiteText,
  WardrobeItem,
  UpboPerson,
  UpboResult,
  SignatureItem,
} from '../types'

type CmsStore = Record<string, any>

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `요청 실패 (${response.status})`)
  return payload
}

async function loadStore(admin = false): Promise<CmsStore> {
  const endpoint = admin ? '/api/admin/data' : '/api/public/data'
  try {
    const response = await fetch(`${endpoint}?t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
    })
    const payload = await responseJson<{ data: CmsStore }>(response)
    return payload.data || {}
  } catch (error) {
    if (admin) throw error
    const fallback = await fetch(`/site-data/data.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!fallback.ok) throw error
    return fallback.json() as Promise<CmsStore>
  }
}

function visible<T extends { is_visible?: boolean }>(rows: T[] = []) {
  return rows.filter(row => row.is_visible !== false)
}

function sortRows<T extends Record<string, any>>(rows: T[], key = 'sort_order') {
  if (!key) return [...rows]
  return [...rows].sort((a, b) => {
    if (key === 'date') return String(b.date || '').localeCompare(String(a.date || ''))
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'number' || typeof bv === 'number') return (Number(av) || 0) - (Number(bv) || 0)
    return String(av ?? '').localeCompare(String(bv ?? ''), 'ko')
  })
}

export async function fetchPublicData(): Promise<PublicData> {
  const store = await loadStore(false)
  return {
    settings: (store.site_settings?.[0] ?? null) as SiteSettings | null,
    profile: (store.profile?.[0] ?? null) as Profile | null,
    stats: sortRows(visible(store.profile_stats ?? [])) as ProfileStat[],
    features: sortRows(visible(store.profile_features ?? [])) as ProfileFeature[],
    socialLinks: sortRows(visible(store.social_links ?? [])) as SocialLink[],
    navigationLinks: sortRows(visible(store.navigation_links ?? [])) as NavigationLink[],
    milestones: sortRows(visible(store.milestones ?? [])) as Milestone[],
    archives: sortRows(visible(store.archives ?? [])) as ArchiveItem[],
    categories: sortRows(visible(store.schedule_categories ?? [])) as ScheduleCategory[],
    siteTexts: [...(store.site_texts ?? [])].sort((a, b) => String(a.group_name || '').localeCompare(String(b.group_name || ''), 'ko') || (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)) as SiteText[],
    signatures: sortRows(visible(store.signature_items ?? [])) as SignatureItem[],
  }
}

export async function fetchSchedules(startDate: string, endDate: string, includeHidden = false): Promise<ScheduleItem[]> {
  const store = await loadStore(includeHidden)
  const categories = new Map((store.schedule_categories ?? []).map((item: ScheduleCategory) => [item.id, item]))
  let rows = (store.schedules ?? []) as ScheduleItem[]
  if (!includeHidden) rows = visible(rows)
  return rows
    .filter(item => item.schedule_date >= startDate && item.schedule_date <= endDate)
    .map(item => ({ ...item, category: categories.get(item.category_id || '') ?? null }))
    .sort((a, b) => `${a.schedule_date}${a.start_time || ''}`.localeCompare(`${b.schedule_date}${b.start_time || ''}`))
}

export async function fetchAdminTable<T>(table: string, orderBy = 'sort_order'): Promise<T[]> {
  const store = await loadStore(true)
  return sortRows((store[table] ?? []) as Record<string, any>[], orderBy) as T[]
}

export async function fetchAdminSingleton<T>(table: string): Promise<T | null> {
  const store = await loadStore(true)
  return (store[table]?.[0] ?? null) as T | null
}

export async function saveRow(table: string, values: Record<string, unknown>, id?: string) {
  const response = await fetch('/api/admin/data', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save', table, values, id }),
  })
  const payload = await responseJson<{ row: Record<string, any> }>(response)
  return payload.row
}

export async function deleteRow(table: string, id: string) {
  const response = await fetch('/api/admin/data', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', table, id }),
  })
  await responseJson<{ ok: boolean }>(response)
}

export async function reorderRows(table: string, ids: string[]) {
  const response = await fetch('/api/admin/data', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', table, ids }),
  })
  const payload = await responseJson<{ rows: Record<string, any>[] }>(response)
  return payload.rows
}

export async function uploadImage(file: File, folder: string) {
  const form = new FormData()
  form.set('file', file)
  form.set('folder', folder)
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const payload = await responseJson<{ url: string }>(response)
  return payload.url
}

export async function fetchSongs(includeHidden = false): Promise<SongItem[]> {
  const store = await loadStore(includeHidden)
  let rows = (store.songs ?? []) as SongItem[]
  if (!includeHidden) rows = visible(rows)
  return [...rows].sort((a, b) => a.genre.localeCompare(b.genre, 'ko') || a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'ko'))
}

export async function fetchWardrobe(includeHidden = false): Promise<WardrobeItem[]> {
  const store = await loadStore(includeHidden)
  let rows = (store.wardrobe_items ?? []) as WardrobeItem[]
  if (!includeHidden) rows = visible(rows)
  return [...rows].sort((a, b) => a.period_type.localeCompare(b.period_type) || a.item_type.localeCompare(b.item_type) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'))
}

export async function fetchUpboPeople(includeHidden = false): Promise<UpboPerson[]> {
  const store = await loadStore(includeHidden)
  let rows = (store.upbo_people ?? []) as UpboPerson[]
  if (!includeHidden) rows = visible(rows)
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.soop_name.localeCompare(b.soop_name, 'ko'))
}

export async function fetchUpboResults(): Promise<UpboResult[]> {
  const store = await loadStore(false)
  return [...((store.upbo_results ?? []) as UpboResult[])].sort((a, b) => a.sort_order - b.sort_order || String(a.created_at || '').localeCompare(String(b.created_at || '')))
}
