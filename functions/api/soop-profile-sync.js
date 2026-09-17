function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function normalizeSoopId(value) {
  const id = String(value || '').trim()
  return /^[A-Za-z0-9_-]{2,40}$/.test(id) ? id : ''
}

function profileCandidates(id) {
  const bucket = id.slice(0, 2).toLowerCase()
  return [
    `https://stimg.sooplive.com/LOGO/${bucket}/${id}/m/${id}.webp`,
    `https://profile.img.sooplive.com/LOGO/${bucket}/${id}/m/${id}.jpg`,
    `https://profile.img.sooplive.com/LOGO/${bucket}/${id}/${id}.jpg`,
  ]
}

async function adminRequest(env, path, init = {}) {
  const base = String(env.SUPABASE_URL).replace(/\/$/, '')
  const headers = new Headers(init.headers || {})
  headers.set('apikey', env.SUPABASE_SECRET_KEY)
  headers.set('authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`)
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${base}${path}`, { ...init, headers })
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function requireAdmin(request, env) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const base = String(env.SUPABASE_URL).replace(/\/$/, '')
  const userResponse = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${match[1]}`,
    },
  })
  if (!userResponse.ok) return null
  const user = await userResponse.json()
  if (!user?.id) return null

  const admins = await adminRequest(
    env,
    `/rest/v1/admin_profiles?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  )
  return admins?.[0] ? user : null
}

async function fetchProfileImage(soopId) {
  for (const url of profileCandidates(soopId)) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'KIZE-Profile/1.0' },
        redirect: 'follow',
      })
      if (!response.ok) continue
      const type = (response.headers.get('content-type') || '').toLowerCase()
      if (!type.startsWith('image/')) continue
      return { bytes: await response.arrayBuffer(), contentType: type, sourceUrl: url }
    } catch {
      // Try the next public SOOP image pattern.
    }
  }
  return null
}

function extensionFor(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return json({ ok: false, error: 'Server Supabase environment variables are not configured.' }, 503)
  }

  const admin = await requireAdmin(request, env)
  if (!admin) return json({ ok: false, error: 'Admin authentication is required.' }, 401)

  let body
  try { body = await request.json() }
  catch { return json({ ok: false, error: 'JSON body is required.' }, 400) }

  const personId = String(body?.person_id || '').trim()
  const soopId = normalizeSoopId(body?.soop_id)
  if (!personId || !soopId) return json({ ok: false, error: 'person_id and a valid soop_id are required.' }, 400)

  const image = await fetchProfileImage(soopId)
  if (!image) {
    return json({ ok: false, error: 'SOOP profile image could not be found from the available public image paths.' }, 404)
  }

  try {
    const base = String(env.SUPABASE_URL).replace(/\/$/, '')
    const ext = extensionFor(image.contentType)
    const objectPath = `upbo/${personId}.${ext}`
    const uploadResponse = await fetch(`${base}/storage/v1/object/site-media/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        'content-type': image.contentType,
        'x-upsert': 'true',
        'cache-control': '3600',
      },
      body: image.bytes,
    })
    if (!uploadResponse.ok) throw new Error(`Storage ${uploadResponse.status}: ${await uploadResponse.text()}`)

    const publicUrl = `${base}/storage/v1/object/public/site-media/${objectPath}`
    await adminRequest(env, `/rest/v1/upbo_people?id=eq.${encodeURIComponent(personId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ profile_image_url: publicUrl }),
    })

    return json({ ok: true, profile_image_url: publicUrl, source_url: image.sourceUrl })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Profile sync failed.' }, 500)
  }
}
