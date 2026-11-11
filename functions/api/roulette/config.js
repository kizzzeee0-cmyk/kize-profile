import { json, errorJson } from '../../_lib/http.js'
import { readStore } from '../../_lib/store.js'
import { bearerToken, decryptSecret, verifyHashedToken } from '../../_lib/secret.js'
import { ensureUpboOperationalData } from '../../_lib/upbo.js'

export async function onRequestGet({ request, env }) {
  try {
    const data = await readStore(env)
    const settings = ensureUpboOperationalData(data)
    const token = bearerToken(request)
    if (!(await verifyHashedToken(token, settings.receiver_token_hash))) return json({ error: '수신기 인증에 실패했습니다.' }, 401)

    const alertUrl = settings.alert_url_encrypted ? await decryptSecret(env, settings.alert_url_encrypted) : ''
    return json({
      schema_version: 1,
      desired_enabled: Boolean(settings.desired_enabled),
      auto_register: Boolean(settings.auto_register),
      alert_url: alertUrl,
      connection_test_challenge: settings.last_test_challenge && !settings.last_test_ack_at ? settings.last_test_challenge : null,
      preset_refresh_request_id: settings.preset_refresh_request_id || null,
      preset_refresh_requested_at: settings.preset_refresh_requested_at || null,
      mappings_updated_at: data.weflab_mappings.reduce((latest, row) => String(row.updated_at || '') > latest ? String(row.updated_at) : latest, ''),
    })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
