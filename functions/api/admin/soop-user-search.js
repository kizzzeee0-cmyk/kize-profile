import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'

function clean(value) {
  return String(value || '').trim()
}

function normalizeImage(value) {
  const url = clean(value)
  if (!url) return ''
  return url.startsWith('//') ? 'https:' + url : url
}

function candidateId(row) {
  return clean(row?.user_id || row?.bj_id || row?.userId || row?.id || row?.channel_id)
}

function candidateName(row) {
  return clean(row?.user_nick || row?.nick || row?.user_name || row?.nickname)
}

export async function onRequestGet({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const url = new URL(request.url)
    const query = clean(url.searchParams.get('q'))
    if (query.length < 1) return json({ results: [] })
    if (query.length > 30) return json({ error: '검색어는 30자 이내로 입력해 주세요.' }, 400)

    const upstream = new URL('https://sch.sooplive.com/api.php')
    upstream.searchParams.set('m', 'searchHistory')
    upstream.searchParams.set('service', 'list')
    upstream.searchParams.set('d', query)

    const response = await fetch(upstream.toString(), {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'NAMRA-Profile/1.0',
        Referer: 'https://www.sooplive.com/',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw Object.assign(new Error('SOOP 검색 서버 응답을 받지 못했습니다.'), { status: 502 })
    }

    const payload = await response.json().catch(() => ({}))
    const source = Array.isArray(payload?.suggest_bj) ? payload.suggest_bj : []
    const seen = new Set()
    const exact = query.toLocaleLowerCase()

    const results = source
      .map(row => {
        const id = candidateId(row)
        const name = candidateName(row)
        const profile = normalizeImage(row?.station_logo || row?.profile_image || row?.profile || row?.logo)
        if (!id || !name || !/^[A-Za-z0-9_-]{2,40}$/.test(id)) return null
        return {
          soop_id: id,
          soop_name: name,
          profile_image_url: profile || `https://stimg.sooplive.com/LOGO/${id.slice(0, 2).toLowerCase()}/${id}/m/${id}.webp`,
          exact_name: name.toLocaleLowerCase() === exact,
        }
      })
      .filter(Boolean)
      .filter(row => {
        if (seen.has(row.soop_id)) return false
        seen.add(row.soop_id)
        return true
      })
      .sort((a, b) => Number(b.exact_name) - Number(a.exact_name) || a.soop_name.localeCompare(b.soop_name, 'ko'))
      .slice(0, 20)

    return json({ query, results })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
