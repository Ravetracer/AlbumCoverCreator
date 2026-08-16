import { useEffect, useRef } from 'react'
import { Group, Rect, Ellipse, RegularPolygon, Star, Line } from 'react-konva'
import Konva from 'konva'
import type { ShapeLayer } from '../../types'
import { useEditor } from '../../state/store'
import { fillProps, glowProps, strokeProps } from '../../effects/vector'
import { cacheForEditing } from '../../lib/cache'
import { GaussianBlurFilter, makeChromaShift } from '../../effects/filters'
import type { Filter } from 'konva/lib/Node'

interface Props {
  layer: ShapeLayer
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
}

export function ShapeNode({ layer, onSelect, registerRef }: Props) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const groupRef = useRef<Konva.Group>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const { width: w, height: h } = layer

  // Body blur (true gaussian) and chromatic aberration both need the group
  // cached with a pixel filter. When neither is active we drop the cache so
  // fills/strokes/glow render crisply and vector-sharp.
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const node = groupRef.current
      if (!node) return
      const filters: Filter[] = []
      if (layer.blur > 0) { node.blurRadius(layer.blur); filters.push(GaussianBlurFilter as Filter) }
      if (layer.chromAmount > 0) filters.push(makeChromaShift(layer.chromAmount, layer.chromAngle) as Filter)
      node.setAttr('chromaPx', layer.chromAmount > 0 ? layer.chromAmount : 0)
      if (filters.length > 0) {
        node.filters(filters)
        cacheForEditing(node)
      } else {
        node.filters([])
        node.clearCache()
      }
      node.getLayer()?.batchDraw()
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [
    layer.blur, layer.chromAmount, layer.chromAngle,
    layer.width, layer.height, layer.shape, layer.fillMode,
    layer.fill, layer.gradFrom, layer.gradTo, layer.gradAngle,
    layer.strokeEnabled, layer.stroke, layer.strokeWidth, layer.cornerRadius,
    layer.sides, layer.starPoints, layer.starInner, layer.startWidth,
    layer.endWidth, layer.glowEnabled, layer.glowColor, layer.glowBlur,
  ])
  const glow = glowProps(layer)
  const stroke = strokeProps(layer)

  // Center-origin shapes vs top-left shapes affect gradient coordinates.
  const centered = layer.shape !== 'rect' && layer.shape !== 'line'
  const fill = fillProps(layer, w, h, centered)
  const common = { ...fill, ...glow, ...stroke }

  let shape = null
  switch (layer.shape) {
    case 'rect':
      shape = <Rect width={w} height={h} cornerRadius={layer.cornerRadius} {...common} />
      break
    case 'ellipse':
      shape = <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} {...common} />
      break
    case 'triangle':
      shape = (
        <RegularPolygon x={w / 2} y={h / 2} sides={3} radius={Math.min(w, h) / 2} {...common} />
      )
      break
    case 'polygon':
      shape = (
        <RegularPolygon x={w / 2} y={h / 2} sides={layer.sides} radius={Math.min(w, h) / 2} {...common} />
      )
      break
    case 'star':
      shape = (
        <Star
          x={w / 2}
          y={h / 2}
          numPoints={layer.starPoints}
          innerRadius={(Math.min(w, h) / 2) * layer.starInner}
          outerRadius={Math.min(w, h) / 2}
          {...common}
        />
      )
      break
    case 'line': {
      const sw = layer.startWidth
      const ew = layer.endWidth
      const points = [
        0, h / 2 - sw / 2,
        w, h / 2 - ew / 2,
        w, h / 2 + ew / 2,
        0, h / 2 + sw / 2,
      ]
      shape = <Line points={points} closed lineJoin="round" {...common} />
      break
    }
  }

  return (
    <Group
      ref={(n) => {
        groupRef.current = n
        registerRef(layer.id, n)
      }}
      id={layer.id}
      name="layer"
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      visible={layer.visible}
      globalCompositeOperation={layer.blendMode}
      draggable={!layer.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
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
    >
      {shape}
    </Group>
  )
}
