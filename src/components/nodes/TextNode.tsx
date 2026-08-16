import { useCallback, useEffect, useRef, useState } from 'react'
import { Text as KonvaText, TextPath as KonvaTextPath } from 'react-konva'
import Konva from 'konva'
import type { Filter } from 'konva/lib/Node'
import type { TextLayer } from '../../types'
import { useEditor } from '../../state/store'
import { ensureFontReady, isFontReady } from '../../fonts/fonts'
import { makeChromaShift } from '../../effects/filters'
import { cacheForEditing } from '../../lib/cache'

interface Props {
  layer: TextLayer
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
}

// Approximate rendered text width for building the curve path.
function estimateWidth(layer: TextLayer): number {
  return Math.max(40, layer.text.length * layer.fontSize * 0.55 + layer.letterSpacing * layer.text.length)
}

// Quadratic bezier arc; positive curve bulges upward (smile).
function curvePath(layer: TextLayer): string {
  const w = estimateWidth(layer)
  const cpY = -(layer.curve / 100) * w * 0.5
  return `M ${-w / 2},0 Q 0,${cpY} ${w / 2},0`
}

export function TextNode({ layer, onSelect, registerRef }: Props) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const nodeRef = useRef<Konva.Node | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const bold = layer.fontStyle.includes('bold')
  // Gate rendering until the web font is measurable. Initialised synchronously
  // so already-loaded (and system) fonts render immediately without a flicker.
  const [fontReady, setFontReady] = useState(() => isFontReady(layer.fontFamily, bold))

  // Chromatic aberration caches the text and channel-shifts it (crisp/uncached
  // otherwise). Caching is gated behind the font being ready — caching with
  // fallback metrics can produce a 0-size cache canvas Konva then fails to draw.
  const applyFilters = useCallback(() => {
    const node = nodeRef.current
    if (!node) return
    if (layer.chromAmount <= 0) {
      // Only touch a node that was actually cached before; forcing a draw of
      // not-yet-measured text (web font still loading) makes Konva try to draw
      // a 0-size canvas.
      if (node.isCached()) {
        node.filters([])
        node.clearCache()
        node.getLayer()?.batchDraw()
      }
      node.setAttr('chromaPx', 0)
      return
    }
    ensureFontReady(layer.fontFamily, layer.fontStyle.includes('bold')).then(() => {
      const n = nodeRef.current
      if (!n || layer.chromAmount <= 0) return
      const rect = n.getClientRect({ skipTransform: true, skipShadow: true, skipStroke: false })
      if (rect.width < 1 || rect.height < 1) { n.filters([]); n.clearCache(); n.getLayer()?.batchDraw(); return }
      n.filters([makeChromaShift(layer.chromAmount, layer.chromAngle) as Filter])
      n.setAttr('chromaPx', layer.chromAmount)
      cacheForEditing(n)
      n.getLayer()?.batchDraw()
    })
  }, [layer.chromAmount, layer.chromAngle, layer.fontFamily, layer.fontStyle])

  useEffect(() => {
    if (!fontReady) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyFilters)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [
    fontReady, applyFilters, layer.text, layer.fontSize,
    layer.fill, layer.letterSpacing, layer.lineHeight, layer.width, layer.align,
    layer.curve, layer.strokeEnabled, layer.stroke, layer.strokeWidth,
    layer.glowEnabled, layer.glowColor, layer.glowBlur,
  ])

  // Flip fontReady on once the (async) web/custom font is available, so the
  // text mounts with correct metrics instead of drawing a 0-size fallback.
  useEffect(() => {
    setFontReady(isFontReady(layer.fontFamily, bold))
    let cancelled = false
    ensureFontReady(layer.fontFamily, bold).then(() => { if (!cancelled) setFontReady(true) })
    return () => { cancelled = true }
  }, [layer.fontFamily, bold])

  if (!fontReady) return null

  const glow = layer.glowEnabled
    ? {
        shadowEnabled: true,
        shadowColor: layer.glowColor,
        shadowBlur: layer.glowBlur,
        shadowOpacity: 1,
        shadowForStrokeEnabled: true,
      }
    : { shadowEnabled: false }
  const stroke = layer.strokeEnabled
    ? { stroke: layer.stroke, strokeWidth: layer.strokeWidth, fillAfterStrokeEnabled: true }
    : {}

  const shared = {
    ref: (n: Konva.Node | null) => { nodeRef.current = n; registerRef(layer.id, n) },
    id: layer.id,
    name: 'layer',
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    skewX: layer.skewX,
    skewY: layer.skewY,
    opacity: layer.opacity,
    visible: layer.visible,
    globalCompositeOperation: layer.blendMode,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontStyle: layer.fontStyle,
    fill: layer.fill,
    letterSpacing: layer.letterSpacing,
    draggable: !layer.locked,
    ...glow,
    ...stroke,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      updateLayer(layer.id, { x: e.target.x(), y: e.target.y() }),
  }

  // Curved text renders along a path; straight text uses the wrapping Text node.
  if (layer.curve !== 0) {
    return (
      <KonvaTextPath
        {...shared}
        text={layer.text}
        data={curvePath(layer)}
        align="center"
        onTransformEnd={(e) => {
          const node = e.target
          updateLayer(layer.id, {
            x: node.x(), y: node.y(), rotation: node.rotation(),
            scaleX: node.scaleX(), scaleY: node.scaleY(),
          })
        }}
      />
    )
  }

  return (
    <KonvaText
      {...shared}
      text={layer.text}
      align={layer.align}
      lineHeight={layer.lineHeight}
      width={layer.width}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Text
        // Bake horizontal scale into width so glyphs stay crisp.
        const scaleX = node.scaleX()
        const newWidth = Math.max(20, (layer.width ?? node.width()) * scaleX)
        node.scaleX(1)
        updateLayer(layer.id, {
          x: node.x(), y: node.y(), rotation: node.rotation(),
          width: newWidth, scaleX: 1, scaleY: node.scaleY(),
        })
      }}
    />
  )
}
