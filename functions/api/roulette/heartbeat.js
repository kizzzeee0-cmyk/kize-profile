import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic, readStore } from '../../_lib/store.js'
import { bearerToken, verifyHashedToken } from '../../_lib/secret.js'
import { ensureUpboOperationalData } from '../../_lib/upbo.js'

function sameState(settings, body) {
  return Boolean(settings.receiver_monitoring) === Boolean(body.monitoring) &&
    Boolean(settings.receiver_websocket_connected) === Boolean(body.websocket_connected) &&
    String(settings.receiver_state || '') === String(body.state || '') &&
    String(settings.receiver_error || '') === String(body.error || '') &&
    String(settings.bridge_version || '') === String(body.bridge_version || '') &&
    Boolean(settings.source_verified) === Boolean(body.source_verified)
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}))
    const snapshot = await readStore(env)
    const current = ensureUpboOperationalData(snapshot)
    const token = bearerToken(request)
    if (!(await verifyHashedToken(token, current.receiver_token_hash))) return json({ error: '수신기 인증에 실패했습니다.' }, 401)

    const now = Date.now()
    const lastHeartbeat = current.last_receiver_heartbeat ? new Date(current.last_receiver_heartbeat).getTime() : 0
    const challengeAck = body.challenge && String(body.challenge) === String(current.last_test_challenge || '')
    const shouldPersist = !sameState(current, body) || challengeAck || !lastHeartbeat || now - lastHeartbeat > 10 * 60 * 1000

    if (!shouldPersist) return json({ ok: true, persisted: false })

    const atomic = await mutateStoreAtomic(env, data => {
      const settings = ensureUpboOperationalData(data)
      settings.last_receiver_heartbeat = new Date().toISOString()
      settings.receiver_monitoring = Boolean(body.monitoring)
      settings.receiver_websocket_connected = Boolean(body.websocket_connected)
      settings.receiver_state = String(body.state || (body.websocket_connected ? 'receiving' : 'waiting'))
      settings.receiver_error = String(body.error || '')
      settings.bridge_version = String(body.bridge_version || '')
      settings.source_verified = Boolean(body.source_verified)
      if (challengeAck && String(body.challenge) === String(settings.last_test_challenge || '')) {
        settings.last_test_ack_at = new Date().toISOString()
      }
      settings.updated_at = new Date().toISOString()
      return {
        receiver_state: settings.receiver_state,
        last_receiver_heartbeat: settings.last_receiver_heartbeat,
        last_test_ack_at: settings.last_test_ack_at,
      }
    }, '[CF-Pages-Skip] Weflab receiver heartbeat')

    return json({ ok: true, persisted: true, ...atomic.result })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
