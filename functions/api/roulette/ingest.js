import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic, readStore } from '../../_lib/store.js'
import { bearerToken, encryptSecret, hashToken, verifyHashedToken } from '../../_lib/secret.js'
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

    const atomic = await mutateStoreAtomic(env, async data => {
      const current = ensureUpboOperationalData(data)
      const results = []
      for (const event of events) {
        const sourceId = String(event?.source_event_id || '').trim()
        const bridgeId = String(event?.bridge_event_id || '').trim()
        const rawKey = sourceId ? 'source:' + sourceId : bridgeId ? 'bridge:' + bridgeId : ''
        const eventKeyHash = rawKey ? await hashToken(rawKey) : ''

        try {
          const result = processRouletteEvent(data, event, {
            testMode: Boolean(body.test_mode),
            eventKeyHash,
          })

          const row = result.event
          if (row.donor_soop_id) {
            row.donor_soop_id_encrypted = await encryptSecret(env, row.donor_soop_id)
            delete row.donor_soop_id
          }
          if (row.donor_display_name) {
            row.donor_display_name_encrypted = await encryptSecret(env, row.donor_display_name)
            delete row.donor_display_name
          }
          results.push(result)
        } catch (eventError) {
          const now = new Date().toISOString()
          const existingKey = eventKeyHash
            ? data.weflab_event_keys.find(row => row.event_key_hash === eventKeyHash)
            : null

          if (existingKey) {
            const duplicate = {
              id: crypto.randomUUID(),
              duplicate_of: existingKey.event_id || null,
              event_key_hash: eventKeyHash,
              roulette_name: String(event?.roulette_name || ''),
              item_name: String(event?.item_name || ''),
              applied_quantity: 0,
              status: 'duplicate',
              reason: '동일 오류 이벤트 ID 재수신',
              occurred_at: String(event?.occurred_at || now),
              received_at: now,
            }
            data.weflab_events.push(duplicate)
            results.push({ duplicate: true, event: duplicate })
            continue
          }

          const errorRow = {
            id: crypto.randomUUID(),
            duplicate_of: null,
            event_key_hash: eventKeyHash || null,
            roulette_name: String(event?.roulette_name || ''),
            item_name: String(event?.item_name || ''),
            source_count: Math.max(1, Number.parseInt(event?.count, 10) || 1),
            applied_quantity: 0,
            status: 'error',
            reason: eventError instanceof Error ? eventError.message : '이벤트 처리 오류',
            occurred_at: String(event?.occurred_at || now),
            received_at: now,
          }

          const donorId = String(event?.donor_soop_id || '').trim()
          const donorName = String(event?.donor_display_name || '').trim()
          if (donorId) errorRow.donor_soop_id_encrypted = await encryptSecret(env, donorId)
          if (donorName) errorRow.donor_display_name_encrypted = await encryptSecret(env, donorName)

          data.weflab_events.push(errorRow)
          if (eventKeyHash) data.weflab_event_keys.push({ event_key_hash: eventKeyHash, event_id: errorRow.id, created_at: now })
          results.push({ duplicate: false, event: errorRow })
        }

        if (data.weflab_events.length > 1200) data.weflab_events = data.weflab_events.slice(-1200)
        if (data.weflab_event_keys.length > 20000) data.weflab_event_keys = data.weflab_event_keys.slice(-20000)
      }
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
