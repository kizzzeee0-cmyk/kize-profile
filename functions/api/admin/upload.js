import { requireAdmin } from '../../_lib/auth.js'
import { mediaProxyUrl, randomId, safeFileName, saveBinary } from '../../_lib/github.js'
import { json, errorJson } from '../../_lib/http.js'

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])

export async function onRequestPost({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const form = await request.formData()
    const file = form.get('file')
    const folder = String(form.get('folder') || 'misc').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'misc'
    if (!(file instanceof File)) return json({ error: '이미지 파일이 없습니다.' }, 400)
    if (!ALLOWED.has(file.type)) return json({ error: 'PNG, JPG, WEBP, GIF, AVIF 이미지만 업로드할 수 있습니다.' }, 400)
    if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: '이미지는 20MB 이하만 업로드할 수 있습니다.' }, 400)

    const path = `public/site-media/${folder}/${Date.now()}-${randomId(5)}-${safeFileName(file.name)}`
    await saveBinary(env, path, file, `[CF-Pages-Skip] Upload ${folder} image`)
    return json({ ok: true, path, url: mediaProxyUrl(path) })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
