import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer as KonvaLayer, Line, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../state/store'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { ShapeNode } from './nodes/ShapeNode'
import { FlareNode } from './nodes/FlareNode'
import { ParticleNode } from './nodes/ParticleNode'
import { MaskEditNode, MaskShape, SelfMaskGroup } from './nodes/MaskNode'
import { AdjustGroup } from './nodes/AdjustNode'

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
  const maskEditId = useEditor((s) => s.maskEditId)
  const select = useEditor((s) => s.select)
  const addImageLayer = useEditor((s) => s.addImageLayer)

  const wrapRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map())
  const guideLayerRef = useRef<Konva.Layer>(null)
  const vGuideRef = useRef<Konva.Line>(null)
  const hGuideRef = useRef<Konva.Line>(null)
  const [display, setDisplay] = useState({ scale: 1, w: 0, h: 0 })
  const [dragOver, setDragOver] = useState(false)

  // Snap a dragging node to the canvas edges/centre and draw guide lines. Done
  // imperatively (no React state) so re-renders don't fight Konva mid-drag.
  const onStageDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    if (!node || node === node.getStage()) return
    const layerNode = node.getLayer()
    if (!layerNode) return
    const box = node.getClientRect({ relativeTo: layerNode })
    const thr = 6 / (display.scale || 1)
    const W = doc.width
    const H = doc.height
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    const xTargets = [
      { pos: 0, delta: -box.x },
      { pos: W / 2, delta: W / 2 - cx },
      { pos: W, delta: W - (box.x + box.width) },
    ]
    const yTargets = [
      { pos: 0, delta: -box.y },
      { pos: H / 2, delta: H / 2 - cy },
      { pos: H, delta: H - (box.y + box.height) },
    ]
    const snapX = xTargets.find((t) => Math.abs(t.delta) <= thr)
    const snapY = yTargets.find((t) => Math.abs(t.delta) <= thr)
    if (snapX) node.x(node.x() + snapX.delta)
    if (snapY) node.y(node.y() + snapY.delta)

    const v = vGuideRef.current
    const h = hGuideRef.current
    if (v) { if (snapX) { v.points([snapX.pos, 0, snapX.pos, H]); v.visible(true) } else v.visible(false) }
    if (h) { if (snapY) { h.points([0, snapY.pos, W, snapY.pos]); h.visible(true) } else h.visible(false) }
    guideLayerRef.current?.batchDraw()
  }

  const clearGuides = () => {
    vGuideRef.current?.visible(false)
    hGuideRef.current?.visible(false)
    guideLayerRef.current?.batchDraw()
  }

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
    // Editing an image mask: attach the transformer to the mask overlay and
    // allow free (non-ratio) resizing.
    const editingMask =
      !!maskEditId && selected?.id === maskEditId && selected.mask?.type === 'image' && selected.mask.enabled
    if (editingMask) {
      const node = nodeRefs.current.get(`${maskEditId}__mask`)
      tr.keepRatio(false)
      tr.nodes(node ? [node] : [])
      tr.getLayer()?.batchDraw()
      return
    }
    const transformable =
      selected && !selected.locked && selected.type !== 'flare' && selected.type !== 'particle' && selected.type !== 'adjust'
    const node = transformable && selectedId ? nodeRefs.current.get(selectedId) : null
    tr.keepRatio(true)
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, maskEditId, layers])

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

  // A single layer's on-canvas node, wrapped for its mask if it has one.
  const renderNode = (layer: (typeof ordered)[number]): React.ReactNode => {
    const common = { onSelect: () => select(layer.id), registerRef }
    let node: React.ReactNode = null
    switch (layer.type) {
      case 'image':
        node = <ImageNode {...common} layer={layer} />
        break
      case 'text':
        node = <TextNode {...common} layer={layer} />
        break
      case 'shape':
        node = <ShapeNode {...common} layer={layer} />
        break
      case 'flare':
        node = <FlareNode {...common} layer={layer} doc={doc} />
        break
      case 'particle':
        node = <ParticleNode {...common} layer={layer} doc={doc} />
        break
      default:
        return null
    }

    const mask = layer.mask
    if (mask?.enabled && mask.type === 'image' && maskEditId === layer.id) {
      return (
        <Fragment key={layer.id}>
          {node}
          <MaskEditNode layer={layer} doc={doc} registerRef={registerRef} />
        </Fragment>
      )
    }
    if (mask?.enabled && mask.target === 'self') {
      return (
        <SelfMaskGroup key={layer.id} layer={layer} doc={doc}>
          {node}
        </SelfMaskGroup>
      )
    }
    if (mask?.enabled && mask.target === 'below') {
      return (
        <Fragment key={layer.id}>
          {node}
          <MaskShape mask={mask} box={{ width: doc.width, height: doc.height }} />
        </Fragment>
      )
    }
    return <Fragment key={layer.id}>{node}</Fragment>
  }

  // Build the stack. An adjustment layer collapses everything accumulated below
  // it into a filtered group, so its grade applies to all lower layers.
  const renderStack = (() => {
    let buffer: React.ReactNode[] = []
    for (const layer of ordered) {
      if (layer.type === 'adjust') {
        const below = buffer
        buffer = [
          <AdjustGroup
            key={layer.id}
            layer={layer}
            onSelect={() => select(layer.id)}
            registerRef={registerRef}
          >
            {below}
          </AdjustGroup>,
        ]
      } else {
        buffer.push(renderNode(layer))
      }
    }
    return buffer
  })()

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
          onDragMove={onStageDragMove}
          onDragEnd={clearGuides}
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
            {renderStack}
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
          {/* Snap guide lines, drawn imperatively during drag. */}
          <KonvaLayer ref={guideLayerRef} listening={false}>
            <Line ref={vGuideRef} stroke="#ff3b81" strokeWidth={1} strokeScaleEnabled={false} dash={[6, 6]} visible={false} />
            <Line ref={hGuideRef} stroke="#ff3b81" strokeWidth={1} strokeScaleEnabled={false} dash={[6, 6]} visible={false} />
          </KonvaLayer>
        </Stage>
      </div>
    </div>
  )
}
