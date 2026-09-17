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
import { isSupabaseConfigured, supabase } from './supabase'
import { demoData } from './demo'

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

export async function fetchPublicData(): Promise<PublicData> {
  if (!isSupabaseConfigured || !supabase) return demoData

  const [
    settingsRes,
    profileRes,
    statsRes,
    featuresRes,
    socialsRes,
    navRes,
    milestoneRes,
    archiveRes,
    categoryRes,
    textsRes,
    signaturesRes,
  ] = await Promise.all([
    supabase.from('site_settings').select('*').limit(1).maybeSingle(),
    supabase.from('profile').select('*').limit(1).maybeSingle(),
    supabase.from('profile_stats').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('profile_features').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('social_links').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('navigation_links').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('milestones').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('archives').select('*').eq('is_visible', true).order('date', { ascending: false }).order('sort_order'),
    supabase.from('schedule_categories').select('*').eq('is_visible', true).order('sort_order'),
    supabase.from('site_texts').select('*').order('group_name').order('sort_order'),
    supabase.from('signature_items').select('*').eq('is_visible', true).order('sort_order'),
  ])

  const errors = [
    settingsRes.error, profileRes.error, statsRes.error, featuresRes.error, socialsRes.error,
    navRes.error, milestoneRes.error, archiveRes.error, categoryRes.error, textsRes.error, signaturesRes.error,
  ].filter(Boolean)
  if (errors.length) throw errors[0]

  return {
    settings: settingsRes.data as SiteSettings | null,
    profile: profileRes.data as Profile | null,
    stats: (statsRes.data ?? []) as ProfileStat[],
    features: (featuresRes.data ?? []) as ProfileFeature[],
    socialLinks: (socialsRes.data ?? []) as SocialLink[],
    navigationLinks: (navRes.data ?? []) as NavigationLink[],
    milestones: (milestoneRes.data ?? []) as Milestone[],
    archives: (archiveRes.data ?? []) as ArchiveItem[],
    categories: (categoryRes.data ?? []) as ScheduleCategory[],
    siteTexts: (textsRes.data ?? []) as SiteText[],
    signatures: (signaturesRes.data ?? []) as SignatureItem[],
  }
}

export async function fetchSchedules(startDate: string, endDate: string, includeHidden = false): Promise<ScheduleItem[]> {
  const sb = requireSupabase()
  let query = sb.from('schedules').select('*, category:schedule_categories(*)').gte('schedule_date', startDate).lte('schedule_date', endDate).order('schedule_date').order('start_time')
  if (!includeHidden) query = query.eq('is_visible', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ScheduleItem[]
}

export async function fetchAdminTable<T>(table: string, orderBy = 'sort_order'): Promise<T[]> {
  const sb = requireSupabase()
  let query = sb.from(table).select('*')
  if (orderBy) query = query.order(orderBy)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as T[]
}

export async function fetchAdminSingleton<T>(table: string): Promise<T | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from(table).select('*').limit(1).maybeSingle()
  if (error) throw error
  return data as T | null
}

export async function saveRow(table: string, values: Record<string, unknown>, id?: string) {
  const sb = requireSupabase()
  const payload = { ...values }
  delete payload.id
  delete payload.created_at
  delete payload.updated_at
  delete payload.category
  if (id) {
    const { data, error } = await sb.from(table).update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await sb.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteRow(table: string, id: string) {
  const sb = requireSupabase()
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function uploadImage(file: File, folder: string) {
  const sb = requireSupabase()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const safeName = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await sb.storage.from('site-media').upload(safeName, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  const { data } = sb.storage.from('site-media').getPublicUrl(safeName)
  return data.publicUrl
}

export async function fetchSongs(includeHidden = false): Promise<SongItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    const { demoSongs } = await import('./demo')
    return [...demoSongs]
  }
  let query = supabase.from('songs').select('*').order('genre').order('sort_order').order('title')
  if (!includeHidden) query = query.eq('is_visible', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as SongItem[]
}

export async function fetchWardrobe(includeHidden = false): Promise<WardrobeItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    const { demoWardrobe } = await import('./demo')
    return [...demoWardrobe]
  }
  let query = supabase.from('wardrobe_items').select('*').order('period_type').order('item_type').order('sort_order').order('name')
  if (!includeHidden) query = query.eq('is_visible', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WardrobeItem[]
}

export async function fetchUpboPeople(includeHidden = false): Promise<UpboPerson[]> {
  if (!isSupabaseConfigured || !supabase) {
    const { demoUpboPeople } = await import('./demo')
    return [...demoUpboPeople]
  }
  let query = supabase.from('upbo_people').select('*').order('sort_order').order('soop_name')
  if (!includeHidden) query = query.eq('is_visible', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as UpboPerson[]
}

export async function fetchUpboResults(): Promise<UpboResult[]> {
  if (!isSupabaseConfigured || !supabase) {
    const { demoUpboResults } = await import('./demo')
    return [...demoUpboResults]
  }
  const { data, error } = await supabase.from('upbo_results').select('*').order('sort_order').order('created_at')
  if (error) throw error
  return (data ?? []) as UpboResult[]
}
