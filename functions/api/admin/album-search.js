import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'

const MB_RECORDING_URL = 'https://musicbrainz.org/ws/2/recording/'
const CAA = 'https://coverartarchive.org'
const USER_AGENT = 'NAMRA-Profile/1.0 (https://namra-profile.pages.dev/)'

function clean(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ')
}

function normalized(value) {
  return clean(value)
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lucene(value) {
  return clean(value).replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1')
}

function artistText(recording) {
  return (recording?.['artist-credit'] || [])
    .map(part => part?.name || part?.artist?.name || '')
    .filter(Boolean)
    .join(' ')
    .trim()
}

function exactMatch(recording, title, artist) {
  const titleOk = normalized(recording?.title) === normalized(title)
  const resultArtist = normalized(artistText(recording))
  const queryArtist = normalized(artist)
  const artistOk = Boolean(resultArtist && queryArtist) &&
    (resultArtist === queryArtist || resultArtist.includes(queryArtist) || queryArtist.includes(resultArtist))
  return titleOk && artistOk
}

function releaseCandidates(recordings, title, artist) {
  const seen = new Set()
  const rows = []

  for (const recording of recordings || []) {
    const exact = exactMatch(recording, title, artist)
    const searchScore = Number(recording?.score || 0)
    if (!exact && searchScore < 80) continue

    for (const release of recording?.releases || []) {
      const id = String(release?.id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)

      rows.push({
        id: `${recording.id || 'recording'}:${id}`,
        recordingId: recording.id || null,
        releaseId: id,
        title: recording.title || title,
        artist: artistText(recording) || artist,
        releaseTitle: release.title || recording.title || title,
        date: release.date || '',
        country: release.country || '',
        status: release.status || '',
        score: searchScore,
        exact,
      })
    }
  }

  return rows.sort((a, b) =>
    Number(b.exact) - Number(a.exact) ||
    Number(String(b.status).toLowerCase() === 'official') - Number(String(a.status).toLowerCase() === 'official') ||
    b.score - a.score ||
    String(a.date || '').localeCompare(String(b.date || ''))
  )
}

async function mbFetch(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  })
  if (!response.ok) {
    const err = new Error(`MusicBrainz 검색 실패 (${response.status})`)
    err.status = response.status === 503 ? 503 : 502
    throw err
  }
  return response.json()
}

async function searchRecordings(title, artist) {
  const query = `recording:"${lucene(title)}" AND artist:"${lucene(artist)}"`
  const url = new URL(MB_RECORDING_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '12')
  return mbFetch(url.toString())
}

async function lookupRecording(recordingId) {
  const url = new URL(`${MB_RECORDING_URL}${encodeURIComponent(recordingId)}`)
  url.searchParams.set('inc', 'releases+artist-credits')
  url.searchParams.set('fmt', 'json')
  return mbFetch(url.toString())
}

async function hasCover(releaseId) {
  const url = `${CAA}/release/${encodeURIComponent(releaseId)}/front-500`
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    })
    return response.ok ? url : null
  } catch {
    return null
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function onRequestGet({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const url = new URL(request.url)
    const title = clean(url.searchParams.get('title'))
    const artist = clean(url.searchParams.get('artist'))
    if (!title || !artist) return json({ error: '노래 제목과 가수를 모두 입력해 주세요.' }, 400)

    const payload = await searchRecordings(title, artist)
    let recordings = payload?.recordings || []
    let raw = releaseCandidates(recordings, title, artist)

    if (!raw.length) {
      const best = recordings.find(item => exactMatch(item, title, artist)) || recordings[0]
      if (best?.id) {
        await sleep(1100)
        const detail = await lookupRecording(best.id)
        recordings = [{ ...best, ...detail, score: best.score || 100 }]
        raw = releaseCandidates(recordings, title, artist)
      }
    }

    const candidates = []
    for (const row of raw.slice(0, 10)) {
      const imageUrl = await hasCover(row.releaseId)
      if (!imageUrl) continue
      candidates.push({
        ...row,
        imageUrl,
        source: 'Cover Art Archive / MusicBrainz',
        sourceId: row.releaseId,
      })
      if (candidates.length >= 6) break
    }

    const exact = candidates.filter(item => item.exact)
    return json({
      ok: true,
      query: { title, artist },
      candidates,
      autoSelect: exact.length === 1 && candidates.length === 1 ? exact[0].id : null,
      confidence: exact.length ? 'exact' : candidates.length ? 'review' : 'none',
    }, 200, { 'Cache-Control': 'private, max-age=300' })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
