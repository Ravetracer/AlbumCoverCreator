import { useCallback, useEffect, useRef } from 'react'
import { Group, Image as KonvaImage, Rect } from 'react-konva'
import Konva from 'konva'
import type { Filter } from 'konva/lib/Node'
import type { CanvasDoc, Layer, LayerMask } from '../../types'
import { useImage } from '../../hooks/useImage'
import { cacheForEditing } from '../../lib/cache'
import {
  layerLocalBox,
  linearMaskPoints,
  linearMaskStops,
  makeLuminanceToAlpha,
  maskTransform,
  radialMaskStops,
  type MaskBox,
} from '../../effects/mask'
import { useEditor } from '../../state/store'

// The layer's world transform, applied to a mask so it stays glued to the item.
function layerTransform(layer: Layer) {
  return {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
  }
}

// The mask itself, drawn with destination-in so it clips whatever was rendered
// before it. `box` is the reference frame: the layer's local box for a self mask
// (glued to the item) or the whole canvas for a "below" mask.
export function MaskShape({ mask, box }: { mask: LayerMask; box: MaskBox }) {
  if (mask.type === 'image') return <MaskImage mask={mask} box={box} />

  const common = {
    x: 0,
    y: 0,
    width: box.width,
    height: box.height,
    listening: false,
    globalCompositeOperation: 'destination-in' as const,
  }

  if (mask.type === 'radial') {
    return (
      <Rect
        {...common}
        fillRadialGradientStartPoint={{ x: mask.cx * box.width, y: mask.cy * box.height }}
        fillRadialGradientEndPoint={{ x: mask.cx * box.width, y: mask.cy * box.height }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndRadius={mask.radius * Math.min(box.width, box.height)}
        fillRadialGradientColorStops={radialMaskStops(mask)}
      />
    )
  }

  const { start, end } = linearMaskPoints(mask, box)
  return (
    <Rect
      {...common}
      fillLinearGradientStartPoint={start}
      fillLinearGradientEndPoint={end}
      fillLinearGradientColorStops={linearMaskStops(mask)}
    />
  )
}

// A grayscale image used as a mask: cached with the luminance→alpha filter so
// its brightness becomes the clip amount.
function MaskImage({ mask, box }: { mask: LayerMask; box: MaskBox }) {
  const ref = useRef<Konva.Image>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const [image, status] = useImage(mask.src ?? '')

  useEffect(() => {
    if (status !== 'loaded') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.filters([makeLuminanceToAlpha(mask.invert) as Filter])
      cacheForEditing(node)
      node.getLayer()?.batchDraw()
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [image, status, mask.invert])

  if (status !== 'loaded' || !image) return null
  const t = maskTransform(mask, box)
  return (
    <KonvaImage
      ref={ref}
      image={image}
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      scaleX={t.scaleX}
      scaleY={t.scaleY}
      listening={false}
      globalCompositeOperation="destination-in"
    />
  )
}

// On-canvas, movable/scalable/rotatable preview of an image mask, shown while
// editing. For a self mask it sits inside the layer's transform (local space) so
// its stored position stays glued to the item; for a below mask it's global.
export function MaskEditNode({
  layer,
  doc,
  registerRef,
}: {
  layer: Layer
  doc: CanvasDoc
  registerRef: (id: string, node: Konva.Node | null) => void
}) {
  const mask = layer.mask
  const updateLayer = useEditor((s) => s.updateLayer)
  const [image] = useImage(mask?.src ?? '')
  const refId = `${layer.id}__mask`

  if (!mask || mask.type !== 'image') return null
  const self = mask.target === 'self'
  const box: MaskBox = self ? layerLocalBox(layer, doc) : { width: doc.width, height: doc.height }
  const t = maskTransform(mask, box)

  const commit = (node: Konva.Node) => {
    updateLayer(layer.id, {
      mask: {
        ...mask,
        x: node.x(),
        y: node.y(),
        width: t.width,
        height: t.height,
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      },
    })
  }

  const editNode = (
    <Group
      ref={(n) => registerRef(refId, n)}
      x={t.x}
      y={t.y}
      rotation={t.rotation}
      scaleX={t.scaleX}
      scaleY={t.scaleY}
      draggable
      onDragEnd={(e) => commit(e.target)}
      onTransformEnd={(e) => commit(e.target)}
    >
      {/* The mask picture, dimmed so the artwork stays visible underneath. */}
      {image && <KonvaImage image={image} width={t.width} height={t.height} opacity={0.6} />}
      {/* Bounds outline so an empty / dark mask is still grabbable. */}
      <Rect
        width={t.width}
        height={t.height}
        stroke="#4f8cff"
        strokeScaleEnabled={false}
        dash={[12, 8]}
        fill="rgba(79,140,255,0.06)"
      />
    </Group>
  )

  // Self masks live in the item's local space, so wrap the editor in the layer's
  // transform; below masks are global and need no wrapper.
  if (self) {
    return <Group {...layerTransform(layer)}>{editNode}</Group>
  }
  return editNode
}

// "self" masking: isolate the layer + its mask inside a cached group so
// destination-in only affects this one layer. The mask is drawn in the layer's
// local space (wrapped in the layer's transform) so it moves with the item; the
// outer group carries the blend mode so blending against lower layers survives.
export function SelfMaskGroup({
  layer,
  doc,
  children,
}: {
  layer: Layer
  doc: CanvasDoc
  children: React.ReactNode
}) {
  const ref = useRef<Konva.Group>(null)
  const maskRef = useRef<Konva.Group>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const box = layerLocalBox(layer, doc)

  // Re-cache on the frame after the wrapped node has (re)cached itself, so the
  // group snapshots up-to-date content.
  const recache = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        const g = ref.current
        if (!g) return
        cacheForEditing(g)
        g.getLayer()?.batchDraw()
      })
    })
  }, [])

  // Keep the mask glued to the item live while the layer is dragged/transformed:
  // copy the dragged node's transform onto the mask group before re-caching. (On
  // release the store updates and the props below take over again.)
  const onLayerMove = (e: Konva.KonvaEventObject<Event>) => {
    const m = maskRef.current
    const node = e.target
    if (m && node) {
      m.position({ x: node.x(), y: node.y() })
      m.rotation(node.rotation())
      m.scaleX(node.scaleX())
      m.scaleY(node.scaleY())
    }
    recache()
  }

  useEffect(() => {
    recache()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [layer, recache])

  return (
    <Group
      ref={ref}
      name="mask-group"
      globalCompositeOperation={layer.blendMode}
      onDragMove={onLayerMove}
      onTransform={onLayerMove}
    >
      {children}
      <Group ref={maskRef} {...layerTransform(layer)}>
        {layer.mask && <MaskShape mask={layer.mask} box={box} />}
      </Group>
    </Group>
  )
}
