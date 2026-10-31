import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  file: File
  aspect: number
  outputWidth: number
  outputHeight: number
  onCancel: () => void
  onApply: (file: File) => void
}

type ImageSize = { width: number; height: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function ImageCropEditor({ file, aspect, outputWidth, outputHeight, onCancel, onApply }: Props) {
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 1, height: 1 })
  const [zoom, setZoom] = useState(1)
  const [positionX, setPositionX] = useState(0)
  const [positionY, setPositionY] = useState(0)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSourceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const previewStyle = useMemo(() => {
    const imageAspect = imageSize.width / imageSize.height
    const containerAspect = aspect

    let widthPercent = 100
    let heightPercent = 100

    if (imageAspect > containerAspect) {
      heightPercent = zoom * 100
      widthPercent = zoom * 100 * (imageAspect / containerAspect)
    } else {
      widthPercent = zoom * 100
      heightPercent = zoom * 100 * (containerAspect / imageAspect)
    }

    const overflowX = Math.max(0, widthPercent - 100)
    const overflowY = Math.max(0, heightPercent - 100)
    const translateX = (positionX / 100) * (overflowX / 2)
    const translateY = (positionY / 100) * (overflowY / 2)

    return {
      width: `${widthPercent}%`,
      height: `${heightPercent}%`,
      left: `calc(50% + ${translateX}%)`,
      top: `calc(50% + ${translateY}%)`,
    }
  }, [aspect, imageSize, positionX, positionY, zoom])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, startX: positionX, startY: positionY }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    setPositionX(clamp(dragRef.current.startX + (dx / Math.max(rect.width, 1)) * 180, -100, 100))
    setPositionY(clamp(dragRef.current.startY + (dy / Math.max(rect.height, 1)) * 180, -100, 100))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function reset() {
    setZoom(1)
    setPositionX(0)
    setPositionY(0)
  }

  async function applyCrop() {
    if (!sourceUrl || saving) return
    setSaving(true)

    try {
      const image = new Image()
      image.decoding = 'async'
      image.src = sourceUrl
      await image.decode()

      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('이미지 편집을 시작할 수 없습니다.')

      const baseScale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight)
      const scale = baseScale * zoom
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      const overflowX = Math.max(0, drawWidth - outputWidth)
      const overflowY = Math.max(0, drawHeight - outputHeight)
      const x = (outputWidth - drawWidth) / 2 + (positionX / 100) * (overflowX / 2)
      const y = (outputHeight - drawHeight) / 2 + (positionY / 100) * (overflowY / 2)

      ctx.clearRect(0, 0, outputWidth, outputHeight)
      ctx.drawImage(image, x, y, drawWidth, drawHeight)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error('크롭 이미지 생성에 실패했습니다.')), 'image/png')
      })

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'wardrobe'
      onApply(new File([blob], `${baseName}-crop.png`, { type: 'image/png' }))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '이미지 크롭에 실패했습니다.')
      setSaving(false)
    }
  }

  return <div className="image-crop-overlay" role="dialog" aria-modal="true" aria-label="이미지 크롭">
    <div className="image-crop-dialog">
      <div className="image-crop-head">
        <div>
          <strong>옷장 이미지 크롭</strong>
          <span>4:5 비율 · 드래그로 위치를 조정하세요.</span>
        </div>
        <button type="button" className="image-crop-close" onClick={onCancel} aria-label="닫기">×</button>
      </div>

      <div className="image-crop-body">
        <div
          className="image-crop-stage"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {sourceUrl && <img
            src={sourceUrl}
            alt="크롭 미리보기"
            draggable={false}
            onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            style={previewStyle}
          />}
          <div className="image-crop-guide" aria-hidden="true" />
        </div>

        <div className="image-crop-controls">
          <label>
            <span>확대 / 축소 <b>{Math.round(zoom * 100)}%</b></span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          </label>
          <label>
            <span>좌우 위치 <b>{Math.round(positionX)}</b></span>
            <input type="range" min="-100" max="100" step="1" value={positionX} onChange={e => setPositionX(Number(e.target.value))} />
          </label>
          <label>
            <span>상하 위치 <b>{Math.round(positionY)}</b></span>
            <input type="range" min="-100" max="100" step="1" value={positionY} onChange={e => setPositionY(Number(e.target.value))} />
          </label>
          <button type="button" className="admin-secondary compact image-crop-reset" onClick={reset}>위치 초기화</button>
        </div>
      </div>

      <div className="image-crop-actions">
        <button type="button" className="admin-secondary" disabled={saving} onClick={onCancel}>취소</button>
        <button type="button" className="admin-primary" disabled={saving} onClick={() => void applyCrop()}>
          {saving ? '이미지 처리 중...' : '크롭 적용'}
        </button>
      </div>
    </div>
  </div>
}
