export type SiteSettings = {
  id: string
  site_title: string
  site_description: string
  brand_color: string
  footer_text: string
  logo_text: string
  favicon_url: string | null
  seo_image_url: string | null
  dark_mode_enabled: boolean
  roulette_probability_url?: string | null
  calendar_event_title_size?: number | null
}

export type Profile = {
  id: string
  korean_name: string
  english_name: string
  since_date: string
  badge_text: string
  intro: string
  profile_image_url: string | null
  fandom_name: string | null
  fandom_character_name: string | null
  fandom_description: string | null
  fandom_image_url: string | null
}

export type ProfileStat = { id: string; label: string; value: string; description: string | null; sort_order: number; is_visible: boolean }
export type ProfileFeature = { id: string; icon: string; title: string; description: string; sort_order: number; is_visible: boolean }
export type SocialLink = { id: string; name: string; url: string; icon: string; sort_order: number; is_visible: boolean }
export type NavigationLink = { id: string; label: string; url: string; is_external: boolean; open_new_tab: boolean; sort_order: number; is_visible: boolean }
export type Milestone = { id: string; date: string; title: string; description: string | null; image_url: string | null; external_url: string | null; is_highlight: boolean; sort_order: number; is_visible: boolean }
export type ArchiveItem = { id: string; date: string; title: string; category: string; description: string | null; video_url: string; platform: string; thumbnail_url: string | null; is_featured: boolean; sort_order: number; is_visible: boolean }
export type ScheduleCategory = { id: string; name: string; color: string; sort_order: number; is_visible: boolean }
export type ScheduleItem = { id: string; title: string; schedule_date: string; start_time: string | null; end_time: string | null; category_id: string | null; description: string | null; participants: string | null; related_url: string | null; image_url: string | null; note: string | null; is_visible: boolean; created_at?: string; category?: ScheduleCategory | null }
export type SignatureItem = { id: string; image_url: string; title: string | null; sort_order: number; is_visible: boolean }

export type SongItem = { id: string; title: string; artist: string; song_key: string | null; genre: string; note: string | null; sort_order: number; is_visible: boolean }

export type SiteText = {
  id: string
  text_key: string
  label: string
  value: string
  group_name: string
  sort_order: number
}

export type WardrobeItem = {
  id: string
  name: string
  period_type: 'monthly' | 'existing'
  item_type: 'outfit' | 'hair'
  image_url: string | null
  description: string | null
  sort_order: number
  is_visible: boolean
}

export type UpboPerson = {
  id: string
  soop_name: string
  soop_id: string
  profile_image_url: string | null
  note: string | null
  sort_order: number
  is_visible: boolean
}

export type UpboResult = {
  id: string
  person_id: string
  result_label: string
  quantity: number
  note: string | null
  sort_order: number
  created_at?: string
}

export type PublicData = {
  settings: SiteSettings | null
  profile: Profile | null
  stats: ProfileStat[]
  features: ProfileFeature[]
  socialLinks: SocialLink[]
  navigationLinks: NavigationLink[]
  milestones: Milestone[]
  archives: ArchiveItem[]
  categories: ScheduleCategory[]
  siteTexts: SiteText[]
  signatures: SignatureItem[]
}
