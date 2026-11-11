import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic, readStore, saveRowInStore } from '../../_lib/store.js'
import { encryptSecret, hashToken, randomToken } from '../../_lib/secret.js'
import { ensureUpboOperationalData, markUpboUpdated } from '../../_lib/upbo.js'

function safeSettings(row) {
  return {
    id: row.id,
    desired_enabled: Boolean(row.desired_enabled),
    auto_register: Boolean(row.auto_register),
    alert_url_configured: Boolean(row.alert_url_encrypted),
    receiver_token_configured: Boolean(row.receiver_token_hash),
    receiver_token_created_at: row.receiver_token_created_at || null,
    last_receiver_heartbeat: row.last_receiver_heartbeat || null,
    receiver_monitoring: Boolean(row.receiver_monitoring),
    receiver_websocket_connected: Boolean(row.receiver_websocket_connected),
    receiver_state: row.receiver_state || 'waiting',
    receiver_error: row.receiver_error || '',
    bridge_version: row.bridge_version || '',
    source_verified: Boolean(row.source_verified),
    last_event_at: row.last_event_at || null,
    last_test_requested_at: row.last_test_requested_at || null,
    last_test_ack_at: row.last_test_ack_at || null,
    preset_refresh_requested_at: row.preset_refresh_requested_at || null,
    updated_at: row.updated_at || null,
  }
}

function normalizeAliases(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean)
}

function validateWeflabUrl(value) {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'https:') throw Object.assign(new Error('위플랩 후원 알림 URL은 https 주소만 저장할 수 있습니다.'), { status: 400 })
  const host = url.hostname.toLowerCase()
  if (!(host === 'weflab.com' || host.endsWith('.weflab.com'))) {
    throw Object.assign(new Error('weflab.com 도메인의 후원 알림 URL만 저장할 수 있습니다.'), { status: 400 })
  }
  return url.toString()
}

export async function onRequestGet({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const data = await readStore(env)
    const settings = ensureUpboOperationalData(data)
    const presets = [...data.weflab_presets].sort((a, b) => String(b.observed_at || '').localeCompare(String(a.observed_at || '')))
    const mappings = [...data.weflab_mappings].sort((a, b) =>
      String(a.roulette_name || '').localeCompare(String(b.roulette_name || ''), 'ko') ||
      String(a.source_item_name || '').localeCompare(String(b.source_item_name || ''), 'ko')
    )
    const events = [...data.weflab_events]
      .sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')))
      .slice(0, 120)

    return json({ settings: safeSettings(settings), presets, mappings, events })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}

export async function onRequestPost({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'save_settings') {
      let encryptedUrl
      if (String(body.alert_url || '').trim()) {
        encryptedUrl = await encryptSecret(env, validateWeflabUrl(body.alert_url))
      }

      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        if (encryptedUrl !== undefined) settings.alert_url_encrypted = encryptedUrl
        if (typeof body.auto_register === 'boolean') settings.auto_register = body.auto_register
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Save Weflab integration settings')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'clear_alert_url') {
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        settings.alert_url_encrypted = ''
        settings.desired_enabled = false
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Clear Weflab alert URL')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'rotate_receiver_token') {
      const token = randomToken(32)
      const tokenHash = await hashToken(token)
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        settings.receiver_token_hash = tokenHash
        settings.receiver_token_created_at = new Date().toISOString()
        settings.last_receiver_heartbeat = null
        settings.receiver_state = 'waiting'
        settings.source_verified = false
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Rotate Weflab receiver token')
      return json({ ok: true, token, settings: atomic.result })
    }

    if (action === 'set_enabled') {
      const enabled = Boolean(body.enabled)
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        if (enabled && !settings.alert_url_encrypted) throw Object.assign(new Error('먼저 위플랩 후원 알림 URL을 저장해 주세요.'), { status: 400 })
        if (enabled && !settings.receiver_token_hash) throw Object.assign(new Error('먼저 수신기 인증키를 생성해 주세요.'), { status: 400 })
        settings.desired_enabled = enabled
        settings.receiver_state = enabled ? 'waiting' : 'stopped'
        settings.receiver_error = ''
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, enabled ? '[CF-Pages-Skip] Enable Weflab integration' : '[CF-Pages-Skip] Disable Weflab integration')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'set_auto_register') {
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        settings.auto_register = Boolean(body.enabled)
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Toggle Weflab auto upbo')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'request_connection_test') {
      const challenge = randomToken(12)
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        if (!settings.receiver_token_hash) throw Object.assign(new Error('수신기 인증키를 먼저 생성해 주세요.'), { status: 400 })
        settings.last_test_challenge = challenge
        settings.last_test_requested_at = new Date().toISOString()
        settings.last_test_ack_at = null
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Request Weflab receiver connection test')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'request_preset_refresh') {
      const requestId = randomToken(12)
      const atomic = await mutateStoreAtomic(env, data => {
        const settings = ensureUpboOperationalData(data)
        settings.preset_refresh_request_id = requestId
        settings.preset_refresh_requested_at = new Date().toISOString()
        settings.updated_at = new Date().toISOString()
        return safeSettings(settings)
      }, '[CF-Pages-Skip] Request Weflab preset refresh')
      return json({ ok: true, settings: atomic.result })
    }

    if (action === 'save_mapping') {
      const atomic = await mutateStoreAtomic(env, data => {
        ensureUpboOperationalData(data)
        const rouletteName = String(body.roulette_name || '').trim()
        const sourceItemName = String(body.source_item_name || '').trim()
        const upboItemId = String(body.upbo_item_id || '').trim()
        if (!rouletteName || !sourceItemName) throw Object.assign(new Error('룰렛 이름과 위플랩 당첨 항목명은 필수입니다.'), { status: 400 })
        if (upboItemId && !data.upbo_items.some(row => String(row.id) === upboItemId)) {
          throw Object.assign(new Error('연결할 업보 항목을 찾지 못했습니다.'), { status: 400 })
        }

        const now = new Date().toISOString()
        const id = String(body.id || '').trim()
        let row = id ? data.weflab_mappings.find(item => String(item.id) === id) : null
        if (!row) {
          row = { id: crypto.randomUUID(), created_at: now }
          data.weflab_mappings.push(row)
        }
        Object.assign(row, {
          roulette_name: rouletteName,
          source_item_name: sourceItemName,
          aliases: normalizeAliases(body.aliases),
          upbo_item_id: upboItemId || null,
          enabled: Boolean(body.enabled),
          quantity: Math.max(1, Math.min(100, Number.parseInt(body.quantity, 10) || 1)),
          updated_at: now,
        })
        return row
      }, '[CF-Pages-Skip] Save Weflab roulette mapping')
      return json({ ok: true, mapping: atomic.result })
    }

    if (action === 'create_upbo_item_and_map') {
      const atomic = await mutateStoreAtomic(env, data => {
        ensureUpboOperationalData(data)
        const rouletteName = String(body.roulette_name || '').trim()
        const sourceItemName = String(body.source_item_name || '').trim()
        const itemName = String(body.upbo_item_name || sourceItemName).trim()
        if (!rouletteName || !sourceItemName || !itemName) throw Object.assign(new Error('룰렛/당첨 항목/업보 항목 이름을 확인해 주세요.'), { status: 400 })

        const existingItem = data.upbo_items.find(item => String(item.name || '').trim().toLocaleLowerCase() === itemName.toLocaleLowerCase())
        const upboItem = existingItem || saveRowInStore(data, 'upbo_items', {
          name: itemName,
          note: '',
          sort_order: data.upbo_items.length + 1,
          is_visible: true,
        })

        const now = new Date().toISOString()
        const mapping = {
          id: crypto.randomUUID(),
          roulette_name: rouletteName,
          source_item_name: sourceItemName,
          aliases: [],
          upbo_item_id: upboItem.id,
          enabled: true,
          quantity: 1,
          created_at: now,
          updated_at: now,
        }
        data.weflab_mappings.push(mapping)
        markUpboUpdated(data, now)
        return { mapping, upbo_item: upboItem }
      }, '[CF-Pages-Skip] Create upbo item from Weflab mapping')
      return json({ ok: true, ...atomic.result })
    }

    if (action === 'delete_mapping') {
      const id = String(body.id || '')
      const atomic = await mutateStoreAtomic(env, data => {
        ensureUpboOperationalData(data)
        const before = data.weflab_mappings.length
        data.weflab_mappings = data.weflab_mappings.filter(row => String(row.id) !== id)
        if (before === data.weflab_mappings.length) throw Object.assign(new Error('매핑을 찾지 못했습니다.'), { status: 404 })
        return true
      }, '[CF-Pages-Skip] Delete Weflab mapping')
      return json({ ok: true, deleted: atomic.result })
    }

    return json({ error: '지원하지 않는 작업입니다.' }, 400)
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
