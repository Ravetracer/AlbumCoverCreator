import type { Filter } from 'konva/lib/Node'
import type { CanvasDoc, Layer, LayerMask } from '../types'

// The area a mask is expressed against: the layer's local box for a "self" mask
// (so it moves with the item) or the whole canvas for a "below" mask.
export interface MaskBox {
  width: number
  height: number
}

// The local (unscaled) content box of a layer, used as the reference frame for a
// self mask so the mask stays glued to the item under move/scale/rotate.
export function layerLocalBox(layer: Layer, doc: CanvasDoc): MaskBox {
  if (layer.type === 'image') {
    return {
      width: (1 - (layer.cropLeft ?? 0) - (layer.cropRight ?? 0)) * layer.naturalWidth,
      height: (1 - (layer.cropTop ?? 0) - (layer.cropBottom ?? 0)) * layer.naturalHeight,
    }
  }
  if (layer.type === 'shape') return { width: layer.width, height: layer.height }
  if (layer.type === 'text') {
    const lines = layer.text.split('\n').length
    return {
      width: layer.width ?? Math.max(40, layer.text.length * layer.fontSize * 0.55),
      height: layer.fontSize * layer.lineHeight * lines,
    }
  }
  // Flares / particles / adjustment layers have no meaningful box.
  return { width: doc.width, height: doc.height }
}

// Effective transform for an image mask. When no size is stored the mask fills
// its reference box.
export function maskTransform(mask: LayerMask, box: MaskBox) {
  const width = mask.width && mask.width > 0 ? mask.width : box.width
  const height = mask.height && mask.height > 0 ? mask.height : box.height
  return {
    x: mask.x ?? 0,
    y: mask.y ?? 0,
    width,
    height,
    rotation: mask.rotation ?? 0,
    scaleX: mask.scaleX ?? 1,
    scaleY: mask.scaleY ?? 1,
  }
}

// A fresh mask with sensible defaults: a soft linear fade over the middle band.
export function defaultMask(): LayerMask {
  return {
    enabled: true,
    type: 'linear',
    target: 'self',
    invert: false,
    angle: 90,
    start: 0.25,
    end: 0.75,
    cx: 0.5,
    cy: 0.5,
    radius: 0.5,
  }
}

// Konva filter: map an image's luminance to alpha so a grayscale picture works
// as a mask (white = keep, black = hide). RGB is forced to white; the alpha
// channel carries the mask value and is combined with any existing alpha.
export function makeLuminanceToAlpha(invert: boolean): Filter {
  return function (imageData: ImageData) {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
      const a = invert ? 1 - lum : lum
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = Math.round(d[i + 3] * a)
    }
  } as Filter
}

const KEEP = 'rgba(255,255,255,1)'
const HIDE = 'rgba(255,255,255,0)'

// Gradient colour stops for a linear mask. Positions must strictly increase, so
// clamp and separate start/end slightly.
export function linearMaskStops(mask: LayerMask): (number | string)[] {
  const c0 = mask.invert ? HIDE : KEEP
  const c1 = mask.invert ? KEEP : HIDE
  let s = Math.max(0, Math.min(1, mask.start))
  let e = Math.max(0, Math.min(1, mask.end))
  if (e <= s) e = Math.min(1, s + 0.001)
  return [0, c0, s, c0, e, c1, 1, c1]
}

// Gradient colour stops for a radial mask; `start` is the fully-kept inner
// fraction before the fade to the outer radius begins.
export function radialMaskStops(mask: LayerMask): (number | string)[] {
  const c0 = mask.invert ? HIDE : KEEP
  const c1 = mask.invert ? KEEP : HIDE
  const inner = Math.max(0, Math.min(0.999, mask.start))
  return [0, c0, inner, c0, 1, c1]
}

// Direction endpoints for a linear gradient spanning the reference box.
export function linearMaskPoints(mask: LayerMask, box: MaskBox) {
  const rad = (mask.angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const ext = (Math.abs(dx) * box.width + Math.abs(dy) * box.height) / 2
  const cx = box.width / 2
  const cy = box.height / 2
  return {
    start: { x: cx - dx * ext, y: cy - dy * ext },
    end: { x: cx + dx * ext, y: cy + dy * ext },
  }
}
