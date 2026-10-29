import { fetchRawFile } from '../_lib/github.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const path = String(url.searchParams.get('path') || '')
  if (!/^public\/site-media\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) {
    return new Response('Invalid media path', { status: 400 })
  }

  const upstream = await fetchRawFile(env, path)
  if (!upstream.ok) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  const contentType = upstream.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(upstream.body, { status: 200, headers })
}
