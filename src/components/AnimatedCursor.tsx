import { useEffect } from 'react'
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

const FRAME_SIZE = 64
const OUTPUT_SIZE = 48

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

function usesNativePopup(target: EventTarget | null) {
  const el = elementFromTarget(target)
  return Boolean(
    el?.closest(
      'select, option, input[type="date"], input[type="time"], input[type="file"], input[type="color"]',
    ),
  )
}

function cursorForTarget(target: EventTarget | null): CursorName {
  if (document.body.classList.contains('admin-is-dragging')) return 'move'

  const el = elementFromTarget(target)
  if (!el) return 'normal'

  // Keep one uninterrupted cursor on the public site so it never disappears
  // when crossing links, buttons, text or other interactive elements.
  const inAdmin = Boolean(el.closest('.admin-shell, .login-page, .admin-login-page'))
  if (!inAdmin) return 'normal'

  const explicit = el.closest<HTMLElement>('[data-cursor]')?.dataset.cursor as CursorName | undefined
  if (explicit && CURSORS[explicit]) return explicit

  if (el.closest(':disabled, [aria-disabled="true"]')) return 'unavailable'
  if (el.closest('[aria-busy="true"], .cursor-busy')) return 'busy'
  if (el.closest('.cursor-working')) return 'working'
  if (el.closest('.drag-handle')) return 'move'

  if (
    el.closest(
      'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="number"], input[type="password"], input[type="email"]',
    )
  ) {
    return 'text'
  }

  if (
    el.closest(
      'a, button, summary, label[for], [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], input[type="range"]',
    )
  ) {
    return 'link'
  }

  return 'normal'
}

export function AnimatedCursor() {
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)')
    if (!finePointer.matches) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const atlas = new Image()
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = OUTPUT_SIZE
    frameCanvas.height = OUTPUT_SIZE

    const contextCandidate = frameCanvas.getContext('2d')
    if (!contextCandidate) return
    const context: CanvasRenderingContext2D = contextCandidate

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    const styleElement = document.createElement('style')
    styleElement.setAttribute('data-namra-animated-cursor', '')
    document.head.appendChild(styleElement)

    let disposed = false
    let ready = false
    let nativePopup = false
    let state: CursorName = 'normal'
    let frame = 0
    let lastFrame = performance.now()
    let raf = 0
    let lastX = -1
    let lastY = -1

    const frameCache = new Map<string, string>()

    function scaledHotspotX(name: CursorName) {
      return Math.round(CURSORS[name].hotspotX * (OUTPUT_SIZE / FRAME_SIZE))
    }

    function scaledHotspotY(name: CursorName) {
      return Math.round(CURSORS[name].hotspotY * (OUTPUT_SIZE / FRAME_SIZE))
    }

    function frameUrl(name: CursorName, frameIndex: number) {
      const key = `${name}:${frameIndex}`
      const cached = frameCache.get(key)
      if (cached) return cached

      const config = CURSORS[name]
      context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      // Uniform X/Y scaling only: the original frame is never cropped or
      // stretched into a different aspect ratio.
      context.drawImage(
        atlas,
        frameIndex * FRAME_SIZE,
        config.row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      )

      const url = frameCanvas.toDataURL('image/png')
      frameCache.set(key, url)
      return url
    }

    function cursorValue() {
      const url = frameUrl(state, frame)
      return `url("${url}") ${scaledHotspotX(state)} ${scaledHotspotY(state)}, auto`
    }

    function applyCursor() {
      if (!ready) return

      document.documentElement.classList.add('namra-animated-cursor-ready')
      document.documentElement.classList.toggle('namra-native-cursor-control', nativePopup)

      if (nativePopup) {
        styleElement.textContent = `
html.namra-animated-cursor-ready,
html.namra-animated-cursor-ready body,
html.namra-animated-cursor-ready body * {
  cursor: auto !important;
}
`
        return
      }

      const value = cursorValue()
      styleElement.textContent = `
html.namra-animated-cursor-ready,
html.namra-animated-cursor-ready body,
html.namra-animated-cursor-ready body * {
  cursor: ${value} !important;
}

html.namra-animated-cursor-ready select,
html.namra-animated-cursor-ready option,
html.namra-animated-cursor-ready input[type='date'],
html.namra-animated-cursor-ready input[type='time'],
html.namra-animated-cursor-ready input[type='file'],
html.namra-animated-cursor-ready input[type='color'] {
  cursor: auto !important;
}
`
    }

    function syncTarget(target: EventTarget | null) {
      nativePopup = usesNativePopup(target)
      state = nativePopup ? 'normal' : cursorForTarget(target)
      frame = 0
      lastFrame = performance.now()
      applyCursor()
    }

    function handlePointer(event: PointerEvent) {
      if (event.pointerType && event.pointerType !== 'mouse') return
      lastX = event.clientX
      lastY = event.clientY
      syncTarget(event.target)
    }

    function handlePointerEvent(event: Event) {
      handlePointer(event as PointerEvent)
    }

    function handleVisibility() {
      if (document.hidden || lastX < 0 || lastY < 0) return
      syncTarget(document.elementFromPoint(lastX, lastY))
    }

    function animate(now: number) {
      if (disposed) return

      if (ready && !nativePopup && !document.hidden && !reducedMotion.matches) {
        const config = CURSORS[state]
        if (now - lastFrame >= config.frameMs) {
          const steps = Math.max(1, Math.floor((now - lastFrame) / config.frameMs))
          frame = (frame + steps) % config.frames
          lastFrame += steps * config.frameMs
          applyCursor()
        }
      }

      raf = requestAnimationFrame(animate)
    }

    atlas.onload = () => {
      if (disposed) return
      ready = true

      // Build all frames once. Subsequent animation only switches cached
      // transparent PNG cursor URLs instead of moving a square DOM layer.
      ;(Object.keys(CURSORS) as CursorName[]).forEach(name => {
        const config = CURSORS[name]
        for (let index = 0; index < config.frames; index += 1) {
          frameUrl(name, index)
        }
      })

      applyCursor()
      raf = requestAnimationFrame(animate)
    }

    atlas.onerror = () => {
      ready = false
      document.documentElement.classList.remove('namra-animated-cursor-ready')
      document.documentElement.classList.remove('namra-native-cursor-control')
      styleElement.textContent = ''
    }

    atlas.src = CURSOR_ATLAS_DATA_URL

    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('pointerover', handlePointer, { passive: true })
    document.addEventListener('pointerdown', handlePointerEvent, true)
    document.addEventListener('pointerup', handlePointerEvent, true)
    document.addEventListener('pointercancel', handlePointerEvent, true)
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', handlePointer)
      window.removeEventListener('pointerover', handlePointer)
      document.removeEventListener('pointerdown', handlePointerEvent, true)
      document.removeEventListener('pointerup', handlePointerEvent, true)
      document.removeEventListener('pointercancel', handlePointerEvent, true)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
      document.documentElement.classList.remove('namra-animated-cursor-ready')
      document.documentElement.classList.remove('namra-native-cursor-control')
      styleElement.remove()
    }
  }, [])

  return null
}
