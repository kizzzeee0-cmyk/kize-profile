import { requireAdmin } from '../../_lib/auth.js'
import { json, errorJson } from '../../_lib/http.js'
import { mutateStoreAtomic } from '../../_lib/store.js'
import { completeUpbo, ensureUpboOperationalData, markUpboUpdated, undoCompletion } from '../../_lib/upbo.js'
import { encryptSecret } from '../../_lib/secret.js'

export async function onRequestPost({ request, env }) {
  const session = await requireAdmin(request, env)
  if (!session) return json({ error: '로그인이 필요합니다.' }, 401)

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'complete') {
      const atomic = await mutateStoreAtomic(env, async data => {
        const completion = completeUpbo(data, body.person_id, body.item_id, body.quantity)
        const response = { ...completion }
        completion.person_name_encrypted = await encryptSecret(env, completion.person_name || '')
        completion.person_soop_id_encrypted = await encryptSecret(env, completion.person_soop_id || '')
        delete completion.person_name
        delete completion.person_soop_id
        return response
      }, '[CF-Pages-Skip] Complete upbo delivery')
      return json({ ok: true, completion: atomic.result })
    }

    if (action === 'undo_completion') {
      const atomic = await mutateStoreAtomic(env, data => undoCompletion(data, body.completion_id), '[CF-Pages-Skip] Undo upbo completion')
      return json({ ok: true, completion: atomic.result })
    }

    if (action === 'save_admin_note') {
      const atomic = await mutateStoreAtomic(env, async data => {
        ensureUpboOperationalData(data)
        const person = data.upbo_people.find(row => String(row.id) === String(body.person_id || ''))
        if (!person) throw Object.assign(new Error('시청자를 찾지 못했습니다.'), { status: 404 })
        const note = String(body.note || '')
        person.admin_note_encrypted = note ? await encryptSecret(env, note) : ''
        delete person.admin_note
        person.updated_at = new Date().toISOString()
        markUpboUpdated(data, person.updated_at)
        return { id: person.id, admin_note: note }
      }, '[CF-Pages-Skip] Save private upbo viewer note')
      return json({ ok: true, person: atomic.result })
    }

    return json({ error: '지원하지 않는 작업입니다.' }, 400)
  } catch (error) {
    return errorJson(error, Number(error?.status) || 500)
  }
}
