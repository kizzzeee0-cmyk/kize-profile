import { useEffect, useRef } from 'react'
import {
  CURSOR_ATLAS_DATA_URL,
  CURSOR_ATLAS_NATIVE_HEIGHT,
  CURSOR_ATLAS_NATIVE_WIDTH,
} from '../cursorAtlas'

type CursorName =
  | 'normal' | 'link' | 'text' | 'alternate' | 'busy' | 'working' | 'unavailable'
  | 'move' | 'resize-ew' | 'resize-ns' | 'resize-nwse' | 'resize-nesw' | 'location' | 'person'

type CursorConfig = {
  row: number
  frames: number
  frameMs: number
  hotspotX: number
  hotspotY: number
}

const DISPLAY_SIZE = 36
const NATIVE_SIZE = 64

const POINTER_HOTSPOT = { hotspotX: 0, hotspotY: 0 }
const CENTER_HOTSPOT = { hotspotX: 31, hotspotY: 32 }

const CURSORS: Record<CursorName, CursorConfig> = {
  normal: { row: 0, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  link: { row: 1, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  text: { row: 2, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  alternate: { row: 3, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  busy: { row: 4, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  working: { row: 5, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  unavailable: { row: 6, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  move: { row: 7, frames: 8, frameMs: 100, ...CENTER_HOTSPOT },
  'resize-ew': { row: 8, frames: 8, frameMs: 100, ...CENTER_HOTSPOT },
  'resize-ns': { row: 9, frames: 8, frameMs: 100, ...CENTER_HOTSPOT },
  'resize-nwse': { row: 10, frames: 8, frameMs: 100, ...CENTER_HOTSPOT },
  'resize-nesw': { row: 11, frames: 8, frameMs: 100, ...CENTER_HOTSPOT },
  location: { row: 12, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
  person: { row: 13, frames: 8, frameMs: 83.333, ...POINTER_HOTSPOT },
}

function elementFromTarget(target: EventTarget | null) {
  return target instanceof Element ? target : null
}

function cursorForTarget(target: EventTarget | null): CursorName {
  if (document.body.classList.contains('admin-is-dragging')) return 'move'
  const el = elementFromTarget(target)
  if (!el) return 'normal'

  // Public pages keep the same animated cursor on links, buttons and text.
  // This mirrors the reference site's "always-visible" feel and avoids
  // disappearing frames when switching to a secondary cursor row.
  const inAdmin = Boolean(el.closest('.admin-shell, .login-page, .admin-login-page'))
  if (!inAdmin) return 'normal'

  const explicit = el.closest<HTMLElement>('[data-cursor]')?.dataset.cursor as CursorName | undefined
  if (explicit && CURSORS[explicit]) return explicit

  if (el.closest(':disabled, [aria-disabled="true"]')) return 'unavailable'
  if (el.closest('[aria-busy="true"], .cursor-busy')) return 'busy'
  if (el.closest('.cursor-working')) return 'working'
  if (el.closest('.drag-handle')) return 'move'
  if (el.closest('textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="number"], input[type="password"], input[type="email"]')) return 'text'
  if (el.closest('a, button, summary, label[for], [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], input[type="range"]')) return 'link'
  return 'normal'
}

function usesNativePopup(target: EventTarget | null) {
  const el = elementFromTarget(target)
  return Boolean(el?.closest('select, option, input[type="date"], input[type="time"], input[type="file"], input[type="color"]'))
}

export function AnimatedCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)')
    if (!finePointer.matches) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const element = cursorRef.current
    if (!element) return
    const el: HTMLDivElement = element

    let disposed = false
    let ready = false
    let visible = false
    let nativePopup = false
    let state: CursorName = 'normal'
    let frame = 0
    let lastFrame = performance.now()
    let raf = 0
    let x = -100
    let y = -100
    let pendingMove = false

    const scale = DISPLAY_SIZE / NATIVE_SIZE
    el.style.width = `${DISPLAY_SIZE}px`
    el.style.height = `${DISPLAY_SIZE}px`
    el.style.backgroundSize = `${CURSOR_ATLAS_NATIVE_WIDTH * scale}px ${CURSOR_ATLAS_NATIVE_HEIGHT * scale}px`

    function paintFrame() {
      const config = CURSORS[state]
      el.style.backgroundPosition = `${-frame * DISPLAY_SIZE}px ${-config.row * DISPLAY_SIZE}px`
    }

    function setState(next: CursorName) {
      if (state === next) return
      state = next
      frame = 0
      lastFrame = performance.now()
      paintFrame()
    }

    function updatePosition() {
      pendingMove = false
      const config = CURSORS[state]
      const wantedX = x - config.hotspotX * scale
      const wantedY = y - config.hotspotY * scale
      const maxX = Math.max(0, window.innerWidth - DISPLAY_SIZE)
      const maxY = Math.max(0, window.innerHeight - DISPLAY_SIZE)
      const drawX = Math.min(maxX, Math.max(0, wantedX))
      const drawY = Math.min(maxY, Math.max(0, wantedY))
      el.style.transform = `translate3d(${drawX}px, ${drawY}px, 0)`
    }

    function queuePosition() {
      if (pendingMove) return
      pendingMove = true
      requestAnimationFrame(updatePosition)
    }

    function show() {
      if (!ready || nativePopup) return
      visible = true
      el.style.opacity = '1'
    }

    function hide() {
      visible = false
      el.style.opacity = '0'
    }

    function syncTarget(target: EventTarget | null) {
      nativePopup = usesNativePopup(target)
      document.documentElement.classList.toggle('namra-native-cursor-control', nativePopup)
      if (nativePopup) {
        hide()
        return
      }
      setState(cursorForTarget(target))
      show()
    }

    function track(event: PointerEvent) {
      if (event.pointerType && event.pointerType !== 'mouse') return
      x = event.clientX
      y = event.clientY
      syncTarget(event.target)
      queuePosition()
    }

    function interact(event: PointerEvent) {
      if (event.pointerType && event.pointerType !== 'mouse') return
      x = event.clientX
      y = event.clientY
      syncTarget(event.target)
      updatePosition()
    }

    function focusWindow() {
      if (x < 0 || y < 0) return
      const target = document.elementFromPoint(x, y)
      syncTarget(target)
      updatePosition()
    }

    function blurWindow() {
      hide()
    }

    function visibilityChange() {
      if (document.hidden) hide()
      else focusWindow()
    }

    function animate(now: number) {
      if (disposed) return
      const config = CURSORS[state]

      if (document.body.classList.contains('admin-is-dragging') && state !== 'move') {
        setState('move')
      }

      if (ready && visible && !nativePopup && !document.hidden && !reducedMotion.matches && now - lastFrame >= config.frameMs) {
        const steps = Math.max(1, Math.floor((now - lastFrame) / config.frameMs))
        frame = (frame + steps) % config.frames
        lastFrame += steps * config.frameMs
        paintFrame()
      }

      raf = requestAnimationFrame(animate)
    }

    const image = new Image()
    image.onload = () => {
      if (disposed) return
      ready = true
      el.style.backgroundImage = `url("${CURSOR_ATLAS_DATA_URL}")`
      paintFrame()
      document.documentElement.classList.add('namra-animated-cursor-ready')
      focusWindow()
    }
    image.onerror = () => {
      ready = false
      document.documentElement.classList.remove('namra-animated-cursor-ready')
      document.documentElement.classList.remove('namra-native-cursor-control')
      hide()
    }
    image.src = CURSOR_ATLAS_DATA_URL

    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('pointerover', track, { passive: true })
    document.addEventListener('pointerdown', interact, true)
    document.addEventListener('pointerup', interact, true)
    document.addEventListener('pointercancel', interact, true)
    window.addEventListener('focus', focusWindow)
    window.addEventListener('blur', blurWindow)
    window.addEventListener('resize', queuePosition)
    document.addEventListener('visibilitychange', visibilityChange)
    raf = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerover', track)
      document.removeEventListener('pointerdown', interact, true)
      document.removeEventListener('pointerup', interact, true)
      document.removeEventListener('pointercancel', interact, true)
      window.removeEventListener('focus', focusWindow)
      window.removeEventListener('blur', blurWindow)
      window.removeEventListener('resize', queuePosition)
      document.removeEventListener('visibilitychange', visibilityChange)
      document.documentElement.classList.remove('namra-animated-cursor-ready')
      document.documentElement.classList.remove('namra-native-cursor-control')
    }
  }, [])

  return <div ref={cursorRef} className="namra-animated-cursor-layer" aria-hidden="true" />
}
