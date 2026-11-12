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

function similarity(left, right) {
  const a = normalized(left)
  const b = normalized(right)
  if (!a || !b) return 0
  if (a === b) return 1

  const rows = Array.from({ length: a.length + 1 }, (_, index) => index)
  for (let j = 1; j <= b.length; j += 1) {
    let previous = rows[0]
    rows[0] = j
    for (let i = 1; i <= a.length; i += 1) {
      const current = rows[i]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i] = Math.min(
        rows[i] + 1,
        rows[i - 1] + 1,
        previous + cost,
      )
      previous = current
    }
  }

  return 1 - rows[a.length] / Math.max(a.length, b.length)
}

function artistMatch(recording, artist) {
  const queryArtist = normalized(artist)
  if (!queryArtist) return true
  const resultArtist = normalized(artistText(recording))
  return Boolean(resultArtist) &&
    (resultArtist === queryArtist || resultArtist.includes(queryArtist) || queryArtist.includes(resultArtist))
}

function exactMatch(recording, title, artist) {
  return normalized(recording?.title) === normalized(title) && artistMatch(recording, artist)
}

function releaseCandidates(recordings, title, artist) {
  const seen = new Set()
  const rows = []

  for (const recording of recordings || []) {
    const titleSimilarity = similarity(recording?.title, title)
    const exactTitle = titleSimilarity === 1
    const exact = exactTitle && artistMatch(recording, artist)
    const searchScore = Number(recording?.score || 0)

    // The title is the primary key for suggestions. Only keep results whose
    // normalized title is at least 90% similar to what the admin typed.
    if (titleSimilarity < 0.9) continue

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
        titleSimilarity,
        exact,
      })
    }
  }

  return rows.sort((a, b) =>
    Number(b.exact) - Number(a.exact) ||
    Number(String(b.status).toLowerCase() === 'official') - Number(String(a.status).toLowerCase() === 'official') ||
    b.titleSimilarity - a.titleSimilarity ||
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
  const query = artist
    ? `recording:"${lucene(title)}" AND artist:"${lucene(artist)}"`
    : `recording:"${lucene(title)}"`
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
    if (!title) return json({ error: '노래 제목을 입력해 주세요.' }, 400)

    const payload = await searchRecordings(title, artist)
    let recordings = payload?.recordings || []
    let raw = releaseCandidates(recordings, title, artist)

    if (!raw.length) {
      const best = recordings.find(item => similarity(item?.title, title) >= 0.9) || recordings[0]
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
      // When only a title was entered, always let the admin choose the artist/release.
      autoSelect: artist && exact.length === 1 && candidates.length === 1 ? exact[0].id : null,
      confidence: exact.length ? 'exact' : candidates.length ? 'review' : 'none',
    }, 200, { 'Cache-Control': 'private, max-age=300' })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
