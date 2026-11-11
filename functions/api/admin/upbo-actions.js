import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic } from '../../_lib/store.js'
import { completeUpbo, ensureUpboOperationalData, markUpboUpdated, undoCompletion } from '../../_lib/upbo.js'

export async function onRequestPost({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'complete') {
      const atomic = await mutateStoreAtomic(env, data => completeUpbo(data, body.person_id, body.item_id, body.quantity), '[CF-Pages-Skip] Complete upbo delivery')
      return json({ ok: true, completion: atomic.result })
    }

    if (action === 'undo_completion') {
      const atomic = await mutateStoreAtomic(env, data => undoCompletion(data, body.completion_id), '[CF-Pages-Skip] Undo upbo completion')
      return json({ ok: true, completion: atomic.result })
    }

    if (action === 'save_admin_note') {
      const atomic = await mutateStoreAtomic(env, data => {
        ensureUpboOperationalData(data)
        const person = data.upbo_people.find(row => String(row.id) === String(body.person_id || ''))
        if (!person) throw Object.assign(new Error('시청자를 찾지 못했습니다.'), { status: 404 })
        person.admin_note = String(body.note || '')
        person.updated_at = new Date().toISOString()
        markUpboUpdated(data, person.updated_at)
        return { id: person.id, admin_note: person.admin_note }
      }, '[CF-Pages-Skip] Save private upbo viewer note')
      return json({ ok: true, person: atomic.result })
    }

    return json({ error: '지원하지 않는 작업입니다.' }, 400)
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
