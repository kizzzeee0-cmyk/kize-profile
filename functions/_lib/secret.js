const enc = new TextEncoder()
const dec = new TextDecoder()

function b64u(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function unb64u(value) {
  let text = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  while (text.length % 4) text += '='
  const binary = atob(text)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function configSecret(env) {
  return String(env.WEFLAB_CONFIG_SECRET || env.SESSION_SECRET || env.ADMIN_PASSWORD || '')
}

async function aesKey(env) {
  const secret = configSecret(env)
  if (!secret) throw Object.assign(new Error('WEFLAB_CONFIG_SECRET 또는 SESSION_SECRET 설정이 필요합니다.'), { status: 503 })
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(env, plainText) {
  if (!plainText) return ''
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const key = await aesKey(env)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(plainText))))
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(iv)
  packed.set(cipher, iv.length)
  return `v1.${b64u(packed)}`
}

export async function decryptSecret(env, encrypted) {
  if (!encrypted) return ''
  const [version, value] = String(encrypted).split('.', 2)
  if (version !== 'v1' || !value) throw new Error('지원하지 않는 비밀 설정 형식입니다.')
  const packed = unb64u(value)
  const iv = packed.slice(0, 12)
  const cipher = packed.slice(12)
  const key = await aesKey(env)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return dec.decode(plain)
}

export async function hashToken(token) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(token || ''))))
  return b64u(digest)
}

export function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return b64u(value)
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export async function verifyHashedToken(provided, expectedHash) {
  if (!provided || !expectedHash) return false
  return (await hashToken(provided)) === String(expectedHash)
}
