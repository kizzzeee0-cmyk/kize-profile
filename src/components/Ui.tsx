import { useEffect, useRef, type ReactNode } from 'react'

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="section-heading"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function LoadingBlocks() {
  return <div className="skeleton-wrap"><div className="skeleton large"/><div className="skeleton"/><div className="skeleton"/></div>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    document.addEventListener('keydown', onKey)

    // Focus only once when the modal opens. Do not steal focus again while
    // controlled form fields re-render during typing or IME composition.
    const timer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [open])

  if (!open) return null

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h3>{title}</h3><button ref={closeRef} type="button" onClick={() => onCloseRef.current()} aria-label="닫기">×</button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}

export function StatusMessage({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error'; children: ReactNode }) {
  return <div className={`status-message ${tone}`}>{children}</div>
}
