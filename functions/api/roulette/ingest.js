import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic, readStore } from '../../_lib/store.js'
import { bearerToken, verifyHashedToken } from '../../_lib/secret.js'
import { ensureUpboOperationalData, processRouletteEvent } from '../../_lib/upbo.js'

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}))
    const snapshot = await readStore(env)
    const settings = ensureUpboOperationalData(snapshot)
    const token = bearerToken(request)
    if (!(await verifyHashedToken(token, settings.receiver_token_hash))) return json({ error: '수신기 인증에 실패했습니다.' }, 401)

    const events = Array.isArray(body.events) ? body.events : [body.event || body]
    if (!events.length || events.length > 50) return json({ error: '한 번에 1~50개의 이벤트만 처리할 수 있습니다.' }, 400)

    const atomic = await mutateStoreAtomic(env, data => {
      const current = ensureUpboOperationalData(data)
      const results = events.map(event => processRouletteEvent(data, event, { testMode: Boolean(body.test_mode) }))
      current.last_receiver_heartbeat = new Date().toISOString()
      current.receiver_monitoring = true
      if (typeof body.websocket_connected === 'boolean') current.receiver_websocket_connected = body.websocket_connected
      if (body.source_verified === true) current.source_verified = true
      current.receiver_state = current.receiver_websocket_connected ? 'receiving' : current.receiver_state
      current.receiver_error = ''
      current.updated_at = new Date().toISOString()
      return results.map(result => ({
        duplicate: result.duplicate,
        id: result.event.id,
        status: result.event.status,
        applied_quantity: result.event.applied_quantity,
        reason: result.event.reason || '',
      }))
    }, body.test_mode ? '[CF-Pages-Skip] Record Weflab test events' : '[CF-Pages-Skip] Apply Weflab roulette events')

    return json({ ok: true, results: atomic.result })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
