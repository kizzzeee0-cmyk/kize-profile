const TABLES = [
  'site_settings', 'profile', 'profile_stats', 'profile_features', 'social_links',
  'navigation_links', 'milestones', 'archives', 'schedule_categories', 'schedules',
  'site_texts', 'signature_items', 'songs', 'wardrobe_items', 'upbo_people', 'upbo_results',
]

export function legacySupabaseConfig(env) {
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '')
  const secret = String(env.SUPABASE_SECRET_KEY || '')
  const publishable = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '')
  return { url, key: secret || publishable, configured: Boolean(url && (secret || publishable)), elevated: Boolean(secret) }
}

async function readTable(env, table) {
  const { url, key } = legacySupabaseConfig(env)
  const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(`${table}: ${payload?.message || response.status}`)
  return Array.isArray(payload) ? payload : []
}

export async function importLegacySupabase(env, fallbackStore) {
  const config = legacySupabaseConfig(env)
  if (!config.configured) return null

  const next = JSON.parse(JSON.stringify(fallbackStore || {}))
  const imported = []
  const failed = []

  await Promise.all(TABLES.map(async table => {
    try {
      next[table] = await readTable(env, table)
      imported.push(table)
    } catch (error) {
      failed.push({ table, error: error instanceof Error ? error.message : String(error) })
      if (!Array.isArray(next[table])) next[table] = []
    }
  }))

  next.meta = {
    ...(next.meta || {}),
    version: 1,
    storage: 'github-json',
    migration_pending: false,
    migrated_from: 'supabase',
    migrated_at: new Date().toISOString(),
    migration_mode: config.elevated ? 'server-secret' : 'public-visible',
    imported_tables: imported.sort(),
    failed_tables: failed,
  }

  return next
}
