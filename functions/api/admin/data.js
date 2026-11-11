import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'
import { deleteRowInStore, isAllowedTable, mutateStoreAtomic, readStore, saveRowInStore, writeStore } from '../../_lib/store.js'
import { appendUpboAudit, markUpboUpdated } from '../../_lib/upbo.js'

function markUpboUpdated(data, table) {
  if (!['upbo_people', 'upbo_items', 'upbo_results'].includes(table)) return
  data.meta = { ...(data.meta || {}), upbo_updated_at: new Date().toISOString() }
}

const UPBO_TABLES = new Set(['upbo_people', 'upbo_items', 'upbo_results'])

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
      const values = { ...(body.values || {}) }

      if (table === 'upbo_people') {
        values.soop_id = String(values.soop_id || '').replace(/[()（）]/g, '').trim()
      }

      if (UPBO_TABLES.has(table)) {
        const atomic = await mutateStoreAtomic(env, latest => {
          const id = body.id ? String(body.id) : undefined
          let beforeQuantity = 0
          if (table === 'upbo_results' && id) {
            beforeQuantity = Number((latest.upbo_results || []).find(row => String(row.id) === id)?.quantity || 0)
          }
          const row = saveRowInStore(latest, table, values, id)
          const now = new Date().toISOString()
          markUpboUpdated(latest, now)

          if (table === 'upbo_results') {
            const afterQuantity = Number(row.quantity || 0)
            const delta = afterQuantity - beforeQuantity
            if (delta !== 0) {
              appendUpboAudit(latest, {
                action: delta > 0 ? 'manual_increment' : 'manual_decrement',
                person_id: row.person_id,
                item_id: row.item_id || null,
                quantity: delta,
                source: 'admin',
                detail: { result_id: row.id },
                created_at: now,
              })
            }
          }
          return row
        }, `[CF-Pages-Skip] Atomic save ${table}`)
        return json({ ok: true, row: atomic.result })
      }

      const row = saveRowInStore(data, table, values, body.id ? String(body.id) : undefined)
      await writeStore(env, data, `[CF-Pages-Skip] Save ${table}`)
      return json({ ok: true, row })
    }

    if (action === 'delete') {
      if (!body.id) return json({ error: '삭제할 ID가 없습니다.' }, 400)

      if (UPBO_TABLES.has(table)) {
        await mutateStoreAtomic(env, latest => {
          const id = String(body.id)
          const before = table === 'upbo_results'
            ? (latest.upbo_results || []).find(row => String(row.id) === id)
            : null
          deleteRowInStore(latest, table, id)
          const now = new Date().toISOString()
          markUpboUpdated(latest, now)
          if (before) {
            appendUpboAudit(latest, {
              action: 'manual_delete',
              person_id: before.person_id,
              item_id: before.item_id || null,
              quantity: -Number(before.quantity || 0),
              source: 'admin',
              detail: { result_id: before.id },
              created_at: now,
            })
          }
          return true
        }, `[CF-Pages-Skip] Atomic delete ${table}`)
        return json({ ok: true })
      }

      deleteRowInStore(data, table, String(body.id))
      await writeStore(env, data, `[CF-Pages-Skip] Delete ${table}`)
      return json({ ok: true })
    }

    if (action === 'archive_wardrobe_monthly') {
      const now = new Date().toISOString()
      let moved = 0

      data.wardrobe_items = (data.wardrobe_items || []).map(row => {
        if (row?.period_type !== 'monthly') return row
        moved += 1
        return { ...row, period_type: 'existing', updated_at: now }
      })

      if (moved > 0) {
        await writeStore(env, data, '[CF-Pages-Skip] Move monthly wardrobe items to existing')
      }

      return json({ ok: true, moved })
    }

    if (action === 'reorder') {
      if (!isAllowedTable(table)) return json({ error: '허용되지 않은 데이터 영역입니다.' }, 400)
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (!ids.length) return json({ error: '정렬할 항목이 없습니다.' }, 400)
      if (new Set(ids).size !== ids.length) return json({ error: '중복된 정렬 항목이 있습니다.' }, 400)

      if (UPBO_TABLES.has(table)) {
        const atomic = await mutateStoreAtomic(env, latest => {
          const rows = latest[table] || []
          const byId = new Map(rows.map(row => [String(row.id), row]))
          if (ids.some(id => !byId.has(id))) throw Object.assign(new Error('정렬할 항목 중 찾을 수 없는 데이터가 있습니다.'), { status: 400 })
          const now = new Date().toISOString()
          ids.forEach((id, index) => {
            const row = byId.get(id)
            row.sort_order = index + 1
            row.updated_at = now
          })
          markUpboUpdated(latest, now)
          return ids.map(id => byId.get(id))
        }, `[CF-Pages-Skip] Atomic reorder ${table}`)
        return json({ ok: true, rows: atomic.result })
      }

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
