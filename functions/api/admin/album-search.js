import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'

const MB_RECORDING_URL = 'https://musicbrainz.org/ws/2/recording/'
const CAA = 'https://coverartarchive.org'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
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


function textArtistMatch(resultArtist, artist) {
  const queryArtist = normalized(artist)
  if (!queryArtist) return true
  const value = normalized(resultArtist)
  return Boolean(value) &&
    (value === queryArtist || value.includes(queryArtist) || queryArtist.includes(value))
}

function artworkLarge(value) {
  const url = String(value || '')
  if (!url) return ''
  return url
    .replace(/\/\d+x\d+bb\./i, '/600x600bb.')
    .replace(/\/\d+x\d+-\d+\./i, '/600x600-75.')
    .replace(/100x100/g, '600x600')
}

function storefrontsFor(title) {
  const value = clean(title)
  if (/[\u3040-\u30ff]/u.test(value)) return ['JP', 'KR']
  if (/[\uac00-\ud7af]/u.test(value)) return ['KR']
  if (/[\u4e00-\u9fff]/u.test(value)) return ['CN', 'TW', 'HK', 'KR']
  return ['KR', 'US']
}

async function searchItunes(title, artist) {
  const countries = storefrontsFor(title)
  const term = artist ? `${title} ${artist}` : title

  const payloads = await Promise.allSettled(countries.map(async country => {
    const url = new URL(ITUNES_SEARCH_URL)
    url.searchParams.set('term', term)
    url.searchParams.set('media', 'music')
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '25')
    url.searchParams.set('country', country.toLowerCase())

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })
    if (!response.ok) throw new Error(`iTunes 검색 실패 (${response.status})`)
    const payload = await response.json()
    return { country, results: Array.isArray(payload?.results) ? payload.results : [] }
  }))

  const seen = new Set()
  const candidates = []

  for (const payload of payloads) {
    if (payload.status !== 'fulfilled') continue

    for (const row of payload.value.results) {
      const titleSimilarity = similarity(row?.trackName, title)
      if (titleSimilarity < 0.9) continue
      if (artist && !textArtistMatch(row?.artistName, artist)) continue

      const trackId = String(row?.trackId || '')
      const collectionId = String(row?.collectionId || '')
      const key = trackId || `${normalized(row?.trackName)}::${normalized(row?.artistName)}::${collectionId}`
      if (!key || seen.has(key)) continue

      const imageUrl = artworkLarge(row?.artworkUrl100 || row?.artworkUrl60)
      if (!imageUrl) continue

      seen.add(key)
      candidates.push({
        id: `itunes:${key}`,
        recordingId: null,
        releaseId: collectionId,
        title: clean(row?.trackName) || title,
        artist: clean(row?.artistName) || artist,
        releaseTitle: clean(row?.collectionName) || clean(row?.trackName) || title,
        date: clean(row?.releaseDate).slice(0, 10),
        country: payload.value.country,
        status: 'official',
        score: Math.round(titleSimilarity * 100),
        titleSimilarity,
        exact: titleSimilarity === 1 && textArtistMatch(row?.artistName, artist),
        imageUrl,
        source: 'iTunes Search',
        sourceId: trackId || collectionId,
      })
    }
  }

  return candidates
    .sort((a, b) =>
      Number(b.exact) - Number(a.exact) ||
      b.titleSimilarity - a.titleSimilarity ||
      Number(b.country === 'KR') - Number(a.country === 'KR') ||
      String(b.date || '').localeCompare(String(a.date || ''))
    )
    .slice(0, 8)
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

    // Title-only lookup first uses iTunes because it returns song title, artist,
    // album and artwork together. This avoids the old case where MusicBrainz found
    // a recording but no Cover Art Archive image, which looked like "no search".
    let candidates = await searchItunes(title, artist)

    // Supplement/fallback with MusicBrainz + Cover Art Archive when iTunes has
    // too few usable matches.
    if (candidates.length < 3) {
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

      const existing = new Set(candidates.map(item => `${normalized(item.title)}::${normalized(item.artist)}::${normalized(item.releaseTitle)}`))
      for (const row of raw.slice(0, 10)) {
        const imageUrl = await hasCover(row.releaseId)
        if (!imageUrl) continue
        const key = `${normalized(row.title)}::${normalized(row.artist)}::${normalized(row.releaseTitle)}`
        if (existing.has(key)) continue
        existing.add(key)
        candidates.push({
          ...row,
          imageUrl,
          source: 'Cover Art Archive / MusicBrainz',
          sourceId: row.releaseId,
        })
        if (candidates.length >= 8) break
      }
    }

    candidates = candidates
      .filter(item => Number(item.titleSimilarity ?? similarity(item.title, title)) >= 0.9)
      .sort((a, b) =>
        Number(b.exact) - Number(a.exact) ||
        Number(b.titleSimilarity || 0) - Number(a.titleSimilarity || 0) ||
        Number(b.score || 0) - Number(a.score || 0)
      )
      .slice(0, 8)

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
