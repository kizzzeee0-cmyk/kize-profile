import { json, errorJson } from '../_lib/http.js'
import { readStore, writeStore } from '../_lib/store.js'

function firstValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return null
}

function profileUrl(id) {
  const clean = String(id || '').trim()
  if (!clean) return null
  const bucket = clean.slice(0, 2).toLowerCase()
  return `https://stimg.sooplive.com/LOGO/${bucket}/${clean}/m/${clean}.webp`
}

export async function onRequestPost({ request, env }) {
  if (!env.WEFLAB_WEBHOOK_TOKEN) return json({ error: 'WEFLAB_WEBHOOK_TOKEN이 설정되지 않았습니다.' }, 503)

  const url = new URL(request.url)
  const token = request.headers.get('x-webhook-token') || url.searchParams.get('token')
  if (!token || token !== env.WEFLAB_WEBHOOK_TOKEN) return json({ error: 'Webhook 인증에 실패했습니다.' }, 401)

  const payload = await request.json().catch(() => null)
  if (!payload) return json({ error: 'JSON body가 필요합니다.' }, 400)

  const soopId = firstValue(payload, ['soop_id', 'user_id', 'sender_id'])
  const soopName = firstValue(payload, ['soop_name', 'user_name', 'nickname', 'sender_name']) || soopId
  const resultLabel = firstValue(payload, ['result_label', 'roulette_result', 'result', 'reward_name'])
  const quantityRaw = firstValue(payload, ['quantity', 'count', 'qty']) ?? 1
  const quantity = Math.max(1, Number(quantityRaw) || 1)

  if (!soopId || !resultLabel) {
    return json({
      error: '필수 값이 없습니다.',
      expected: { soop_id: 'viewer_id', soop_name: 'viewer name', result_label: 'roulette result', quantity: 1 },
    }, 400)
  }

  try {
    const data = await readStore(env)
    const now = new Date().toISOString()
    let person = data.upbo_people.find(row => String(row.soop_id) === String(soopId))

    if (!person) {
      person = {
        id: crypto.randomUUID(),
        soop_name: String(soopName),
        soop_id: String(soopId),
        profile_image_url: profileUrl(soopId),
        note: null,
        sort_order: data.upbo_people.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0) + 1,
        is_visible: true,
        created_at: now,
        updated_at: now,
      }
      data.upbo_people.push(person)
    } else {
      person.soop_name = String(soopName)
      if (!person.profile_image_url) person.profile_image_url = profileUrl(soopId)
      person.updated_at = now
    }

    let result = data.upbo_results.find(row => String(row.person_id) === String(person.id) && String(row.result_label) === String(resultLabel))
    if (result) {
      result.quantity = (Number(result.quantity) || 0) + quantity
      result.updated_at = now
    } else {
      result = {
        id: crypto.randomUUID(),
        person_id: person.id,
        result_label: String(resultLabel),
        quantity,
        note: null,
        sort_order: data.upbo_results.filter(row => String(row.person_id) === String(person.id)).reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0) + 1,
        created_at: now,
        updated_at: now,
      }
      data.upbo_results.push(result)
    }

    await writeStore(env, data, '[CF-Pages-Skip] Record WEFLAB roulette result')
    return json({ ok: true, soop_id: String(soopId), result_label: String(resultLabel), quantity_added: quantity })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
