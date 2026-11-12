import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'

const MB_RECORDING_URL = 'https://musicbrainz.org/ws/2/recording/'
const CAA = 'https://coverartarchive.org'
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search'
const MELON_SEARCH_URL = 'https://www.melon.com/search/song/index.htm'
const MELON_ALBUM_URL = 'https://www.melon.com/album/detail.htm'
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

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16) || 32))
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' '))
}

function melonHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
    Referer: 'https://www.melon.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/157 Safari/537.36',
  }
}

async function melonAlbumCover(albumId) {
  if (!albumId) return ''
  try {
    const url = new URL(MELON_ALBUM_URL)
    url.searchParams.set('albumId', albumId)
    const response = await fetch(url.toString(), { headers: melonHeaders() })
    if (!response.ok) return ''
    const html = await response.text()

    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (og?.[1]) return decodeHtml(og[1]).replace(/^http:/i, 'https:')

    const image = html.match(/https?:\/\/cdnimg\.melon\.co\.kr\/[^"'\s>]+(?:500|1000)\.jpg[^"'\s>]*/i)
    return image?.[0] ? decodeHtml(image[0]).replace(/^http:/i, 'https:') : ''
  } catch {
    return ''
  }
}

function parseMelonRows(html, title, artist) {
  const rows = []
  const seen = new Set()
  const trMatches = String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || []

  for (const row of trMatches) {
    const songId = row.match(/goSongDetail\(['"]?(\d+)['"]?\)/i)?.[1] ||
      row.match(/name=["']input_check["'][^>]+value=["'](\d+)["']/i)?.[1]
    if (!songId || seen.has(songId)) continue

    const titleMatch = row.match(/class=["'][^"']*fc_gray[^"']*["'][^>]+title=["']([^"']+)["']/i) ||
      row.match(/title=["']([^"']+)["'][^>]+class=["'][^"']*fc_gray/i)
    const songTitle = decodeHtml(titleMatch?.[1] || '')
    if (!songTitle) continue

    const similarityValue = titleSimilarity(songTitle, title)
    if (similarityValue < 0.86) continue

    const artistBlock = row.match(/<div[^>]+(?:id=["']artistName["']|class=["'][^"']*wrapArtistName[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
    const artistTitle = artistBlock.match(/title=["']([^"']+?)\s*-\s*페이지\s*이동["']/i)?.[1]
    const resultArtist = decodeHtml(artistTitle || stripHtml(artistBlock))
      .replace(/\s+-\s*페이지\s*이동\s*$/i, '')
      .trim()
    if (artist && resultArtist && !textArtistMatch(resultArtist, artist)) continue

    const albumLink = row.match(/goAlbumDetail\(['"]?(\d+)['"]?\)[^>]*>[^<]*<\/a>/i) ||
      row.match(/goAlbumDetail\(['"]?(\d+)['"]?\)/i)
    const albumId = albumLink?.[1] || ''
    const albumAnchor = row.match(/<a[^>]+goAlbumDetail\(['"]?\d+['"]?\)[^>]*title=["']([^"']+?)\s*-\s*페이지\s*이동["'][^>]*>([\s\S]*?)<\/a>/i)
    const releaseTitle = decodeHtml(albumAnchor?.[1] || stripHtml(albumAnchor?.[2] || '')) || songTitle

    seen.add(songId)
    rows.push({
      id: `melon:${songId}`,
      recordingId: null,
      releaseId: albumId,
      title: songTitle,
      artist: resultArtist || artist,
      releaseTitle,
      date: '',
      country: 'KR',
      status: 'official',
      score: Math.round(similarityValue * 100),
      titleSimilarity: similarityValue,
      popularity: 0,
      exact: normalized(songTitle) === normalized(title) && (!artist || textArtistMatch(resultArtist, artist)),
      imageUrl: '',
      source: 'Melon',
      sourceId: songId,
    })
  }

  return rows
}

async function searchMelon(title, artist) {
  const queries = []
  const combined = clean([title, artist].filter(Boolean).join(' '))
  if (combined) queries.push(combined)
  if (title && combined !== title) queries.push(title)

  const collected = []
  const keys = new Set()

  for (const query of queries) {
    try {
      const url = new URL(MELON_SEARCH_URL)
      url.searchParams.set('section', 'all')
      url.searchParams.set('searchGnbYn', 'Y')
      url.searchParams.set('kkoSpl', 'N')
      url.searchParams.set('kkoDpType', 'RESULT')
      url.searchParams.set('q', query)

      const response = await fetch(url.toString(), { headers: melonHeaders() })
      if (!response.ok) continue
      const html = await response.text()
      for (const row of parseMelonRows(html, title, artist)) {
        const key = `${normalized(row.title)}::${normalized(row.artist)}::${row.releaseId}`
        if (keys.has(key)) continue
        keys.add(key)
        collected.push(row)
      }
    } catch {
      // Overseas sources remain available as fallback.
    }

    if (collected.length >= 8) break
  }

  const top = collected
    .sort((a, b) =>
      Number(b.exact) - Number(a.exact) ||
      b.titleSimilarity - a.titleSimilarity ||
      Number(b.score || 0) - Number(a.score || 0)
    )
    .slice(0, 8)

  const withCovers = await Promise.all(top.map(async item => ({
    ...item,
    imageUrl: await melonAlbumCover(item.releaseId),
  })))

  return withCovers.filter(item => item.imageUrl)
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
    // Melon is the primary source for Korean songs. Its search results provide
    // the Korean catalog's song/artist/album relationship, avoiding unrelated
    // overseas albums that can share the same English title.
    const melonCandidates = await searchMelon(title, artist)

    const merged = []
    const mergedKeys = new Set()
    const addCandidates = rows => {
      for (const item of rows || []) {
        const key = `${normalized(item.title)}::${normalized(item.artist)}::${normalized(item.releaseTitle)}`
        if (!key || mergedKeys.has(key)) continue
        mergedKeys.add(key)
        merged.push(item)
      }
    }

    addCandidates(melonCandidates)

    // Only supplement Melon with global catalogs when Melon has too few usable
    // cover candidates. Melon candidates always stay ahead of overseas sources.
    if (melonCandidates.length < 5) {
      const [itunesCandidates, deezerCandidates] = await Promise.all([
        searchItunes(title, artist),
        searchDeezer(title, artist),
      ])
      addCandidates([...itunesCandidates, ...deezerCandidates])

      if (artist && merged.length < 3) {
        const [itunesTitleOnly, deezerTitleOnly] = await Promise.all([
          searchItunes(title, ''),
          searchDeezer(title, ''),
        ])
        addCandidates([...itunesTitleOnly, ...deezerTitleOnly])
      }
    }

    const hasMelon = melonCandidates.length > 0
    const rankingUsesArtist = Boolean(artist) && !hasMelon
    let candidates = merged
      .sort((a, b) =>
        Number(b.source === 'Melon') - Number(a.source === 'Melon') ||
        Number(b.exact) - Number(a.exact) ||
        candidatePriority(b, rankingUsesArtist) - candidatePriority(a, rankingUsesArtist) ||
        Number(b.titleSimilarity || 0) - Number(a.titleSimilarity || 0) ||
        Number(b.score || 0) - Number(a.score || 0)
      )
      .slice(0, 8)

    // Supplement/fallback with MusicBrainz + Cover Art Archive when the two
    // artwork-friendly sources still have too few usable matches.
    if (candidates.length < 3) {
      const fallbackArtist = hasMelon ? artist : (artist && candidates.length < 3 ? '' : artist)
      const payload = await searchRecordings(title, fallbackArtist)
      let recordings = payload?.recordings || []
      let raw = releaseCandidates(recordings, title, fallbackArtist)

      if (!raw.length) {
        const best = recordings.find(item => titleSimilarity(item?.title, title) >= 0.9) || recordings[0]
        if (best?.id) {
          await sleep(1100)
          const detail = await lookupRecording(best.id)
          recordings = [{ ...best, ...detail, score: best.score || 100 }]
          raw = releaseCandidates(recordings, title, fallbackArtist)
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
        Number(b.source === 'Melon') - Number(a.source === 'Melon') ||
        Number(b.exact) - Number(a.exact) ||
        candidatePriority(b, rankingUsesArtist) - candidatePriority(a, rankingUsesArtist) ||
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
