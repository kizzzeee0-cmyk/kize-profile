import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AdminPanel, FormField, Notice } from '../../components/AdminCommon'
import { AdminSortableList } from '../../components/AdminSortableList'
import { AppIcon } from '../../components/AppIcon'
import { deleteRow, fetchAdminTable, fetchUpboUpdatedAt, reorderRows, saveRow } from '../../lib/data'
import { primarySoopProfileUrl } from '../../lib/soop'
import type { UpboItem, UpboPerson, UpboResult } from '../../types'

type UpboCompletion = {
  id: string
  person_id: string
  person_name: string
  person_soop_id: string
  item_id: string
  item_name: string
  quantity: number
  completed_at: string
  reversed_at?: string | null
  status: 'completed' | 'reversed'
}

type UpboAudit = {
  id: string
  action: string
  person_id?: string | null
  item_id?: string | null
  quantity: number
  source: string
  created_at: string
}

type WeflabSettings = {
  desired_enabled: boolean
  auto_register: boolean
  alert_url_configured: boolean
  receiver_token_configured: boolean
  last_receiver_heartbeat?: string | null
  receiver_monitoring: boolean
  receiver_websocket_connected: boolean
  receiver_state: string
  receiver_error: string
  bridge_version: string
  source_verified: boolean
  last_event_at?: string | null
  last_test_requested_at?: string | null
  last_test_ack_at?: string | null
  preset_refresh_requested_at?: string | null
}

type WeflabPreset = {
  id: string
  roulette_name: string
  items: string[]
  observed_at?: string | null
}

type WeflabMapping = {
  id: string
  roulette_name: string
  source_item_name: string
  aliases?: string[]
  upbo_item_id?: string | null
  enabled: boolean
  quantity: number
  updated_at?: string
}

type WeflabEvent = {
  id: string
  roulette_name: string
  donor_soop_id?: string | null
  donor_display_name?: string | null
  item_name: string
  applied_quantity: number
  status: string
  reason?: string
  received_at: string
}

type WeflabAdminData = {
  settings: WeflabSettings
  presets: WeflabPreset[]
  mappings: WeflabMapping[]
  events: WeflabEvent[]
}

type SoopUserCandidate = {
  soop_id: string
  soop_name: string
  profile_image_url: string
  exact_name?: boolean
}

const emptyPerson = { soop_name: '', soop_id: '', profile_image_url: '', note: '', admin_note: '', sort_order: 0, is_visible: true }
const emptyItem = { name: '', note: '', sort_order: 0, is_visible: true }

function cleanSoopId(value: string) {
  return value.replace(/[()（）]/g, '').trim()
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date).replace(/\. /g, '.').replace(/\.$/, '')
}

function eventStatusLabel(status: string) {
  if (status === 'applied') return '정상 반영'
  if (status === 'unmapped') return '미연결 항목'
  if (status === 'duplicate') return '중복 이벤트'
  if (status === 'excluded') return '제외 항목'
  if (status === 'needs_viewer') return '확인 필요'
  if (status === 'test') return '테스트'
  return '처리 오류'
}

function integrationState(settings?: WeflabSettings | null) {
  if (!settings) return { label: '연결 대기', tone: 'waiting' }
  if (!settings.alert_url_configured || !settings.receiver_token_configured) return { label: '설정 오류', tone: 'error' }
  if (!settings.desired_enabled) return { label: '연결 대기', tone: 'waiting' }
  if (settings.receiver_state === 'reconnecting') return { label: '재연결 시도 중', tone: 'retry' }

  const heartbeat = settings.last_receiver_heartbeat ? new Date(settings.last_receiver_heartbeat).getTime() : 0
  const stale = !heartbeat || Date.now() - heartbeat > 15 * 60 * 1000
  if (stale) return { label: '연결 끊김', tone: 'off' }

  if (settings.source_verified && settings.receiver_monitoring && settings.receiver_websocket_connected) {
    return { label: '정상 수신 중', tone: 'ok' }
  }
  return { label: '연결 대기', tone: 'waiting' }
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || '요청을 처리하지 못했습니다.')
  return payload
}

function MappingRow(props: {
  rouletteName: string
  sourceItem: string
  items: UpboItem[]
  mapping?: WeflabMapping
  onSaved: () => Promise<void>
}) {
  const { rouletteName, sourceItem, items, mapping, onSaved } = props
  const exact = items.find(item => item.name.trim().toLocaleLowerCase() === sourceItem.trim().toLocaleLowerCase())
  const [enabled, setEnabled] = useState(mapping?.enabled ?? false)
  const [itemId, setItemId] = useState(mapping?.upbo_item_id || exact?.id || '')
  const [aliases, setAliases] = useState((mapping?.aliases || []).join(', '))
  const [quantity, setQuantity] = useState(mapping?.quantity || 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(mapping?.enabled ?? false)
    setItemId(mapping?.upbo_item_id || exact?.id || '')
    setAliases((mapping?.aliases || []).join(', '))
    setQuantity(mapping?.quantity || 1)
  }, [mapping?.id, mapping?.updated_at, exact?.id])

  async function save() {
    setBusy(true); setError(null)
    try {
      await postJson('/api/admin/weflab', {
        action: 'save_mapping',
        id: mapping?.id,
        roulette_name: rouletteName,
        source_item_name: sourceItem,
        upbo_item_id: itemId,
        aliases,
        quantity,
        enabled: enabled && Boolean(itemId),
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '매핑 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function createAndMap() {
    setBusy(true); setError(null)
    try {
      await postJson('/api/admin/weflab', {
        action: 'create_upbo_item_and_map',
        roulette_name: rouletteName,
        source_item_name: sourceItem,
        upbo_item_name: sourceItem,
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업보 항목 생성 실패')
    } finally {
      setBusy(false)
    }
  }

  return <div className="weflab-mapping-row">
    <div className="weflab-source-item">
      <strong>{sourceItem}</strong>
      {exact && !mapping && <small>동일 이름 업보 발견 · 연결 제안</small>}
      {error && <small className="error">{error}</small>}
    </div>
    <select value={itemId} onChange={e => setItemId(e.target.value)}>
      <option value="">연결 없음</option>
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <input value={aliases} onChange={e => setAliases(e.target.value)} placeholder="별칭, 쉼표로 구분" />
    <input className="weflab-quantity-input" type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
    <label className="weflab-toggle"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /><span>자동 등록</span></label>
    <div className="weflab-mapping-actions">
      <button type="button" className="admin-secondary compact" disabled={busy} onClick={() => void createAndMap()}>신규 생성</button>
      <button type="button" className="admin-primary compact" disabled={busy} onClick={() => void save()}>{busy ? '저장 중' : '저장'}</button>
    </div>
  </div>
}

export default function AdminUpboPage() {
  const [tab, setTab] = useState<'manage' | 'weflab' | 'history'>('manage')
  const [people, setPeople] = useState<UpboPerson[]>([])
  const [items, setItems] = useState<UpboItem[]>([])
  const [results, setResults] = useState<UpboResult[]>([])
  const [completions, setCompletions] = useState<UpboCompletion[]>([])
  const [audit, setAudit] = useState<UpboAudit[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [personForm, setPersonForm] = useState<Record<string, any>>(emptyPerson)
  const [soopSearchQuery, setSoopSearchQuery] = useState('')
  const [soopSearchResults, setSoopSearchResults] = useState<SoopUserCandidate[]>([])
  const [soopSearchLoading, setSoopSearchLoading] = useState(false)
  const [soopSearchError, setSoopSearchError] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<Record<string, any>>(emptyItem)
  const [personId, setPersonId] = useState<string | undefined>()
  const [itemId, setItemId] = useState<string | undefined>()
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [overviewView, setOverviewView] = useState<'viewer' | 'item'>('viewer')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'quantity' | 'name' | 'recent'>('quantity')
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notePersonId, setNotePersonId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [completionQty, setCompletionQty] = useState<Record<string, number>>({})
  const [undo, setUndo] = useState<UpboCompletion | null>(null)
  const [pendingRemovalResultId, setPendingRemovalResultId] = useState<string | null>(null)
  const undoTimer = useRef<number | null>(null)

  const [weflab, setWeflab] = useState<WeflabAdminData | null>(null)
  const [alertUrl, setAlertUrl] = useState('')
  const [receiverToken, setReceiverToken] = useState('')
  const [weflabBusy, setWeflabBusy] = useState(false)
  const [weflabError, setWeflabError] = useState<string | null>(null)

  async function load() {
    try {
      const [p, i, r, c, a, updatedAt] = await Promise.all([
        fetchAdminTable<UpboPerson>('upbo_people', 'sort_order'),
        fetchAdminTable<UpboItem>('upbo_items', 'sort_order'),
        fetchAdminTable<UpboResult>('upbo_results', 'sort_order'),
        fetchAdminTable<UpboCompletion>('upbo_completions', ''),
        fetchAdminTable<UpboAudit>('upbo_audit_log', ''),
        fetchUpboUpdatedAt(true),
      ])
      setPeople(p); setItems(i); setResults(r)
      setCompletions([...c].sort((x, y) => String(y.completed_at || '').localeCompare(String(x.completed_at || ''))))
      setAudit([...a].sort((x, y) => String(y.created_at || '').localeCompare(String(x.created_at || ''))))
      setLastUpdatedAt(updatedAt)
      setSelectedPersonId(current => current && p.some(person => person.id === current) ? current : (p[0]?.id || ''))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '업보 데이터를 불러오지 못했습니다.')
    }
  }

  async function loadWeflab() {
    try {
      const response = await fetch('/api/admin/weflab?t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as WeflabAdminData & { error?: string }
      if (!response.ok) throw new Error(payload.error || '위플랩 연동 정보를 불러오지 못했습니다.')
      setWeflab(payload)
      setWeflabError(null)
    } catch (e) {
      setWeflabError(e instanceof Error ? e.message : '위플랩 연동 정보를 불러오지 못했습니다.')
    }
  }

  useEffect(() => { void load(); void loadWeflab() }, [])

  useEffect(() => {
    const timer = window.setInterval(() => { if (tab === 'weflab') void loadWeflab() }, 15000)
    return () => window.clearInterval(timer)
  }, [tab])

  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current) }, [])

  useEffect(() => {
    const raw = String(personForm.soop_id || '')
    const clean = cleanSoopId(raw)
    if (raw !== clean) setPersonForm(value => ({ ...value, soop_id: clean }))
  }, [personForm.soop_id])

  const personMap = useMemo(() => new Map(people.map(person => [person.id, person])), [people])
  const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const resultMap = useMemo(() => {
    const map = new Map<string, UpboResult[]>()
    results.filter(row => Number(row.quantity || 0) > 0).forEach(row => map.set(row.person_id, [...(map.get(row.person_id) || []), row]))
    return map
  }, [results])

  const selectedPerson = people.find(person => person.id === selectedPersonId)
  const selectedResults = (resultMap.get(selectedPersonId) || []).sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
  const pendingTotal = results.reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0)
  const activeViewerCount = new Set(results.filter(row => Number(row.quantity || 0) > 0).map(row => row.person_id)).size

  const viewerOverview = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const rows = people.map(person => {
      const list = (resultMap.get(person.id) || []).filter(item => Number(item.quantity || 0) > 0)
      const total = list.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      const recent = Math.max(0, ...list.map(item => new Date(item.updated_at || item.created_at || 0).getTime() || 0))
      return { person, rows: list, total, recent }
    }).filter(row => row.total > 0)
      .filter(row => !q || row.person.soop_name.toLocaleLowerCase().includes(q) || row.person.soop_id.toLocaleLowerCase().includes(q))
    if (sort === 'name') return rows.sort((a, b) => a.person.soop_name.localeCompare(b.person.soop_name, 'ko'))
    if (sort === 'recent') return rows.sort((a, b) => b.recent - a.recent)
    return rows.sort((a, b) => b.total - a.total)
  }, [people, resultMap, query, sort])

  const itemOverview = useMemo(() => {
    const map = new Map<string, { label: string; total: number; recent: number; viewers: Array<{ person: UpboPerson; quantity: number }> }>()
    results.forEach(result => {
      const quantity = Number(result.quantity || 0)
      const person = personMap.get(result.person_id)
      if (!person || quantity <= 0) return
      const label = result.result_label
      const row = map.get(label) || { label, total: 0, recent: 0, viewers: [] }
      row.total += quantity
      row.recent = Math.max(row.recent, new Date(result.updated_at || result.created_at || 0).getTime() || 0)
      const viewer = row.viewers.find(value => value.person.id === person.id)
      if (viewer) viewer.quantity += quantity
      else row.viewers.push({ person, quantity })
      map.set(label, row)
    })
    const q = query.trim().toLocaleLowerCase()
    const rows = [...map.values()].filter(row => !q || row.label.toLocaleLowerCase().includes(q))
    if (sort === 'name') return rows.sort((a, b) => a.label.localeCompare(b.label, 'ko'))
    if (sort === 'recent') return rows.sort((a, b) => b.recent - a.recent)
    return rows.sort((a, b) => b.total - a.total)
  }, [results, personMap, query, sort])

  async function searchSoopUsers(e?: FormEvent) {
    e?.preventDefault()
    const keyword = soopSearchQuery.trim()
    if (!keyword) {
      setSoopSearchResults([])
      setSoopSearchError('검색할 SOOP 닉네임을 입력해 주세요.')
      return
    }

    setSoopSearchLoading(true)
    setSoopSearchError(null)
    try {
      const response = await fetch('/api/admin/soop-user-search?q=' + encodeURIComponent(keyword), {
        credentials: 'include',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({})) as { results?: SoopUserCandidate[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'SOOP 계정 검색에 실패했습니다.')
      setSoopSearchResults(Array.isArray(payload.results) ? payload.results : [])
      if (!payload.results?.length) setSoopSearchError('검색 결과가 없습니다. 닉네임을 다시 확인해 주세요.')
    } catch (e) {
      setSoopSearchResults([])
      setSoopSearchError(e instanceof Error ? e.message : 'SOOP 계정 검색에 실패했습니다.')
    } finally {
      setSoopSearchLoading(false)
    }
  }

  function selectSoopUser(candidate: SoopUserCandidate) {
    setPersonId(undefined)
    setPersonForm({
      ...emptyPerson,
      soop_name: candidate.soop_name,
      soop_id: cleanSoopId(candidate.soop_id),
      profile_image_url: candidate.profile_image_url || primarySoopProfileUrl(candidate.soop_id),
      sort_order: people.length + 1,
    })
    setMessage(candidate.soop_name + ' (@' + candidate.soop_id + ') 계정을 선택했습니다. 아래 추가 버튼을 눌러 저장해 주세요.')
    setError(null)
  }

  async function savePerson(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      const soopId = cleanSoopId(String(personForm.soop_id || ''))
      const saved = await saveRow('upbo_people', {
        ...personForm,
        soop_id: soopId,
        profile_image_url: primarySoopProfileUrl(soopId) || null,
        sort_order: personId ? personForm.sort_order : people.length + 1,
      }, personId)
      try {
        if (saved?.id) await fetch('/api/soop-profile-sync', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person_id: saved.id, soop_id: soopId }) })
      } catch { /* optional */ }
      setPersonForm(emptyPerson); setPersonId(undefined); setMessage('시청자 정보를 저장했습니다.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '시청자 저장 실패') }
    finally { setBusy(false) }
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      await saveRow('upbo_items', { ...itemForm, name: String(itemForm.name || '').trim(), sort_order: itemId ? itemForm.sort_order : items.length + 1 }, itemId)
      setItemForm(emptyItem); setItemId(undefined); setMessage('업보 항목을 저장했습니다.'); await load(); await loadWeflab()
    } catch (e) { setError(e instanceof Error ? e.message : '업보 항목 저장 실패') }
    finally { setBusy(false) }
  }

  async function remove(table: 'upbo_people' | 'upbo_items', id: string) {
    if (!window.confirm(table === 'upbo_people' ? '이 시청자를 삭제하면 연결된 미처리 업보도 함께 삭제됩니다. 삭제하시겠습니까?' : '이 항목을 삭제하면 연결된 미처리 업보도 함께 삭제됩니다. 삭제하시겠습니까?')) return
    setBusy(true)
    try { await deleteRow(table, id); await load(); setMessage(table === 'upbo_people' ? '시청자를 삭제했습니다.' : '업보 항목을 삭제했습니다.') }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 실패') }
    finally { setBusy(false) }
  }

  async function reorderPeople(next: UpboPerson[]) {
    setBusy(true)
    try { await reorderRows('upbo_people', next.map(row => row.id)); await load() }
    finally { setBusy(false) }
  }

  async function reorderItems(next: UpboItem[]) {
    setBusy(true)
    try { await reorderRows('upbo_items', next.map(row => row.id)); await load() }
    finally { setBusy(false) }
  }

  function findResult(item: UpboItem) {
    return results.find(result => result.person_id === selectedPersonId && (String(result.item_id || '') === item.id || (!result.item_id && result.result_label === item.name)))
  }

  async function changeQuantity(item: UpboItem, delta: number) {
    if (!selectedPersonId || busyItemId) return
    const existing = findResult(item)
    const next = Math.max(0, Number(existing?.quantity || 0) + delta)
    if (!existing && next === 0) return
    setBusyItemId(item.id)
    try {
      if (existing && next === 0) await deleteRow('upbo_results', existing.id)
      else await saveRow('upbo_results', { person_id: selectedPersonId, item_id: item.id, result_label: item.name, quantity: next, note: existing?.note || '', sort_order: item.sort_order }, existing?.id)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '업보 개수 저장 실패') }
    finally { setBusyItemId(null) }
  }

  function openNote(person: UpboPerson) {
    setNotePersonId(person.id)
    setNoteDraft(person.admin_note || '')
  }

  async function saveNote(note = noteDraft) {
    if (!notePersonId) return
    setBusy(true)
    try {
      await postJson('/api/admin/upbo-actions', { action: 'save_admin_note', person_id: notePersonId, note })
      setNotePersonId(null); setNoteDraft(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : '메모 저장 실패') }
    finally { setBusy(false) }
  }

  async function complete(result: UpboResult, quantity: number) {
    if (!selectedPersonId) return
    const targetItemId = result.item_id || items.find(item => item.name === result.result_label)?.id
    if (!targetItemId) { setError('연결된 업보 항목을 찾지 못했습니다.'); return }
    const fullCompletion = quantity >= Number(result.quantity || 0)
    setBusyItemId(targetItemId)
    try {
      const payload = await postJson<{ completion: UpboCompletion }>('/api/admin/upbo-actions', { action: 'complete', person_id: selectedPersonId, item_id: targetItemId, quantity })
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
      setUndo(payload.completion)
      setPendingRemovalResultId(fullCompletion ? result.id : null)
      undoTimer.current = window.setTimeout(() => {
        setUndo(null)
        setPendingRemovalResultId(null)
        if (fullCompletion) void load()
      }, 5000)
      if (!fullCompletion) await load()
    } catch (e) { setError(e instanceof Error ? e.message : '배송완료 처리 실패') }
    finally { setBusyItemId(null) }
  }

  async function undoCompletion(completion: UpboCompletion) {
    setBusy(true)
    try {
      await postJson('/api/admin/upbo-actions', { action: 'undo_completion', completion_id: completion.id })
      setUndo(null)
      setPendingRemovalResultId(null)
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : '완료 복구 실패') }
    finally { setBusy(false) }
  }

  async function weflabAction(body: Record<string, unknown>, success?: string) {
    setWeflabBusy(true); setWeflabError(null)
    try {
      const payload = await postJson<{ token?: string }>('/api/admin/weflab', body)
      if (payload.token) setReceiverToken(payload.token)
      if (success) setMessage(success)
      await loadWeflab(); await load()
    } catch (e) { setWeflabError(e instanceof Error ? e.message : '위플랩 설정 처리 실패') }
    finally { setWeflabBusy(false) }
  }

  const status = integrationState(weflab?.settings)
  const mappingByKey = new Map((weflab?.mappings || []).map(mapping => [mapping.roulette_name + '|||' + mapping.source_item_name, mapping]))

  return <>
    <div className="admin-page-title upbo-admin-page-title">
      <span>UPBO CMS</span><h1>업보 관리</h1><p>수동 업보와 룰렛 자동 수신을 한 곳에서 관리합니다.</p>
      {lastUpdatedAt && <div className="upbo-last-updated admin"><span>마지막 저장</span><strong>{formatDate(lastUpdatedAt)}</strong></div>}
    </div>

    {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}

    {undo && <div className="upbo-undo-toast"><span><strong>{undo.person_name}</strong> · {undo.item_name} × {undo.quantity} 완료 처리</span><button type="button" onClick={() => void undoCompletion(undo)}>실행 취소</button></div>}

    <nav className="upbo-admin-tabs">
      <button type="button" className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>업보 관리</button>
      <button type="button" className={tab === 'weflab' ? 'active' : ''} onClick={() => setTab('weflab')}>위플랩 연동</button>
      <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>완료 · 변경 내역</button>
    </nav>

    {tab === 'manage' && <>
      <section className="upbo-admin-summary">
        <div><span>미처리 총수량</span><strong>{pendingTotal}</strong></div>
        <div><span>업보 있는 시청자</span><strong>{activeViewerCount}명</strong></div>
        <div><span>등록 시청자</span><strong>{people.length}명</strong></div>
        <div><span>업보 항목</span><strong>{items.length}개</strong></div>
      </section>

      <AdminPanel title="업보 현황" description="같은 데이터를 시청자별 또는 항목별로 확인합니다.">
        <div className="upbo-view-tabs admin">
          <button type="button" className={overviewView === 'viewer' ? 'active' : ''} onClick={() => { setOverviewView('viewer'); setQuery('') }}>시청자별</button>
          <button type="button" className={overviewView === 'item' ? 'active' : ''} onClick={() => { setOverviewView('item'); setQuery('') }}>항목별</button>
        </div>
        <div className="upbo-admin-filter-row">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={overviewView === 'viewer' ? '시청자 이름 / 아이디 검색' : '업보 항목명 검색'} />
          <select value={sort} onChange={e => setSort(e.target.value as 'quantity' | 'name' | 'recent')}><option value="quantity">미처리 수량순</option><option value="name">이름순</option><option value="recent">최근 등록순</option></select>
        </div>
        <div className="upbo-admin-overview-list">
          {overviewView === 'viewer'
            ? viewerOverview.map(row => <details key={row.person.id} className="upbo-admin-overview-row"><summary><strong>{row.person.soop_name}</strong><small>@{row.person.soop_id}</small><span>총 {row.total}개</span></summary><div>{row.rows.map(result => <p key={result.id}><span>{result.result_label}</span><strong>× {result.quantity}</strong></p>)}</div></details>)
            : itemOverview.map(row => <details key={row.label} className="upbo-admin-overview-row"><summary><strong>{row.label}</strong><small>{row.viewers.length}명</small><span>총 {row.total}개</span></summary><div>{row.viewers.map(viewer => <p key={viewer.person.id}><span>{viewer.person.soop_name}</span><strong>× {viewer.quantity}</strong></p>)}</div></details>)}
        </div>
      </AdminPanel>

      <AdminPanel title="SOOP 시청자" description="닉네임만 검색해도 같은 이름을 가진 SOOP 계정을 확인하고 정확한 계정을 선택할 수 있습니다. 관리자 메모는 공개 사이트에 노출되지 않습니다.">
        <div className="soop-user-search-box">
          <form className="soop-user-search-form" onSubmit={searchSoopUsers}>
            <label>
              <AppIcon name="search" />
              <input value={soopSearchQuery} onChange={e => setSoopSearchQuery(e.target.value)} placeholder="SOOP 시청자 이름 검색" />
            </label>
            <button className="admin-primary" type="submit" disabled={soopSearchLoading}>{soopSearchLoading ? '검색 중...' : '검색'}</button>
          </form>
          <small>SOOP 닉네임을 검색하면 동명이인 계정도 함께 표시됩니다. 아이디와 프로필을 확인한 뒤 선택해 주세요.</small>

          {soopSearchError && <div className="soop-user-search-message">{soopSearchError}</div>}
          {soopSearchResults.length > 0 && <div className="soop-user-search-results">
            {soopSearchResults.map(candidate => <button
              type="button"
              className={'soop-user-search-result' + (String(personForm.soop_id || '') === candidate.soop_id ? ' selected' : '')}
              key={candidate.soop_id}
              onClick={() => selectSoopUser(candidate)}
            >
              <span className="soop-user-search-avatar">
                <img
                  src={candidate.profile_image_url || primarySoopProfileUrl(candidate.soop_id)}
                  alt=""
                  loading="lazy"
                  onError={e => {
                    const next = primarySoopProfileUrl(candidate.soop_id)
                    if (next && e.currentTarget.src !== next) e.currentTarget.src = next
                    else e.currentTarget.style.display = 'none'
                  }}
                />
              </span>
              <span className="soop-user-search-copy">
                <strong>{candidate.soop_name}</strong>
                <small>@{candidate.soop_id}</small>
              </span>
              {candidate.exact_name && <em>이름 일치</em>}
              <b>선택</b>
            </button>)}
          </div>}
        </div>

        <div className="upbo-admin-people-compact">
          <AdminSortableList rows={people} disabled={busy} onReorder={reorderPeople}
            renderMain={row => <div className="upbo-admin-person-copy"><strong className="upbo-admin-person-name">{row.soop_name}</strong><small>@{row.soop_id}</small>{row.admin_note && <em>메모 있음</em>}</div>}
            renderActions={row => <><button type="button" title="메모" onClick={() => openNote(row)}><span>메모</span></button><button type="button" title="수정" onClick={() => { setPersonId(row.id); setPersonForm({ ...row }) }}><AppIcon name="edit" /><span>수정</span></button><button className="danger" type="button" title="삭제" onClick={() => void remove('upbo_people', row.id)}><AppIcon name="trash" /><span>삭제</span></button></>}
          />
        </div>

        {notePersonId && <div className="upbo-note-editor"><strong>{people.find(person => person.id === notePersonId)?.soop_name} 관리자 메모</strong><textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="공개 사이트에는 보이지 않는 메모입니다." /><div><button className="admin-secondary" type="button" onClick={() => void saveNote('')}>메모 삭제</button><button className="admin-primary" type="button" onClick={() => void saveNote()}>메모 저장</button></div></div>}

        <div className="admin-inline-editor">
          <h3>{personId ? '시청자 수정' : '선택한 시청자 추가'}</h3>
          <form className="admin-form admin-profile-basic-grid" onSubmit={savePerson}>
            <FormField label="SOOP 이름"><input required value={personForm.soop_name || ''} onChange={e => setPersonForm(value => ({ ...value, soop_name: e.target.value }))}/></FormField>
            <FormField label="SOOP 아이디"><input required value={personForm.soop_id || ''} onChange={e => setPersonForm(value => ({ ...value, soop_id: cleanSoopId(e.target.value) }))}/></FormField>
            <FormField label="공개 메모 (선택)"><textarea value={personForm.note || ''} onChange={e => setPersonForm(value => ({ ...value, note: e.target.value }))}/></FormField>
            <FormField label="공개"><input type="checkbox" checked={Boolean(personForm.is_visible)} onChange={e => setPersonForm(value => ({ ...value, is_visible: e.target.checked }))}/></FormField>
            <div className="form-actions"><button className="admin-primary" disabled={busy}>{personId ? '수정 저장' : '선택 계정 추가'}</button>{personId && <button className="admin-secondary" type="button" onClick={() => { setPersonId(undefined); setPersonForm(emptyPerson) }}>취소</button>}</div>
          </form>
        </div>
      </AdminPanel>

      <AdminPanel title="업보 항목" description="위플랩 원본 이름과 달라도 연동 탭에서 매핑할 수 있습니다.">
        <AdminSortableList rows={items} disabled={busy} onReorder={reorderItems} emptyText="등록된 업보 항목이 없습니다."
          renderMain={row => <div className="admin-list-summary"><div><strong>{row.name}</strong><small>{row.note || '업보 항목'}</small></div></div>}
          renderActions={row => <><button type="button" onClick={() => { setItemId(row.id); setItemForm({ ...row }) }}><AppIcon name="edit" /> 수정</button><button className="danger" type="button" onClick={() => void remove('upbo_items', row.id)}><AppIcon name="trash" /> 삭제</button></>}
        />
        <div className="admin-inline-editor"><h3>{itemId ? '업보 항목 수정' : '새 업보 항목 추가'}</h3><form className="admin-form admin-profile-basic-grid" onSubmit={saveItem}>
          <FormField label="항목 이름"><input required value={itemForm.name || ''} onChange={e => setItemForm(value => ({ ...value, name: e.target.value }))}/></FormField>
          <FormField label="설명 (선택)"><input value={itemForm.note || ''} onChange={e => setItemForm(value => ({ ...value, note: e.target.value }))}/></FormField>
          <FormField label="사용"><input type="checkbox" checked={Boolean(itemForm.is_visible)} onChange={e => setItemForm(value => ({ ...value, is_visible: e.target.checked }))}/></FormField>
          <div className="form-actions"><button className="admin-primary" disabled={busy}>{itemId ? '수정 저장' : '항목 추가'}</button>{itemId && <button className="admin-secondary" type="button" onClick={() => { setItemId(undefined); setItemForm(emptyItem) }}>취소</button>}</div>
        </form></div>
      </AdminPanel>

      <AdminPanel title="시청자별 업보 처리" description="시청자를 선택해 수량을 조정하거나 배송완료 처리합니다.">
        <div className="upbo-counter-toolbar"><FormField label="시청자 선택"><select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)}><option value="">시청자를 선택해 주세요.</option>{people.map(person => <option key={person.id} value={person.id}>{person.soop_name} (@{person.soop_id})</option>)}</select></FormField>{selectedPerson && <button type="button" className="admin-secondary compact" onClick={() => openNote(selectedPerson)}>메모 {selectedPerson.admin_note ? '수정' : '작성'}</button>}</div>

        {selectedPerson && <div className="upbo-pending-section"><div className="upbo-section-caption"><strong>미처리 업보</strong><span>총 {selectedResults.reduce((sum, row) => sum + Number(row.quantity || 0), 0)}개</span></div>
          {selectedResults.length ? selectedResults.map(result => {
            const quantity = Number(result.quantity || 0)
            const completionValue = Math.max(1, Math.min(quantity, completionQty[result.id] || 1))
            const waitingRemoval = pendingRemovalResultId === result.id && Boolean(undo)
            return <div className={'upbo-pending-row' + (waitingRemoval ? ' pending-removal' : '')} key={result.id}>
              <strong>{result.result_label}</strong>
              <span className="upbo-pending-quantity">× {quantity}</span>
              {waitingRemoval
                ? <div className="upbo-pending-removal-state"><span>완료됨 · 5초 후 제거</span><button type="button" className="admin-secondary compact" onClick={() => undo && void undoCompletion(undo)}>실행 취소</button></div>
                : <>
                  <button type="button" className="admin-secondary compact" disabled={Boolean(busyItemId)} onClick={() => void complete(result, 1)}>1개 완료</button>
                  {quantity > 1 && <button type="button" className="admin-secondary compact" disabled={Boolean(busyItemId)} onClick={() => void complete(result, quantity)}>전체 완료</button>}
                  {quantity > 1 && <div className="upbo-partial-complete"><input type="number" min="1" max={quantity} value={completionValue} onChange={e => setCompletionQty(value => ({ ...value, [result.id]: Math.max(1, Math.min(quantity, Number(e.target.value) || 1)) }))}/><button type="button" className="admin-primary compact" onClick={() => void complete(result, completionValue)}>완료</button></div>}
                </>}
            </div>
          }) : <p className="admin-empty">현재 미처리 업보가 없습니다.</p>}
        </div>}

        {selectedPersonId && <div className="upbo-adjustment-section"><div className="upbo-section-caption"><strong>수량 직접 조정</strong><span>버튼을 누르면 즉시 저장됩니다.</span></div><div className="upbo-counter-grid">
          {items.filter(item => item.is_visible !== false).map(item => {
            const existing = findResult(item)
            const quantity = Math.max(0, Number(existing?.quantity || 0))
            return <div className="upbo-counter-card" key={item.id}><div className="upbo-counter-copy"><strong>{item.name}</strong>{item.note && <small>{item.note}</small>}</div><div className="upbo-counter-stepper"><button type="button" disabled={quantity <= 0 || Boolean(busyItemId)} onClick={() => void changeQuantity(item, -1)}>−</button><span>{busyItemId === item.id ? '…' : quantity}</span><button type="button" disabled={Boolean(busyItemId)} onClick={() => void changeQuantity(item, 1)}>+</button></div></div>
          })}
        </div></div>}
      </AdminPanel>
    </>}

    {tab === 'weflab' && <>
      {weflabError && <Notice error>{weflabError}</Notice>}
      <AdminPanel title="위플랩 연동 설정" description="실제 수신기 응답과 웹소켓 연결이 확인돼야만 ‘정상 수신 중’으로 표시합니다.">
        {!weflab?.settings.source_verified && <div className="weflab-source-warning">
          <strong>실제 Weflab 데이터 소스 검증 필요</strong>
          <span>사이트 수신 API와 Windows 브리지는 준비되어 있지만, Weflab 원본 웹소켓을 읽는 source adapter가 확인되기 전에는 정상 수신 상태로 표시하지 않습니다.</span>
        </div>}
        <div className="weflab-status-grid">
          <div><span>연동 상태</span><strong className={'weflab-status ' + status.tone}>{status.label}</strong></div>
          <div><span>마지막 이벤트</span><strong>{formatDate(weflab?.settings.last_event_at, true)}</strong></div>
          <div><span>마지막 수신기 확인</span><strong>{formatDate(weflab?.settings.last_receiver_heartbeat, true)}</strong></div>
          <div><span>웹소켓</span><strong>{weflab?.settings.receiver_websocket_connected ? '연결됨' : '확인 안 됨'}</strong></div>
        </div>

        <div className="weflab-settings-form">
          <FormField label="위플랩 후원 알림 URL"><input type="password" value={alertUrl} onChange={e => setAlertUrl(e.target.value)} placeholder={weflab?.settings.alert_url_configured ? '저장됨 · 변경할 때만 새 URL 입력' : 'https://weflab.com/...'} /></FormField>
          <div className="weflab-setting-actions">
            <button className="admin-primary" type="button" disabled={weflabBusy || !alertUrl.trim()} onClick={() => { void weflabAction({ action: 'save_settings', alert_url: alertUrl, auto_register: Boolean(weflab?.settings.auto_register) }, '위플랩 URL을 암호화해 저장했습니다.').then(() => setAlertUrl('')) }}>URL 저장</button>
            <button className="admin-secondary" type="button" disabled={weflabBusy} onClick={() => void weflabAction({ action: 'rotate_receiver_token' }, '수신기 인증키를 새로 발급했습니다.')}>수신기 인증키 {weflab?.settings.receiver_token_configured ? '재발급' : '생성'}</button>
          </div>

          {receiverToken && <div className="weflab-token-box"><strong>새 수신기 인증키</strong><code>{receiverToken}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(receiverToken)}>복사</button><small>이 키는 다시 표시되지 않습니다. Windows 수신기에 저장해 주세요.</small></div>}

          <label className="weflab-auto-toggle"><input type="checkbox" checked={Boolean(weflab?.settings.auto_register)} onChange={e => void weflabAction({ action: 'set_auto_register', enabled: e.target.checked })}/><span>자동 업보 등록</span></label>

          <div className="weflab-control-buttons">
            <button type="button" className="admin-secondary" disabled={weflabBusy} onClick={() => void weflabAction({ action: 'request_connection_test' }, '수신기에 연결 확인 요청을 보냈습니다.')}>연결 테스트</button>
            <button type="button" className="admin-primary" disabled={weflabBusy} onClick={() => void weflabAction({ action: 'set_enabled', enabled: !weflab?.settings.desired_enabled }, weflab?.settings.desired_enabled ? '연동 중지 요청을 저장했습니다.' : '연동 시작 요청을 저장했습니다.')}>{weflab?.settings.desired_enabled ? '연동 중지' : '연동 시작'}</button>
            <button type="button" className="admin-secondary" onClick={() => void loadWeflab()}>룰렛 목록 불러오기</button>
            <button type="button" className="admin-secondary" disabled={weflabBusy} onClick={() => void weflabAction({ action: 'request_preset_refresh' }, '수신기에 룰렛 항목 새로고침을 요청했습니다.')}>룰렛 항목 새로고침</button>
          </div>

          {weflab?.settings.last_test_requested_at && <p className="weflab-test-result">연결 테스트: {weflab.settings.last_test_ack_at ? '수신기 응답 확인 · ' + formatDate(weflab.settings.last_test_ack_at, true) : '수신기 응답 대기 중'}</p>}
          {weflab?.settings.receiver_error && <Notice error>{weflab.settings.receiver_error}</Notice>}
        </div>
      </AdminPanel>

      <AdminPanel title="룰렛 항목 → 업보 연결" description="실제로 수신된 프리셋 목록을 기준으로 매핑합니다. 이름이 같아도 저장 전에는 자동 등록되지 않습니다.">
        {weflab?.presets.length ? <div className="weflab-preset-list">
          {weflab.presets.map(preset => <details className="weflab-preset" key={preset.id} open><summary><strong>{preset.roulette_name}</strong><span>{preset.items.length}개 항목</span><small>최근 확인 {formatDate(preset.observed_at, true)}</small></summary><div className="weflab-mapping-head"><span>위플랩 당첨 항목</span><span>연결할 업보</span><span>별칭</span><span>누적</span><span>자동</span><span>관리</span></div>{preset.items.map(sourceItem => <MappingRow key={sourceItem} rouletteName={preset.roulette_name} sourceItem={sourceItem} items={items} mapping={mappingByKey.get(preset.roulette_name + '|||' + sourceItem)} onSaved={async () => { await loadWeflab(); await load() }} />)}</details>)}
        </div> : <p className="admin-empty">아직 수신기에 의해 확인된 룰렛 프리셋이 없습니다. 실제 수신기 연결 후 목록을 불러와 주세요.</p>}
      </AdminPanel>

      <AdminPanel title="최근 룰렛 수신 기록" description="테스트 데이터는 업보에 반영하지 않고 별도로 표시합니다.">
        <details className="weflab-event-log" open><summary>최근 {weflab?.events.length || 0}건 보기</summary><div className="weflab-event-table">
          {(weflab?.events || []).map(event => <div className="weflab-event-row" key={event.id}><time>{formatDate(event.received_at, true)}</time><span>{event.donor_display_name || event.donor_soop_id || '확인 필요'}</span><span>{event.roulette_name}</span><strong>{event.item_name}</strong><span>+{event.applied_quantity}</span><em className={'status-' + event.status}>{eventStatusLabel(event.status)}</em>{event.reason && <small>{event.reason}</small>}</div>)}
          {!weflab?.events.length && <p className="admin-empty">수신 기록이 없습니다.</p>}
        </div></details>
      </AdminPanel>
    </>}

    {tab === 'history' && <>
      <AdminPanel title="완료 내역" description="배송완료된 업보는 삭제하지 않고 기록으로 보존합니다.">
        <div className="upbo-history-list">{completions.length ? completions.map(row => <div className="upbo-history-row" key={row.id}><time>{formatDate(row.completed_at, true)}</time><strong>{row.person_name}</strong><span>{row.item_name}</span><b>× {row.quantity}</b><em>{row.status === 'reversed' ? '복구됨' : '완료'}</em>{row.status !== 'reversed' && <button type="button" className="admin-secondary compact" onClick={() => void undoCompletion(row)}>복구</button>}</div>) : <p className="admin-empty">완료 내역이 없습니다.</p>}</div>
      </AdminPanel>

      <AdminPanel title="최근 변경 기록" description="자동 룰렛 반영, 수동 조정, 배송완료 및 복구 기록입니다.">
        <div className="upbo-audit-list">{audit.slice(0, 200).map(row => <div className="upbo-audit-row" key={row.id}><time>{formatDate(row.created_at, true)}</time><span>{personMap.get(String(row.person_id || ''))?.soop_name || '-'}</span><span>{itemMap.get(String(row.item_id || ''))?.name || '-'}</span><strong>{row.quantity > 0 ? '+' + row.quantity : row.quantity}</strong><em>{row.source === 'roulette' ? '자동' : '관리자'}</em><small>{row.action}</small></div>)}{!audit.length && <p className="admin-empty">변경 기록이 없습니다.</p>}</div>
      </AdminPanel>
    </>}
  </>
}
