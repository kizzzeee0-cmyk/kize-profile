import { DATA_PATH, readJson, saveJson } from './github.js'

export const TABLES = [
  'site_settings', 'profile', 'profile_stats', 'profile_features', 'social_links',
  'navigation_links', 'milestones', 'archives', 'schedule_categories', 'schedules',
  'site_texts', 'signature_items', 'songs', 'wardrobe_items', 'upbo_people', 'upbo_results',
]

export function isAllowedTable(table) {
  return TABLES.includes(String(table || ''))
}

export async function readStore(env) {
  const data = await readJson(env, DATA_PATH)
  for (const table of TABLES) if (!Array.isArray(data[table])) data[table] = []
  if (!data.meta || typeof data.meta !== 'object') data.meta = {}
  return data
}

export async function writeStore(env, data, message = '[CF-Pages-Skip] Update KIZE CMS data') {
  data.meta = {
    ...(data.meta || {}),
    version: 1,
    storage: 'github-json',
    updated_at: new Date().toISOString(),
  }
  return saveJson(env, data, DATA_PATH, message)
}

export function publicStore(data) {
  const output = { meta: { ...(data.meta || {}) } }
  for (const table of TABLES) {
    const rows = Array.isArray(data[table]) ? data[table] : []
    if (table === 'site_settings' || table === 'profile' || table === 'site_texts' || table === 'upbo_results') {
      output[table] = rows
    } else {
      output[table] = rows.filter(row => row?.is_visible !== false)
    }
  }
  return output
}

function cleanValues(values) {
  const output = { ...(values || {}) }
  delete output.id
  delete output.created_at
  delete output.updated_at
  delete output.category
  delete output.__proto__
  return output
}

export function saveRowInStore(data, table, values, id) {
  if (!isAllowedTable(table)) throw Object.assign(new Error('허용되지 않은 데이터 영역입니다.'), { status: 400 })
  const rows = data[table]
  const now = new Date().toISOString()
  const incoming = cleanValues(values)

  if (id) {
    const index = rows.findIndex(row => String(row.id) === String(id))
    if (index < 0) throw Object.assign(new Error('수정할 항목을 찾지 못했습니다.'), { status: 404 })
    const next = { ...rows[index], ...incoming, id: rows[index].id, updated_at: now }
    rows[index] = next
    return next
  }

  if (table === 'signature_items' && rows.length >= 12) {
    throw Object.assign(new Error('Signature 이미지는 최대 12장까지 등록할 수 있습니다.'), { status: 400 })
  }

  const row = { id: crypto.randomUUID(), ...incoming, created_at: now, updated_at: now }
  rows.push(row)
  return row
}

export function deleteRowInStore(data, table, id) {
  if (!isAllowedTable(table)) throw Object.assign(new Error('허용되지 않은 데이터 영역입니다.'), { status: 400 })
  const before = data[table].length
  data[table] = data[table].filter(row => String(row.id) !== String(id))
  if (data[table].length === before) throw Object.assign(new Error('삭제할 항목을 찾지 못했습니다.'), { status: 404 })

  if (table === 'upbo_people') data.upbo_results = data.upbo_results.filter(row => String(row.person_id) !== String(id))
  if (table === 'schedule_categories') {
    data.schedules = data.schedules.map(row => String(row.category_id) === String(id) ? { ...row, category_id: null } : row)
  }
}
