function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

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

async function supabaseFetch(env, path, init = {}) {
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/${path}`
  const headers = new Headers(init.headers || {})
  headers.set('apikey', env.SUPABASE_SECRET_KEY)
  headers.set('authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`)
  headers.set('content-type', 'application/json')
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Supabase ${response.status}: ${body}`)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.WEFLAB_WEBHOOK_TOKEN) {
    return json({ ok: false, error: 'Server integration environment variables are not configured.' }, 503)
  }

  const url = new URL(request.url)
  const token = request.headers.get('x-webhook-token') || url.searchParams.get('token')
  if (!token || token !== env.WEFLAB_WEBHOOK_TOKEN) {
    return json({ ok: false, error: 'Unauthorized webhook request.' }, 401)
  }

  let payload
  try { payload = await request.json() }
  catch { return json({ ok: false, error: 'JSON body is required.' }, 400) }

  // Canonical body expected by this receiver. A few common aliases are accepted so
  // the mapping can be adapted quickly once WEFLAB publishes/provides its payload format.
  const soopId = firstValue(payload, ['soop_id', 'user_id', 'sender_id'])
  const soopName = firstValue(payload, ['soop_name', 'user_name', 'nickname', 'sender_name']) || soopId
  const resultLabel = firstValue(payload, ['result_label', 'roulette_result', 'result', 'reward_name'])
  const quantityRaw = firstValue(payload, ['quantity', 'count', 'qty']) ?? 1
  const quantity = Math.max(1, Number(quantityRaw) || 1)

  if (!soopId || !resultLabel) {
    return json({
      ok: false,
      error: 'Required fields are missing.',
      expected: { soop_id: 'viewer_id', soop_name: 'viewer name', result_label: 'roulette result', quantity: 1 },
    }, 400)
  }

  try {
    const encodedId = encodeURIComponent(String(soopId))
    let people = await supabaseFetch(env, `upbo_people?select=id,soop_id,sort_order&soop_id=eq.${encodedId}&limit=1`)
    let person = people?.[0]

    if (!person) {
      const latest = await supabaseFetch(env, 'upbo_people?select=sort_order&order=sort_order.desc&limit=1')
      const nextOrder = (Number(latest?.[0]?.sort_order) || 0) + 1
      const inserted = await supabaseFetch(env, 'upbo_people', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          soop_name: String(soopName),
          soop_id: String(soopId),
          profile_image_url: profileUrl(soopId),
          sort_order: nextOrder,
          is_visible: true,
        }),
      })
      person = inserted?.[0]
    } else {
      await supabaseFetch(env, `upbo_people?id=eq.${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ soop_name: String(soopName), profile_image_url: profileUrl(soopId) }),
      })
    }

    const encodedPerson = encodeURIComponent(person.id)
    const encodedLabel = encodeURIComponent(String(resultLabel))
    const existing = await supabaseFetch(env, `upbo_results?select=id,quantity,sort_order&person_id=eq.${encodedPerson}&result_label=eq.${encodedLabel}&limit=1`)
    const row = existing?.[0]

    if (row) {
      await supabaseFetch(env, `upbo_results?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: (Number(row.quantity) || 0) + quantity }),
      })
    } else {
      const latestResult = await supabaseFetch(env, `upbo_results?select=sort_order&person_id=eq.${encodedPerson}&order=sort_order.desc&limit=1`)
      const nextResultOrder = (Number(latestResult?.[0]?.sort_order) || 0) + 1
      await supabaseFetch(env, 'upbo_results', {
        method: 'POST',
        body: JSON.stringify({ person_id: person.id, result_label: String(resultLabel), quantity, sort_order: nextResultOrder }),
      })
    }

    return json({ ok: true, soop_id: String(soopId), result_label: String(resultLabel), quantity_added: quantity })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 500)
  }
}
