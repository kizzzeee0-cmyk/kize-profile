import { json } from '../_lib/http.js'
import { githubConfig } from '../_lib/github.js'
import { legacySupabaseConfig } from '../_lib/legacy-supabase.js'
import { readStore } from '../_lib/store.js'

export async function onRequestGet({ env }) {
  const github = githubConfig(env)
  const legacy = legacySupabaseConfig(env)
  let migrationPending = null
  try {
    const data = await readStore(env)
    migrationPending = data.meta?.migration_pending === true
  } catch {}

  return json({
    ok: true,
    storage: 'github-json',
    configured: {
      admin_password: Boolean(env.ADMIN_PASSWORD),
      session_secret: Boolean(env.SESSION_SECRET || env.ADMIN_PASSWORD),
      github_token: Boolean(github.token),
    },
    repository: `${github.owner}/${github.repo}`,
    branch: github.branch,
    migration_pending: migrationPending,
    legacy_supabase_available_for_import: legacy.configured,
  })
}
