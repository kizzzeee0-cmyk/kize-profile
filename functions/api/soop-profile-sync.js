import { requireAdmin } from '../_lib/auth.js'
import { mediaProxyUrl, saveBinary } from '../_lib/github.js'
import { json, errorJson } from '../_lib/http.js'
import { readStore, writeStore } from '../_lib/store.js'

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

async function fetchProfileImage(soopId) {
  for (const url of profileCandidates(soopId)) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'NAMRA-Profile/1.0' }, redirect: 'follow' })
      if (!response.ok) continue
      const contentType = String(response.headers.get('Content-Type') || '').toLowerCase()
      if (!contentType.startsWith('image/')) continue
      return { bytes: new Uint8Array(await response.arrayBuffer()), contentType, sourceUrl: url }
    } catch {}
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
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const body = await request.json().catch(() => ({}))
    const personId = String(body?.person_id || '').trim()
    const soopId = normalizeSoopId(body?.soop_id)
    if (!personId || !soopId) return json({ error: 'SOOP 시청자 정보가 올바르지 않습니다.' }, 400)

    const image = await fetchProfileImage(soopId)
    if (!image) return json({ error: 'SOOP 프로필 이미지를 찾지 못했습니다.' }, 404)

    const ext = extensionFor(image.contentType)
    const path = `public/site-media/upbo/${personId}-${Date.now()}.${ext}`
    await saveBinary(env, path, image.bytes, '[CF-Pages-Skip] Sync SOOP profile image')
    const profileUrl = mediaProxyUrl(path)

    const data = await readStore(env)
    const index = data.upbo_people.findIndex(row => String(row.id) === personId)
    if (index < 0) return json({ error: '시청자 데이터를 찾지 못했습니다.' }, 404)
    data.upbo_people[index] = {
      ...data.upbo_people[index],
      soop_id: soopId,
      profile_image_url: profileUrl,
      updated_at: new Date().toISOString(),
    }
    await writeStore(env, data, '[CF-Pages-Skip] Update SOOP profile image')

    return json({ ok: true, profile_image_url: profileUrl, source_url: image.sourceUrl })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
