import { useCallback, useEffect, useRef } from 'react'
import { Group } from 'react-konva'
import Konva from 'konva'
import type { AdjustLayer } from '../../types'
import { buildFilterChain } from '../../effects/filterchain'
import { cacheForEditing } from '../../lib/cache'

// Wraps every layer stacked below it in a cached group and applies the
// adjustment layer's filter chain to the composited result — a global grade.
export function AdjustGroup({
  layer,
  onSelect,
  registerRef,
  children,
}: {
  layer: AdjustLayer
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
  children: React.ReactNode
}) {
  const ref = useRef<Konva.Group>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const a = layer.adjustments

  // Re-cache (double rAF, so wrapped nodes finish their own caching first) on any
  // change to this layer, when the children re-render, and during child drags.
  const recache = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        const node = ref.current
        if (!node) return
        node.filters(buildFilterChain(layer.adjustments, layer.effects))
        cacheForEditing(node)
        node.getLayer()?.batchDraw()
      })
    })
  }, [layer.adjustments, layer.effects])

  useEffect(() => {
    recache()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [recache, children])

  return (
    <Group
      ref={(n) => {
        ref.current = n
        registerRef(layer.id, n)
      }}
      id={layer.id}
      name="adjust-group"
      opacity={layer.opacity}
      visible={layer.visible}
      globalCompositeOperation={layer.blendMode}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={recache}
      onTransform={recache}
      brightness={a.brightness}
      contrast={a.contrast}
      hue={a.hue}
      saturation={a.saturation}
      value={a.luminance}
      blurRadius={a.blur}
    >
      {children}
    </Group>
  )
}
