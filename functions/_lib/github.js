const API_VERSION = '2022-11-28'
const DEFAULT_OWNER = 'kizzzeee0-cmyk'
const DEFAULT_REPO = 'kize-profile'
const DEFAULT_BRANCH = 'main'
export const DATA_PATH = 'public/site-data/data.json'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function githubConfig(env) {
  return {
    owner: String(env.GITHUB_OWNER || DEFAULT_OWNER),
    repo: String(env.GITHUB_REPO || DEFAULT_REPO),
    branch: String(env.GITHUB_BRANCH || DEFAULT_BRANCH),
    token: String(env.GITHUB_TOKEN || ''),
  }
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'kize-profile-cms',
  }
}

function contentUrl(env, path) {
  const { owner, repo } = githubConfig(env)
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
}

function rawUrl(env, path) {
  const { owner, repo, branch } = githubConfig(env)
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
}

function decodeContent(content) {
  const clean = String(content || '').replace(/\n/g, '')
  const binary = atob(clean)
  return dec.decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

function encodeBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export async function getFile(env, path) {
  const { token, branch } = githubConfig(env)
  if (!token) throw Object.assign(new Error('Cloudflare의 GITHUB_TOKEN 설정이 필요합니다.'), { status: 503 })
  const response = await fetch(`${contentUrl(env, path)}?ref=${encodeURIComponent(branch)}`, { headers: headers(token) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(`GitHub ${response.status}: ${payload.message || path}`), { status: response.status })
  return payload
}

export async function readJson(env, path = DATA_PATH) {
  const { token } = githubConfig(env)
  if (token) {
    try {
      const file = await getFile(env, path)
      return JSON.parse(decodeContent(file.content))
    } catch (error) {
      if (Number(error?.status) !== 404) {
        console.warn('[KIZE GitHub] authenticated read failed, falling back to raw', error)
      }
    }
  }
  const response = await fetch(`${rawUrl(env, path)}?t=${Date.now()}`, { headers: { 'User-Agent': 'kize-profile-public' } })
  if (!response.ok) throw new Error(`GitHub data file ${response.status}: ${path}`)
  return response.json()
}

async function putContent(env, path, bytes, message, sha) {
  const { token, branch } = githubConfig(env)
  if (!token) throw Object.assign(new Error('Cloudflare의 GITHUB_TOKEN 설정이 필요합니다.'), { status: 503 })
  const response = await fetch(contentUrl(env, path), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBytes(bytes),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(`GitHub ${response.status}: ${payload.message || path}`), { status: response.status })
  return payload
}

export async function saveJson(env, object, path = DATA_PATH, message = '[CF-Pages-Skip] Update KIZE content') {
  const bytes = enc.encode(JSON.stringify(object, null, 2) + '\n')
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    let sha
    try { sha = (await getFile(env, path)).sha }
    catch (error) { if (Number(error?.status) !== 404) throw error }
    try { return await putContent(env, path, bytes, message, sha) }
    catch (error) {
      lastError = error
      if (Number(error?.status) !== 409 || attempt === 2) throw error
      await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  throw lastError
}

export async function saveBinary(env, path, fileOrBytes, message = '[CF-Pages-Skip] Upload KIZE media', overwrite = false) {
  let sha
  if (overwrite) {
    try { sha = (await getFile(env, path)).sha }
    catch (error) { if (Number(error?.status) !== 404) throw error }
  }
  const bytes = fileOrBytes instanceof Uint8Array
    ? fileOrBytes
    : new Uint8Array(fileOrBytes instanceof ArrayBuffer ? fileOrBytes : await fileOrBytes.arrayBuffer())
  return putContent(env, path, bytes, message, sha)
}

export async function fetchRawFile(env, path) {
  const response = await fetch(rawUrl(env, path), { headers: { 'User-Agent': 'kize-profile-media' } })
  return response
}

export function safeFileName(name) {
  return String(name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function randomId(bytes = 8) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function mediaProxyUrl(path) {
  return `/api/media?path=${encodeURIComponent(path)}`
}
