import { useEffect, useRef } from 'react'
import { CURSOR_ATLAS_DATA_URL } from '../cursorAtlas'

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

const DRAW_SIZE = 36
const NATIVE_SIZE = 64
const CANVAS_SIZE = 44
const FRAME_PADDING = (CANVAS_SIZE - DRAW_SIZE) / 2

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

  // Public pages intentionally keep one continuous animated cursor state.
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
  const cursorRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)')
    if (!finePointer.matches) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canvas = cursorRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(CANVAS_SIZE * dpr)
    canvas.height = Math.round(CANVAS_SIZE * dpr)
    canvas.style.width = `${CANVAS_SIZE}px`
    canvas.style.height = `${CANVAS_SIZE}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

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

    const scale = DRAW_SIZE / NATIVE_SIZE
    const atlasImage = new Image()

    function paintFrame() {
      if (!ready) return
      const config = CURSORS[state]
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.drawImage(
        atlasImage,
        frame * NATIVE_SIZE,
        config.row * NATIVE_SIZE,
        NATIVE_SIZE,
        NATIVE_SIZE,
        FRAME_PADDING,
        FRAME_PADDING,
        DRAW_SIZE,
        DRAW_SIZE,
      )
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
      const wantedX = x - FRAME_PADDING - config.hotspotX * scale
      const wantedY = y - FRAME_PADDING - config.hotspotY * scale
      const maxX = Math.max(0, window.innerWidth - CANVAS_SIZE)
      const maxY = Math.max(0, window.innerHeight - CANVAS_SIZE)
      const drawX = Math.min(maxX, Math.max(0, wantedX))
      const drawY = Math.min(maxY, Math.max(0, wantedY))
      canvas.style.transform = `translate3d(${drawX}px, ${drawY}px, 0)`
    }

    function queuePosition() {
      if (pendingMove) return
      pendingMove = true
      requestAnimationFrame(updatePosition)
    }

    function show() {
      if (!ready || nativePopup) return
      visible = true
      canvas.style.opacity = '1'
    }

    function hide() {
      visible = false
      canvas.style.opacity = '0'
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

    atlasImage.onload = () => {
      if (disposed) return
      ready = true
      paintFrame()
      document.documentElement.classList.add('namra-animated-cursor-ready')
      focusWindow()
    }
    atlasImage.onerror = () => {
      ready = false
      document.documentElement.classList.remove('namra-animated-cursor-ready')
      document.documentElement.classList.remove('namra-native-cursor-control')
      hide()
    }
    atlasImage.src = CURSOR_ATLAS_DATA_URL

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

  return <canvas ref={cursorRef} className="namra-animated-cursor-layer" aria-hidden="true" />
}
