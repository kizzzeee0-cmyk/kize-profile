function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function onRequestPost(context) {
  const { request, env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  const adminEmail = env.ADMIN_EMAIL

  if (!supabaseUrl || !publishableKey || !adminEmail) {
    return json({ error: '관리자 로그인 환경변수가 설정되지 않았습니다.' }, 503)
  }

  let password = ''
  try {
    const payload = await request.json()
    password = typeof payload?.password === 'string' ? payload.password : ''
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  if (!password) return json({ error: '비밀번호를 입력해 주세요.' }, 400)

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: adminEmail, password }),
  })

  if (!response.ok) {
    return json({ error: '비밀번호가 올바르지 않습니다.' }, 401)
  }

  const session = await response.json()
  return json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  })
}
