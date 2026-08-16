import type Konva from 'konva'

// Editing caches are capped for responsiveness; effects are resolution
// independent (params scale with width) so the smaller preview matches export.
const EDIT_MAX_EDGE = 2000

// pixelRatio so the cached canvas' long edge is at most EDIT_MAX_EDGE, never
// upsampling beyond the node's own size.
export function editPixelRatio(node: Konva.Node): number {
  const r = node.getClientRect({ skipTransform: true, skipShadow: true, skipStroke: false })
  const longEdge = Math.max(r.width, r.height, node.width(), node.height())
  if (longEdge <= 0) return 1
  return Math.min(1, EDIT_MAX_EDGE / longEdge)
}

// Extra cache padding so blur/shadow spread isn't clipped at the cache edge.
export function nodeCacheOffset(node: Konva.Node): number {
  const anyNode = node as unknown as {
    blurRadius?: () => number
    shadowEnabled?: () => boolean
    shadowBlur?: () => number
    fontSize?: () => number
    getAttr?: (name: string) => number | undefined
  }
  const blur = typeof anyNode.blurRadius === 'function' ? anyNode.blurRadius() || 0 : 0
  const shadow =
    typeof anyNode.shadowEnabled === 'function' && anyNode.shadowEnabled()
      ? anyNode.shadowBlur?.() || 0
      : 0
  const chroma = typeof anyNode.getAttr === 'function' ? anyNode.getAttr('chromaPx') || 0 : 0
  // Text nodes: some fonts (e.g. Anton) draw glyphs taller than the metric box
  // Konva uses to size the cache, clipping ascenders. Pad by a fraction of the
  // font size so cached/exported text keeps its full glyphs.
  const textPad = typeof anyNode.fontSize === 'function' ? (anyNode.fontSize() || 0) * 0.3 : 0
  return Math.ceil(blur + shadow + chroma + textPad)
}

// Cache a node for editing (fast, capped resolution) with padding for spread.
export function cacheForEditing(node: Konva.Node) {
  const pixelRatio = editPixelRatio(node)
  const offset = nodeCacheOffset(node)
  node.cache(offset > 0 ? { pixelRatio, offset } : { pixelRatio })
}

// Cache a node at full resolution for export.
export function cacheFull(node: Konva.Node) {
  const offset = nodeCacheOffset(node)
  node.cache(offset > 0 ? { pixelRatio: 1, offset } : { pixelRatio: 1 })
}
