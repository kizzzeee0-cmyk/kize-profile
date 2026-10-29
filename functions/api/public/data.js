import { json, errorJson } from '../../_lib/http.js'
import { githubConfig } from '../../_lib/github.js'
import { importLegacySupabase } from '../../_lib/legacy-supabase.js'
import { publicStore, readStore, writeStore } from '../../_lib/store.js'

export async function onRequestGet({ env }) {
  try {
    let data = await readStore(env)

    if (data.meta?.migration_pending === true) {
      const migrated = await importLegacySupabase(env, data)
      if (migrated) {
        data = migrated
        if (githubConfig(env).token) {
          await writeStore(env, data, '[CF-Pages-Skip] Import existing Supabase content into GitHub JSON')
        }
      }
    }

    return json({ data: publicStore(data) }, 200, { 'Cache-Control': 'no-store' })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
