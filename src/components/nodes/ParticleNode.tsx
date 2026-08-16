import { Shape } from 'react-konva'
import type Konva from 'konva'
import type { CanvasDoc, ParticleLayer } from '../../types'
import { useEditor } from '../../state/store'
import { drawParticles, generateParticles } from '../../effects/particles'

interface Props {
  layer: ParticleLayer
  doc: CanvasDoc
  onSelect: () => void
  registerRef: (id: string, node: Konva.Node | null) => void
}

export function ParticleNode({ layer, doc, onSelect, registerRef }: Props) {
  const updateLayer = useEditor((s) => s.updateLayer)

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
        drawParticles(ctx, layer, doc.width, doc.height)
      }}
      hitFunc={(context, shape) => {
        // Hit only on the particles themselves so gaps click through.
        const parts = generateParticles(layer, doc.width, doc.height)
        context.beginPath()
        for (const p of parts) {
          const r = Math.max(p.s, layer.size * layer.glowSize * 0.5)
          context.moveTo(p.x + r, p.y)
          context.arc(p.x, p.y, r, 0, Math.PI * 2)
        }
        context.closePath()
        context.fillStrokeShape(shape)
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
    />
  )
}
