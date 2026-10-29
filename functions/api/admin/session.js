import { adminSession } from '../../_lib/auth.js'
import { json } from '../../_lib/http.js'

export async function onRequestGet({ request, env }) {
  const session = await adminSession(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)
  return json({ user: { login: session.login || 'KIZE ADMIN' } })
}
