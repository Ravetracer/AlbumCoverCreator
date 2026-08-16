import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer as KonvaLayer, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../state/store'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { ShapeNode } from './nodes/ShapeNode'
import { FlareNode } from './nodes/FlareNode'
import { ParticleNode } from './nodes/ParticleNode'

// Stage that always keeps the full document visible, scaled to fit the
// available viewport area. The Konva stage is the real document size; we scale
// it down for display and export at full/oversampled resolution separately.
export function CanvasStage({
  stageRef,
}: {
  stageRef: React.RefObject<Konva.Stage | null>
}) {
  const doc = useEditor((s) => s.doc)
  const layers = useEditor((s) => s.layers)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const addImageLayer = useEditor((s) => s.addImageLayer)

  const wrapRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map())
  const [display, setDisplay] = useState({ scale: 1, w: 0, h: 0 })
  const [dragOver, setDragOver] = useState(false)

  const registerRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node)
    else nodeRefs.current.delete(id)
  }, [])

  // Fit the document into the wrapper, leaving a small margin.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const pad = 48
      const availW = el.clientWidth - pad
      const availH = el.clientHeight - pad
      const scale = Math.min(availW / doc.width, availH / doc.height, 1)
      setDisplay({ scale, w: doc.width * scale, h: doc.height * scale })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc.width, doc.height])

  // Attach the transformer to the selected node — only for shapes/images/text
  // (flares and particles are drag-only).
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const selected = layers.find((l) => l.id === selectedId)
    const transformable =
      selected && !selected.locked && selected.type !== 'flare' && selected.type !== 'particle'
    const node = transformable && selectedId ? nodeRefs.current.get(selectedId) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, layers])

  // Hold Ctrl while rotating to snap the transformer to 45° increments.
  useEffect(() => {
    const SNAPS = [0, 45, 90, 135, 180, 225, 270, 315]
    const apply = (on: boolean) => {
      const tr = trRef.current
      if (!tr) return
      tr.rotationSnaps(on ? SNAPS : [])
      tr.rotationSnapTolerance(on ? 30 : 0)
    }
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') apply(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'Control') apply(false) }
    const blur = () => apply(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Drag an image file straight onto the canvas (no file dialog).
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () =>
      addImageLayer({
        src: url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        name: file.name.replace(/\.[^.]+$/, ''),
      })
    img.src = url
  }

  const ordered = useMemo(() => layers, [layers])

  return (
    <div
      className={`canvas-wrap${dragOver ? ' drag-over' : ''}`}
      ref={wrapRef}
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={onDrop}
    >
      <div
        className="canvas-shadow"
        style={{ width: display.w, height: display.h }}
      >
        <Stage
          ref={stageRef}
          // Size the stage to the on-screen display size (not the document
          // size) so the underlying <canvas> doesn't overflow across the page
          // and swallow clicks meant for the side panels. Content is scaled to
          // fit via scaleX/scaleY.
          width={display.w}
          height={display.h}
          scaleX={display.scale}
          scaleY={display.scale}
          onMouseDown={(e) => {
            // Click on empty stage / background deselects.
            if (e.target === e.target.getStage() || e.target.name() === 'bg') {
              select(null)
            }
          }}
        >
          <KonvaLayer>
            <Rect
              name="bg"
              x={0}
              y={0}
              width={doc.width}
              height={doc.height}
              fill={doc.background}
            />
            {ordered.map((layer) => {
              const common = {
                onSelect: () => select(layer.id),
                registerRef,
              }
              switch (layer.type) {
                case 'image':
                  return <ImageNode key={layer.id} {...common} layer={layer} />
                case 'text':
                  return <TextNode key={layer.id} {...common} layer={layer} />
                case 'shape':
                  return <ShapeNode key={layer.id} {...common} layer={layer} />
                case 'flare':
                  return <FlareNode key={layer.id} {...common} layer={layer} doc={doc} />
                case 'particle':
                  return <ParticleNode key={layer.id} {...common} layer={layer} doc={doc} />
                default:
                  return null
              }
            })}
            <Transformer
              ref={trRef}
              rotateEnabled
              keepRatio
              flipEnabled={false}
              anchorSize={12}
              borderStroke="#4f8cff"
              anchorStroke="#4f8cff"
              anchorFill="#fff"
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
              }
            />
          </KonvaLayer>
        </Stage>
      </div>
    </div>
  )
}
