export function normalizeSoopId(value) {
  return String(value || '').replace(/[()（）]/g, '').trim()
}

export function ensureUpboOperationalData(data) {
  for (const key of ['upbo_people', 'upbo_items', 'upbo_results', 'upbo_completions', 'upbo_audit_log', 'weflab_settings', 'weflab_mappings', 'weflab_events', 'weflab_presets']) {
    if (!Array.isArray(data[key])) data[key] = []
  }

  if (!data.weflab_settings[0]) {
    data.weflab_settings.push({
      id: 'primary',
      desired_enabled: false,
      auto_register: false,
      alert_url_encrypted: '',
      receiver_token_hash: '',
      receiver_token_created_at: null,
      last_receiver_heartbeat: null,
      receiver_monitoring: false,
      receiver_websocket_connected: false,
      receiver_state: 'waiting',
      receiver_error: '',
      bridge_version: '',
      source_verified: false,
      last_event_at: null,
      last_test_requested_at: null,
      last_test_challenge: '',
      last_test_ack_at: null,
      preset_refresh_request_id: '',
      preset_refresh_requested_at: null,
      updated_at: new Date().toISOString(),
    })
  }
  return data.weflab_settings[0]
}

export function markUpboUpdated(data, at = new Date().toISOString()) {
  data.meta = { ...(data.meta || {}), upbo_updated_at: at }
}

export function appendUpboAudit(data, entry) {
  ensureUpboOperationalData(data)
  const row = {
    id: crypto.randomUUID(),
    action: String(entry.action || 'unknown'),
    person_id: entry.person_id || null,
    item_id: entry.item_id || null,
    quantity: Number(entry.quantity || 0),
    source: String(entry.source || 'manual'),
    detail: entry.detail || null,
    created_at: entry.created_at || new Date().toISOString(),
  }
  data.upbo_audit_log.push(row)
  if (data.upbo_audit_log.length > 2500) data.upbo_audit_log = data.upbo_audit_log.slice(-2500)
  return row
}

function normalizedText(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

export function findWeflabMapping(data, rouletteName, sourceItemName) {
  ensureUpboOperationalData(data)
  const roulette = normalizedText(rouletteName)
  const item = normalizedText(sourceItemName)

  return data.weflab_mappings.find(mapping => {
    if (mapping.enabled === false) return false
    const rouletteOk = normalizedText(mapping.roulette_name) === roulette
    if (!rouletteOk) return false
    const names = [mapping.source_item_name, ...(Array.isArray(mapping.aliases) ? mapping.aliases : [])]
      .map(normalizedText)
      .filter(Boolean)
    return names.includes(item)
  }) || null
}

export function upsertObservedPreset(data, rouletteName, items, observedAt = new Date().toISOString()) {
  ensureUpboOperationalData(data)
  const name = String(rouletteName || '').trim()
  if (!name) return null
  const cleanItems = Array.from(new Set((Array.isArray(items) ? items : []).map(value => String(value || '').trim()).filter(Boolean)))
  const existing = data.weflab_presets.find(row => normalizedText(row.roulette_name) === normalizedText(name))

  if (existing) {
    existing.items = cleanItems
    existing.observed_at = observedAt
    existing.updated_at = new Date().toISOString()
    return existing
  }

  const row = {
    id: crypto.randomUUID(),
    roulette_name: name,
    items: cleanItems,
    observed_at: observedAt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  data.weflab_presets.push(row)
  return row
}

function findPersonBySoopId(data, soopId) {
  const target = normalizedText(normalizeSoopId(soopId))
  if (!target) return null
  return data.upbo_people.find(person => normalizedText(person.soop_id) === target) || null
}

function ensurePerson(data, soopId, displayName) {
  let person = findPersonBySoopId(data, soopId)
  if (person) {
    const nextName = String(displayName || '').trim()
    if (nextName && nextName !== person.soop_name) {
      person.soop_name = nextName
      person.updated_at = new Date().toISOString()
    }
    return person
  }

  const cleanId = normalizeSoopId(soopId)
  const maxOrder = data.upbo_people.reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), 0)
  person = {
    id: crypto.randomUUID(),
    soop_name: String(displayName || cleanId || '확인 필요').trim(),
    soop_id: cleanId,
    profile_image_url: null,
    note: '',
    admin_note: '',
    sort_order: maxOrder + 1,
    is_visible: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  data.upbo_people.push(person)
  return person
}

function applyQuantity(data, person, item, quantity, source, detail) {
  const now = new Date().toISOString()
  let result = data.upbo_results.find(row => String(row.person_id) === String(person.id) && String(row.item_id || '') === String(item.id))
  if (!result) {
    result = {
      id: crypto.randomUUID(),
      person_id: person.id,
      item_id: item.id,
      result_label: item.name,
      quantity: 0,
      note: '',
      sort_order: Number(item.sort_order || 0),
      created_at: now,
      updated_at: now,
    }
    data.upbo_results.push(result)
  }
  result.result_label = item.name
  result.quantity = Math.max(0, Number(result.quantity || 0) + quantity)
  result.updated_at = now
  markUpboUpdated(data, now)
  appendUpboAudit(data, {
    action: quantity >= 0 ? 'increment' : 'decrement',
    person_id: person.id,
    item_id: item.id,
    quantity,
    source,
    detail,
    created_at: now,
  })
  return result
}

function appendEvent(data, row) {
  data.weflab_events.push(row)
  if (data.weflab_events.length > 1200) data.weflab_events = data.weflab_events.slice(-1200)
  return row
}

export function processRouletteEvent(data, rawEvent, options = {}) {
  const settings = ensureUpboOperationalData(data)
  const now = new Date().toISOString()
  const event = {
    source_event_id: String(rawEvent?.source_event_id || '').trim(),
    bridge_event_id: String(rawEvent?.bridge_event_id || '').trim(),
    roulette_name: String(rawEvent?.roulette_name || '').trim(),
    donor_soop_id: normalizeSoopId(rawEvent?.donor_soop_id || ''),
    donor_display_name: String(rawEvent?.donor_display_name || '').trim(),
    item_name: String(rawEvent?.item_name || '').trim(),
    count: Math.max(1, Math.min(100, Number.parseInt(rawEvent?.count, 10) || 1)),
    occurred_at: String(rawEvent?.occurred_at || now),
    donation_value: Number(rawEvent?.donation_value || 0),
    preset_items: Array.isArray(rawEvent?.preset_items) ? rawEvent.preset_items : [],
  }

  if (!event.roulette_name || !event.item_name) {
    throw Object.assign(new Error('roulette_name과 item_name은 필수입니다.'), { status: 400 })
  }

  if (!event.source_event_id && !event.bridge_event_id) {
    throw Object.assign(new Error('source_event_id가 없다면 재전송 중복 방지를 위한 bridge_event_id가 필요합니다.'), { status: 400 })
  }

  if (event.preset_items.length) upsertObservedPreset(data, event.roulette_name, event.preset_items, event.occurred_at)

  const eventKey = event.source_event_id ? `source:${event.source_event_id}` : `bridge:${event.bridge_event_id}`
  const original = data.weflab_events.find(row => row.event_key === eventKey)

  if (original) {
    original.duplicate_count = Number(original.duplicate_count || 0) + 1
    original.last_duplicate_at = now
    return {
      duplicate: true,
      event: appendEvent(data, {
        id: crypto.randomUUID(),
        event_key: null,
        duplicate_of: original.id,
        source_event_id: event.source_event_id || null,
        bridge_event_id: event.bridge_event_id || null,
        roulette_name: event.roulette_name,
        donor_soop_id: event.donor_soop_id || null,
        donor_display_name: event.donor_display_name || null,
        item_name: event.item_name,
        source_count: event.count,
        applied_quantity: 0,
        status: 'duplicate',
        reason: '동일 이벤트 ID 재수신',
        occurred_at: event.occurred_at,
        received_at: now,
      }),
    }
  }

  const baseLog = {
    id: crypto.randomUUID(),
    event_key: eventKey,
    duplicate_of: null,
    source_event_id: event.source_event_id || null,
    bridge_event_id: event.bridge_event_id || null,
    roulette_name: event.roulette_name,
    donor_soop_id: event.donor_soop_id || null,
    donor_display_name: event.donor_display_name || null,
    item_name: event.item_name,
    source_count: event.count,
    donation_value: event.donation_value,
    applied_quantity: 0,
    mapping_id: null,
    person_id: null,
    item_id: null,
    occurred_at: event.occurred_at,
    received_at: now,
    duplicate_count: 0,
  }

  if (options.testMode === true) {
    return { duplicate: false, event: appendEvent(data, { ...baseLog, status: 'test', reason: '테스트 모드 - 업보 미반영' }) }
  }

  if (!settings.auto_register) {
    return { duplicate: false, event: appendEvent(data, { ...baseLog, status: 'excluded', reason: '자동 업보 등록 OFF' }) }
  }

  const mapping = findWeflabMapping(data, event.roulette_name, event.item_name)
  if (!mapping) {
    return { duplicate: false, event: appendEvent(data, { ...baseLog, status: 'unmapped', reason: '연결된 업보 항목 없음' }) }
  }

  if (!event.donor_soop_id) {
    return {
      duplicate: false,
      event: appendEvent(data, {
        ...baseLog,
        mapping_id: mapping.id,
        item_id: mapping.upbo_item_id || null,
        status: 'needs_viewer',
        reason: 'SOOP 고유 ID가 없어 관리자 확인 필요',
      }),
    }
  }

  const upboItem = data.upbo_items.find(item => String(item.id) === String(mapping.upbo_item_id || ''))
  if (!upboItem) {
    return {
      duplicate: false,
      event: appendEvent(data, {
        ...baseLog,
        mapping_id: mapping.id,
        status: 'error',
        reason: '매핑된 업보 항목을 찾을 수 없음',
      }),
    }
  }

  const person = ensurePerson(data, event.donor_soop_id, event.donor_display_name)
  const multiplier = Math.max(1, Math.min(100, Number.parseInt(mapping.quantity, 10) || 1))
  const appliedQuantity = event.count * multiplier
  applyQuantity(data, person, upboItem, appliedQuantity, 'roulette', {
    roulette_name: event.roulette_name,
    source_item_name: event.item_name,
    event_key: eventKey,
  })

  settings.last_event_at = now
  settings.receiver_state = settings.receiver_websocket_connected ? 'receiving' : settings.receiver_state
  settings.updated_at = now

  return {
    duplicate: false,
    event: appendEvent(data, {
      ...baseLog,
      mapping_id: mapping.id,
      person_id: person.id,
      item_id: upboItem.id,
      applied_quantity: appliedQuantity,
      status: 'applied',
      reason: '',
    }),
  }
}

export function completeUpbo(data, personId, itemId, requestedQuantity) {
  ensureUpboOperationalData(data)
  const person = data.upbo_people.find(row => String(row.id) === String(personId))
  const item = data.upbo_items.find(row => String(row.id) === String(itemId))
  const result = data.upbo_results.find(row => String(row.person_id) === String(personId) && String(row.item_id || '') === String(itemId))

  if (!person || !item || !result) throw Object.assign(new Error('완료 처리할 업보를 찾지 못했습니다.'), { status: 404 })
  const current = Math.max(0, Number(result.quantity || 0))
  const quantity = Math.max(1, Math.min(current, Number.parseInt(requestedQuantity, 10) || 1))
  if (current < 1) throw Object.assign(new Error('미처리 수량이 없습니다.'), { status: 400 })

  const now = new Date().toISOString()
  result.quantity = current - quantity
  result.updated_at = now
  if (result.quantity <= 0) data.upbo_results = data.upbo_results.filter(row => row.id !== result.id)

  const completion = {
    id: crypto.randomUUID(),
    person_id: person.id,
    person_name: person.soop_name,
    person_soop_id: person.soop_id,
    item_id: item.id,
    item_name: item.name,
    quantity,
    completed_at: now,
    reversed_at: null,
    status: 'completed',
  }
  data.upbo_completions.push(completion)

  markUpboUpdated(data, now)
  appendUpboAudit(data, {
    action: 'complete',
    person_id: person.id,
    item_id: item.id,
    quantity,
    source: 'admin',
    detail: { completion_id: completion.id },
    created_at: now,
  })

  return completion
}

export function undoCompletion(data, completionId) {
  ensureUpboOperationalData(data)
  const completion = data.upbo_completions.find(row => String(row.id) === String(completionId))
  if (!completion) throw Object.assign(new Error('완료 내역을 찾지 못했습니다.'), { status: 404 })
  if (completion.status === 'reversed' || completion.reversed_at) {
    throw Object.assign(new Error('이미 복구된 완료 내역입니다.'), { status: 409 })
  }

  const person = data.upbo_people.find(row => String(row.id) === String(completion.person_id))
  const item = data.upbo_items.find(row => String(row.id) === String(completion.item_id))
  if (!person || !item) throw Object.assign(new Error('시청자 또는 업보 항목을 찾지 못해 복구할 수 없습니다.'), { status: 409 })

  const now = new Date().toISOString()
  applyQuantity(data, person, item, Number(completion.quantity || 0), 'completion_undo', { completion_id: completion.id })
  completion.status = 'reversed'
  completion.reversed_at = now

  appendUpboAudit(data, {
    action: 'completion_undo',
    person_id: person.id,
    item_id: item.id,
    quantity: Number(completion.quantity || 0),
    source: 'admin',
    detail: { completion_id: completion.id },
    created_at: now,
  })

  return completion
}
