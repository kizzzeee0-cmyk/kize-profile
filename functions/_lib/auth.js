import { json } from './http.js'

const enc = new TextEncoder()
const dec = new TextDecoder()
const COOKIE = 'kize_admin_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000

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

async function cryptoKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(secret))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function seal(payload, secret) {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const key = await cryptoKey(secret)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))))
  const output = new Uint8Array(iv.length + cipher.length)
  output.set(iv)
  output.set(cipher, iv.length)
  return b64u(output)
}

async function openSeal(value, secret) {
  const bytes = unb64u(value)
  const iv = bytes.slice(0, 12)
  const cipher = bytes.slice(12)
  const key = await cryptoKey(secret)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return JSON.parse(dec.decode(plain))
}

function cookieValue(request, name) {
  const header = request.headers.get('Cookie') || ''
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] || ''
}

function sessionSecret(env) {
  return String(env.SESSION_SECRET || env.ADMIN_PASSWORD || '')
}

function sessionCookie(value, maxAge = MAX_AGE_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

export async function adminSession(request, env) {
  const secret = sessionSecret(env)
  if (!secret) return null
  const value = cookieValue(request, COOKIE)
  if (!value) return null
  try {
    const session = await openSeal(value, secret)
    if (!session?.iat || Date.now() - Number(session.iat) > MAX_AGE_MS) return null
    return session
  } catch {
    return null
  }
}

export async function requireAdmin(request, env) {
  const session = await adminSession(request, env)
  if (!session) return null
  return session
}

export async function passwordLogin(request, env) {
  const expected = String(env.ADMIN_PASSWORD || '')
  const secret = sessionSecret(env)
  if (!expected || !secret) return json({ error: 'Cloudflare의 ADMIN_PASSWORD 설정을 확인해 주세요.' }, 503)

  const body = await request.json().catch(() => ({}))
  const password = String(body?.password || '')
  if (!password || password !== expected) return json({ error: '비밀번호가 올바르지 않습니다.' }, 401)

  const token = await seal({ login: 'NAMRA ADMIN', iat: Date.now() }, secret)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie(token),
    },
  })
}

export function logoutResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie('', 0),
    },
  })
}
