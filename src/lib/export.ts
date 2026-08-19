import Konva from 'konva'
import type { CanvasDoc } from '../types'
import { cacheForEditing, cacheFull } from './cache'

export type ExportFormat = 'png' | 'jpeg'

// Render the stage at the document's native resolution (or an oversampled
// multiple) regardless of the on-screen display scale, then trigger a download.
export function exportStage(
  stage: Konva.Stage,
  doc: CanvasDoc,
  opts: { format: ExportFormat; targetLongEdge?: number; quality?: number },
) {
  const { format, targetLongEdge, quality = 0.92 } = opts

  // Hide selection transformers so their handles don't get baked in.
  const transformers = stage.find('Transformer') as Konva.Node[]
  const hidden = transformers.filter((t) => t.visible())
  hidden.forEach((t) => t.visible(false))

  // Editing caches filtered layers at a capped resolution for responsiveness.
  // Re-cache each at full natural resolution so the export is sharp; effects
  // are resolution independent, so the look is unchanged. Covers image layers
  // and blurred shape groups.
  // All nodes that hold a cache: filtered nodes (image/adjust/text) plus the
  // self-mask groups (cached for compositing, no filters). Adjustment and mask
  // groups wrap already-cached children, so cache deepest-first — otherwise a
  // parent group would snapshot stale (edit-resolution) child content.
  const filtered = (stage.find('Image, Group, Text, TextPath') as Konva.Node[]).filter(
    (n) => n.filters()?.length,
  )
  const maskGroups = stage.find('.mask-group') as Konva.Node[]
  const depth = (n: Konva.Node) => {
    let d = 0
    let p = n.getParent()
    while (p) { d++; p = p.getParent() }
    return d
  }
  const cachedNodes = [...new Set([...filtered, ...maskGroups])].sort((a, b) => depth(b) - depth(a))
  for (const node of cachedNodes) cacheFull(node)

  // The stage is displayed at some scale; toDataURL's pixelRatio is relative to
  // the stage's current (scaled) size, so compensate to hit the real pixels.
  const displayScale = stage.scaleX() || 1
  const longEdge = Math.max(doc.width, doc.height)
  const target = targetLongEdge ?? longEdge
  const pixelRatio = (target / longEdge) / displayScale

  const dataURL = stage.toDataURL({
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    quality,
    pixelRatio,
    // Capture the full document rect in stage (display) coordinates.
    x: 0,
    y: 0,
    width: doc.width * displayScale,
    height: doc.height * displayScale,
  })

  // Restore the responsive editing caches and the transformer.
  for (const node of cachedNodes) cacheForEditing(node)
  hidden.forEach((t) => t.visible(true))
  stage.batchDraw()

  const a = document.createElement('a')
  a.href = dataURL
  a.download = `album-cover.${format === 'png' ? 'png' : 'jpg'}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
