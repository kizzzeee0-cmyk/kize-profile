import { useState } from 'react'
import { AdminPanel, CrudEditor, Notice } from '../../components/AdminCommon'
import { AppIcon } from '../../components/AppIcon'

export default function AdminWardrobePage() {
  const [moving, setMoving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  async function moveMonthlyToExisting() {
    if (!window.confirm('이달의 의상에 등록된 모든 헤어와 의상을 기존 의상으로 이동할까요?\n\n이동 후에는 각각 기존 의상 탭의 헤어/의상으로 표시됩니다.')) return

    setMoving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive_wardrobe_monthly' }),
      })
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; moved?: number; error?: string }

      if (!response.ok) throw new Error(payload.error || '옷장 항목 이동에 실패했습니다.')

      const moved = Number(payload.moved || 0)
      setMessage(moved > 0
        ? `이달의 의상 ${moved}개를 기존 의상으로 이동했습니다.`
        : '현재 이달의 의상에 이동할 항목이 없습니다.')
      setRefreshKey(value => value + 1)
      window.dispatchEvent(new Event('namra:data-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '옷장 항목 이동에 실패했습니다.')
    } finally {
      setMoving(false)
    }
  }

  return <>
    <div className="admin-page-title">
      <span>WARDROBE CMS</span>
      <h1>옷장 관리</h1>
      <p>새 헤어와 의상은 기본적으로 이달의 의상에 등록하고, 월말에는 한 번에 기존 의상으로 이동할 수 있습니다. 사진은 업로드 후 4:5 비율로 크기와 위치를 조정해 저장합니다.</p>
    </div>

    {message && <Notice>{message}</Notice>}
    {error && <Notice error>{error}</Notice>}

    <AdminPanel
      title="이달의 의상 정리"
      description="이달의 의상에 있는 모든 헤어와 의상을 종류를 유지한 채 기존 의상 탭으로 한 번에 이동합니다."
    >
      <div className="wardrobe-archive-guide">
        <p>새 항목은 아래에서 <strong>이달의 의상</strong>으로 등록하세요. 이동하면 의상은 기존 의상 → 의상, 헤어는 기존 의상 → 헤어로 그대로 분류됩니다.</p>
        <button className="admin-primary wardrobe-archive-button" type="button" disabled={moving} onClick={() => void moveMonthlyToExisting()}>
          <AppIcon name="chevron-right" />
          {moving ? '이동 중...' : '이달의 의상 전체를 기존 의상으로 이동'}
        </button>
      </div>
    </AdminPanel>

    <CrudEditor
      key={refreshKey}
      table="wardrobe_items"
      title="옷장 항목"
      fields={[
        { key: 'name', label: '이름', required: true },
        { key: 'period_type', label: '구분', type: 'select', options: [{ label: '이달의 의상', value: 'monthly' }, { label: '기존 의상', value: 'existing' }] },
        { key: 'item_type', label: '종류', type: 'select', options: [{ label: '의상', value: 'outfit' }, { label: '헤어', value: 'hair' }] },
        { key: 'image_url', label: '사진 (4:5 크롭)', type: 'image', cropAspect: 4 / 5, cropWidth: 1200, cropHeight: 1500 },
        { key: 'description', label: '설명', type: 'textarea' },
        { key: 'sort_order', label: '정렬 순서', type: 'number' },
        { key: 'is_visible', label: '공개', type: 'checkbox' },
      ]}
      defaults={{ period_type: 'monthly', item_type: 'outfit', sort_order: 0, is_visible: true }}
      orderBy="sort_order"
    />
  </>
}
