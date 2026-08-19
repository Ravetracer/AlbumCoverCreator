import Konva from 'konva'
import type { Filter } from 'konva/lib/Node'
import type { Effect, ImageAdjustments } from '../types'
import { buildFilter } from './registry'
import { makeTone, makeDetail } from './filters'

// The full filter chain for a pixel-filtered node: basic adjustments (Konva
// built-ins) first, then the creative effect stack in order. Shared by image
// layers and adjustment layers (which grade everything below them).
export function buildFilterChain(a: ImageAdjustments, effects: Effect[]): Filter[] {
  const f: Filter[] = [
    Konva.Filters.Brighten,
    Konva.Filters.Contrast,
    Konva.Filters.HSV,
  ]
  const tone = makeTone(a)
  if (tone) f.push(tone as Filter)
  const detail = makeDetail(a)
  if (detail) f.push(detail as Filter)
  if (a.blur > 0) f.push(Konva.Filters.Blur)
  if (a.grayscale >= 0.5) f.push(Konva.Filters.Grayscale)
  if (a.sepia >= 0.5) f.push(Konva.Filters.Sepia)
  for (const effect of effects) {
    if (!effect.enabled) continue
    const filter = buildFilter(effect)
    if (filter) f.push(filter as Filter)
  }
  return f
}
