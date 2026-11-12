import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'

const MB_RECORDING_URL = 'https://musicbrainz.org/ws/2/recording/'
const CAA = 'https://coverartarchive.org'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
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

function coreTitle(value) {
  return clean(value)
    .replace(/[\(\[（【][^\)\]）】]{0,80}[\)\]）】]/g, ' ')
    .replace(/\s[-–—:]\s(?:feat\.?|ft\.?|featuring|remaster(?:ed)?|live|acoustic|instrumental|karaoke|version|ver\.?|edit|mix).*$/i, ' ')
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSimilarity(left, right) {
  const direct = similarity(left, right)
  const core = similarity(coreTitle(left), coreTitle(right))
  const a = normalized(coreTitle(left))
  const b = normalized(coreTitle(right))

  let containment = 0
  if (a && b && (a.includes(b) || b.includes(a))) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length)
    if (ratio >= 0.9) containment = 0.96
  }

  return Math.max(direct, core, containment)
}

function hasHangul(value) {
  return /[\uac00-\ud7af]/u.test(String(value || ''))
}

function isLikelyKoreanCandidate(item) {
  return String(item?.country || '').toUpperCase() === 'KR' ||
    hasHangul(item?.artist) ||
    hasHangul(item?.releaseTitle)
}

function candidatePriority(item, artistProvided) {
  const exact = item?.exact ? 1000 : 0
  const similarityScore = Math.round(Number(item?.titleSimilarity || 0) * 100)
  const koreanBoost = !artistProvided && isLikelyKoreanCandidate(item) ? 180 : 0
  const krStoreBoost = !artistProvided && String(item?.country || '').toUpperCase() === 'KR' ? 70 : 0

  // High Deezer rank is treated as the "famous global pop song" exception.
  const popularity = Number(item?.popularity || 0)
  const famousPopBoost = !artistProvided && popularity >= 700000 && item?.exact ? 320 : 0

  return exact + similarityScore + koreanBoost + krStoreBoost + famousPopBoost
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

async function searchDeezer(title, artist) {
  const term = artist ? `${title} ${artist}` : title
  const url = new URL(DEEZER_SEARCH_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('limit', '30')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  })
  if (!response.ok) return []

  const payload = await response.json().catch(() => ({}))
  if (payload?.error) return []

  const seen = new Set()
  const candidates = []

  for (const row of Array.isArray(payload?.data) ? payload.data : []) {
    const similarityValue = titleSimilarity(row?.title_short || row?.title, title)
    if (similarityValue < 0.9) continue

    const resultArtist = clean(row?.artist?.name)
    if (artist && !textArtistMatch(resultArtist, artist)) continue

    const trackId = String(row?.id || '')
    const albumId = String(row?.album?.id || '')
    const key = trackId || `${normalized(row?.title)}::${normalized(resultArtist)}::${albumId}`
    if (!key || seen.has(key)) continue

    const imageUrl = clean(row?.album?.cover_xl || row?.album?.cover_big || row?.album?.cover_medium || row?.album?.cover)
    if (!imageUrl) continue

    seen.add(key)
    candidates.push({
      id: `deezer:${key}`,
      recordingId: null,
      releaseId: albumId,
      title: clean(row?.title_short || row?.title) || title,
      artist: resultArtist || artist,
      releaseTitle: clean(row?.album?.title) || clean(row?.title) || title,
      date: '',
      country: '',
      status: 'official',
      score: Math.round(similarityValue * 100),
      titleSimilarity: similarityValue,
      popularity: Number(row?.rank || 0),
      exact: similarityValue === 1 && textArtistMatch(resultArtist, artist),
      imageUrl,
      source: 'Deezer',
      sourceId: trackId || albumId,
    })
  }

  return candidates
    .sort((a, b) =>
      candidatePriority(b, Boolean(artist)) - candidatePriority(a, Boolean(artist)) ||
      b.titleSimilarity - a.titleSimilarity ||
      Number(b.score || 0) - Number(a.score || 0)
    )
    .slice(0, 8)
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
      const similarityValue = titleSimilarity(row?.trackName, title)
      if (similarityValue < 0.9) continue
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
        score: Math.round(similarityValue * 100),
        titleSimilarity: similarityValue,
        popularity: 0,
        exact: similarityValue === 1 && textArtistMatch(row?.artistName, artist),
        imageUrl,
        source: 'iTunes Search',
        sourceId: trackId || collectionId,
      })
    }
  }

  return candidates
    .sort((a, b) =>
      candidatePriority(b, Boolean(artist)) - candidatePriority(a, Boolean(artist)) ||
      b.titleSimilarity - a.titleSimilarity ||
      String(b.date || '').localeCompare(String(a.date || ''))
    )
    .slice(0, 8)
}

function releaseCandidates(recordings, title, artist) {
  const seen = new Set()
  const rows = []

  for (const recording of recordings || []) {
    const similarityValue = titleSimilarity(recording?.title, title)
    const exactTitle = similarityValue === 1
    const exact = exactTitle && artistMatch(recording, artist)
    const searchScore = Number(recording?.score || 0)

    if (similarityValue < 0.9) continue

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
        titleSimilarity: similarityValue,
        popularity: 0,
        exact,
      })
    }
  }

  return rows.sort((a, b) =>
    candidatePriority(b, Boolean(artist)) - candidatePriority(a, Boolean(artist)) ||
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
    const [itunesCandidates, deezerCandidates] = await Promise.all([
      searchItunes(title, artist),
      searchDeezer(title, artist),
    ])

    const merged = []
    const mergedKeys = new Set()
    for (const item of [...itunesCandidates, ...deezerCandidates]) {
      const key = `${normalized(item.title)}::${normalized(item.artist)}::${normalized(item.releaseTitle)}`
      if (!key || mergedKeys.has(key)) continue
      mergedKeys.add(key)
      merged.push(item)
    }

    let candidates = merged
      .sort((a, b) =>
        candidatePriority(b, Boolean(artist)) - candidatePriority(a, Boolean(artist)) ||
        Number(b.titleSimilarity || 0) - Number(a.titleSimilarity || 0) ||
        Number(b.score || 0) - Number(a.score || 0)
      )
      .slice(0, 8)

    // Supplement/fallback with MusicBrainz + Cover Art Archive when the two
    // artwork-friendly sources still have too few usable matches.
    if (candidates.length < 3) {
      const payload = await searchRecordings(title, artist)
      let recordings = payload?.recordings || []
      let raw = releaseCandidates(recordings, title, artist)

      if (!raw.length) {
        const best = recordings.find(item => titleSimilarity(item?.title, title) >= 0.9) || recordings[0]
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
      .filter(item => Number(item.titleSimilarity ?? titleSimilarity(item.title, title)) >= 0.9)
      .sort((a, b) =>
        candidatePriority(b, Boolean(artist)) - candidatePriority(a, Boolean(artist)) ||
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
