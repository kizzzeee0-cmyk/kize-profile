import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { AppIcon } from './AppIcon'

type RowBase = { id: string }

type Props<T extends RowBase> = {
  rows: T[]
  sortable?: boolean
  disabled?: boolean
  emptyText?: string
  onReorder?: (next: T[]) => Promise<void>
  renderMain: (row: T) => ReactNode
  renderActions?: (row: T) => ReactNode
}

function reorder<T extends RowBase>(rows: T[], fromId: string, toId: string) {
  const from = rows.findIndex(row => row.id === fromId)
  const to = rows.findIndex(row => row.id === toId)
  if (from < 0 || to < 0 || from === to) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function AdminSortableList<T extends RowBase>({ rows, sortable = true, disabled = false, emptyText = '등록된 항목이 없습니다.', onReorder, renderMain, renderActions }: Props<T>) {
  const [ordered, setOrdered] = useState<T[]>(rows)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const orderedRef = useRef<T[]>(rows)
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; active: boolean; timer: number | null } | null>(null)

  useEffect(() => {
    setOrdered(rows)
    orderedRef.current = rows
  }, [rows])

  function clearDrag() {
    const state = dragRef.current
    if (state?.timer) window.clearTimeout(state.timer)
    dragRef.current = null
    setDraggingId(null)
    document.body.classList.remove('admin-is-dragging')
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!sortable || disabled) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      timer: window.setTimeout(() => {
        if (!dragRef.current) return
        dragRef.current.active = true
        dragRef.current.timer = null
        setDraggingId(id)
        document.body.classList.add('admin-is-dragging')
      }, 180),
    }
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const state = dragRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!state.active) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 7) clearDrag()
      return
    }

    event.preventDefault()
    if (event.clientY < 90) window.scrollBy({ top: -18, behavior: 'auto' })
    if (event.clientY > window.innerHeight - 90) window.scrollBy({ top: 18, behavior: 'auto' })
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-sort-id]') as HTMLElement | null
    const targetId = target?.dataset.sortId
    if (!targetId || targetId === state.id) return
    const next = reorder(orderedRef.current, state.id, targetId)
    orderedRef.current = next
    setOrdered(next)
  }

  async function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const state = dragRef.current
    if (!state || state.pointerId !== event.pointerId) return
    const wasActive = state.active
    const before = rows
    const next = orderedRef.current
    clearDrag()

    if (wasActive && onReorder && next.map(row => row.id).join('|') !== before.map(row => row.id).join('|')) {
      try { await onReorder(next) }
      catch {
        setOrdered(before)
        orderedRef.current = before
      }
    }
  }

  async function keyboardMove(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (!sortable || disabled || !onReorder || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const index = orderedRef.current.findIndex(row => row.id === id)
    const target = event.key === 'ArrowUp' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= orderedRef.current.length) return
    const next = [...orderedRef.current]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setOrdered(next)
    orderedRef.current = next
    try { await onReorder(next) }
    catch {
      setOrdered(rows)
      orderedRef.current = rows
    }
  }

  if (!ordered.length) return <p className="admin-empty">{emptyText}</p>

  return <div className="admin-sortable-list">
    {ordered.map(row => <article className={`admin-list-row ${draggingId === row.id ? 'is-dragging' : ''}`} key={row.id} data-sort-id={row.id}>
      {sortable && <button
        className="drag-handle"
        type="button"
        aria-label="길게 누른 뒤 드래그하여 순서 변경. 키보드는 위/아래 방향키 사용"
        aria-grabbed={draggingId === row.id}
        disabled={disabled}
        onPointerDown={event => startDrag(event, row.id)}
        onPointerMove={moveDrag}
        onPointerUp={event => void finishDrag(event)}
        onPointerCancel={clearDrag}
        onKeyDown={event => void keyboardMove(event, row.id)}
      ><AppIcon name="grip" /></button>}
      <div className="admin-list-main">{renderMain(row)}</div>
      {renderActions && <div className="admin-list-actions">{renderActions(row)}</div>}
    </article>)}
  </div>
}
