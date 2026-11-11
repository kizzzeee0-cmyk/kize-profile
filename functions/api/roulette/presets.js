import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic, readStore } from '../../_lib/store.js'
import { bearerToken, verifyHashedToken } from '../../_lib/secret.js'
import { ensureUpboOperationalData, upsertObservedPreset } from '../../_lib/upbo.js'

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}))
    const snapshot = await readStore(env)
    const settings = ensureUpboOperationalData(snapshot)
    const token = bearerToken(request)
    if (!(await verifyHashedToken(token, settings.receiver_token_hash))) return json({ error: '수신기 인증에 실패했습니다.' }, 401)

    const rouletteName = String(body.roulette_name || '').trim()
    const items = Array.isArray(body.items) ? body.items : []
    if (!rouletteName) return json({ error: 'roulette_name이 필요합니다.' }, 400)

    const atomic = await mutateStoreAtomic(env, data => {
      const current = ensureUpboOperationalData(data)
      const row = upsertObservedPreset(data, rouletteName, items, body.observed_at || new Date().toISOString())
      if (body.request_id && String(body.request_id) === String(current.preset_refresh_request_id || '')) {
        current.preset_refresh_request_id = ''
      }
      current.updated_at = new Date().toISOString()
      return row
    }, '[CF-Pages-Skip] Save observed Weflab roulette preset')

    return json({ ok: true, preset: atomic.result })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
