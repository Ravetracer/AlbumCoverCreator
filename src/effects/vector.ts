import type { ShapeLayer } from '../types'

// Linear-gradient start/end points across a w×h box at the given angle.
// `centered` returns coordinates around (0,0) for center-origin Konva shapes
// (ellipse, polygon, star); otherwise around the box center (w/2, h/2) for
// top-left shapes (rect, line).
export function gradientPoints(angle: number, w: number, h: number, centered: boolean) {
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const half = (Math.abs(dx) * w) / 2 + (Math.abs(dy) * h) / 2
  const ox = centered ? 0 : w / 2
  const oy = centered ? 0 : h / 2
  return {
    start: { x: ox - dx * half, y: oy - dy * half },
    end: { x: ox + dx * half, y: oy + dy * half },
  }
}

// Build the Konva fill props for a shape's fill mode. `centered` matches the
// shape's local origin (see gradientPoints).
export function fillProps(layer: ShapeLayer, w: number, h: number, centered: boolean) {
  if (layer.fillMode === 'none') return { fillEnabled: false as const }
  if (layer.fillMode === 'solid') return { fill: layer.fill }

  const stops = [0, layer.gradFrom, 1, layer.gradTo]
  if (layer.fillMode === 'linear') {
    const { start, end } = gradientPoints(layer.gradAngle, w, h, centered)
    return {
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: stops,
    }
  }
  // radial
  const c = centered ? { x: 0, y: 0 } : { x: w / 2, y: h / 2 }
  return {
    fillRadialGradientStartPoint: c,
    fillRadialGradientEndPoint: c,
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.hypot(w, h) / 2,
    fillRadialGradientColorStops: stops,
  }
}

export function glowProps(layer: ShapeLayer) {
  if (!layer.glowEnabled) return { shadowEnabled: false as const }
  return {
    shadowEnabled: true as const,
    shadowColor: layer.glowColor,
    shadowBlur: layer.glowBlur,
    shadowOpacity: 1,
    shadowForStrokeEnabled: true,
  }
}

export function strokeProps(layer: ShapeLayer) {
  if (!layer.strokeEnabled) return { strokeEnabled: false as const }
  return { stroke: layer.stroke, strokeWidth: layer.strokeWidth, strokeEnabled: true as const }
}
