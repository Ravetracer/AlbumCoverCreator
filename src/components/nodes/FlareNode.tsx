import { Shape } from 'react-konva'
import type Konva from 'konva'
import type { CanvasDoc, FlareLayer } from '../../types'
import { useEditor } from '../../state/store'
import { drawFlare } from '../../effects/flare'

interface Props {
  layer: FlareLayer
  doc: CanvasDoc
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
}

export function FlareNode({ layer, doc, onSelect, registerRef }: Props) {
  const updateLayer = useEditor((s) => s.updateLayer)
  const minDim = Math.min(doc.width, doc.height)

  return (
    <Shape
      ref={(n) => registerRef(layer.id, n)}
      id={layer.id}
      name="layer"
      x={layer.x}
      y={layer.y}
      opacity={layer.opacity}
      visible={layer.visible}
      globalCompositeOperation={layer.blendMode}
      draggable={!layer.locked}
      sceneFunc={(context) => {
        const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context
        drawFlare(ctx, layer, doc.width, doc.height)
      }}
      hitFunc={(context, shape) => {
        // Clickable area limited to the source burst so lower layers stay reachable.
        const r = minDim * 0.15 * layer.size
        context.beginPath()
        context.arc(0, 0, r, 0, Math.PI * 2)
        context.closePath()
        context.fillStrokeShape(shape)
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
    />
  )
}
