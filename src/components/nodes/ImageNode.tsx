import { useEffect, useRef } from 'react'
import { Image as KonvaImage } from 'react-konva'
import Konva from 'konva'
import type { Filter } from 'konva/lib/Node'
import { useImage } from '../../hooks/useImage'
import type { ImageLayer } from '../../types'
import { useEditor } from '../../state/store'
import { buildFilter } from '../../effects/registry'
import { makeTone, makeDetail } from '../../effects/filters'
import { cacheForEditing } from '../../lib/cache'

interface Props {
  layer: ImageLayer
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
}

// Compose the full filter chain: basic adjustments (Konva built-ins) first,
// then the creative effect stack in order.
function buildFilters(layer: ImageLayer): Filter[] {
  const a = layer.adjustments
  const f: Filter[] = [
    Konva.Filters.Brighten,
    Konva.Filters.Contrast,
    Konva.Filters.HSV,
  ]
  const tone = makeTone(a)
  if (tone) f.push(tone as Filter)
  const detail = makeDetail(a)
  if (detail) f.push(detail as Filter)
  if (a.blur > 0) f.push(Konva.Filters.Blur)
  if (a.grayscale >= 0.5) f.push(Konva.Filters.Grayscale)
  if (a.sepia >= 0.5) f.push(Konva.Filters.Sepia)
  for (const effect of layer.effects) {
    if (!effect.enabled) continue
    const filter = buildFilter(effect)
    if (filter) f.push(filter as Filter)
  }
  return f
}

export function ImageNode({ layer, onSelect, registerRef }: Props) {
  const nodeRef = useRef<Konva.Image>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const [image, status] = useImage(layer.src)
  const updateLayer = useEditor((s) => s.updateLayer)

  // Re-cache (coalesced to one per frame) whenever anything that affects the
  // rendered pixels changes. Filters only take effect on a cached node.
  useEffect(() => {
    if (status !== 'loaded') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const node = nodeRef.current
      if (!node) return
      cacheForEditing(node)
      node.getLayer()?.batchDraw()
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [
    image,
    status,
    layer.adjustments,
    layer.effects,
    layer.naturalWidth,
    layer.naturalHeight,
    layer.cropTop,
    layer.cropRight,
    layer.cropBottom,
    layer.cropLeft,
  ])

  useEffect(() => {
    registerRef(layer.id, nodeRef.current)
    return () => registerRef(layer.id, null)
  }, [layer.id, registerRef, status])

  if (status !== 'loaded' || !image) return null

  const a = layer.adjustments

  // Crop: convert inset fractions to a natural-pixel rect. When active, the
  // node's width/height match the cropped region so aspect stays correct.
  const hasCrop =
    layer.cropTop > 0 || layer.cropRight > 0 || layer.cropBottom > 0 || layer.cropLeft > 0
  const cropX = layer.cropLeft * layer.naturalWidth
  const cropY = layer.cropTop * layer.naturalHeight
  const cropW = (1 - layer.cropLeft - layer.cropRight) * layer.naturalWidth
  const cropH = (1 - layer.cropTop - layer.cropBottom) * layer.naturalHeight
  const cropProps = hasCrop
    ? { crop: { x: cropX, y: cropY, width: cropW, height: cropH }, width: cropW, height: cropH }
    : {}

  return (
    <KonvaImage
      ref={nodeRef}
      image={image}
      id={layer.id}
      name="layer"
      {...cropProps}
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      globalCompositeOperation={layer.blendMode}
      draggable={!layer.locked}
      filters={buildFilters(layer)}
      brightness={a.brightness}
      contrast={a.contrast}
      hue={a.hue}
      saturation={a.saturation}
      value={a.luminance}
      blurRadius={a.blur}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) =>
        updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })
      }
      onTransformEnd={(e) => {
        const node = e.target
        updateLayer(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        })
      }}
    />
  )
}
