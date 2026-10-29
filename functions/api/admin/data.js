import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'
import { deleteRowInStore, isAllowedTable, readStore, saveRowInStore, writeStore } from '../../_lib/store.js'

export async function onRequestGet({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)
  try {
    return json({ data: await readStore(env) })
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}

export async function onRequestPost({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const table = String(body.table || '')
    const data = await readStore(env)

    if (action === 'save') {
      const row = saveRowInStore(data, table, body.values || {}, body.id ? String(body.id) : undefined)
      await writeStore(env, data, `[CF-Pages-Skip] Save ${table}`)
      return json({ ok: true, row })
    }

    if (action === 'delete') {
      if (!body.id) return json({ error: '삭제할 ID가 없습니다.' }, 400)
      deleteRowInStore(data, table, String(body.id))
      await writeStore(env, data, `[CF-Pages-Skip] Delete ${table}`)
      return json({ ok: true })
    }

    if (action === 'reorder') {
      if (!isAllowedTable(table)) return json({ error: '허용되지 않은 데이터 영역입니다.' }, 400)
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (!ids.length) return json({ error: '정렬할 항목이 없습니다.' }, 400)
      if (new Set(ids).size !== ids.length) return json({ error: '중복된 정렬 항목이 있습니다.' }, 400)

      const rows = data[table] || []
      const byId = new Map(rows.map(row => [String(row.id), row]))
      if (ids.some(id => !byId.has(id))) return json({ error: '정렬할 항목 중 찾을 수 없는 데이터가 있습니다.' }, 400)

      ids.forEach((id, index) => {
        const row = byId.get(id)
        row.sort_order = index + 1
        row.updated_at = new Date().toISOString()
      })

      await writeStore(env, data, `[CF-Pages-Skip] Reorder ${table}`)
      return json({ ok: true, rows: ids.map(id => byId.get(id)) })
    }

    return json({ error: '지원하지 않는 작업입니다.' }, 400)
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
