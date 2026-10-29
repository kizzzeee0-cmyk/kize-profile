export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function errorJson(error, status = 500) {
  const message = error instanceof Error ? error.message : String(error || '서버 오류가 발생했습니다.')
  return json({ error: message }, status)
}
