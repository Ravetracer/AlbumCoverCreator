// Custom Konva filters for Phase 2 effects. Each factory returns a function that
// mutates an ImageData in place (the signature Konva expects for filters).
//
// Resolution independence: any size expressed in "units" is scaled by the image
// width relative to REF_WIDTH, so the same params look identical whether the
// node is cached at editing resolution or full-resolution for export.
import { PALETTES, type RGB } from './palettes'
import type { ImageAdjustments } from '../types'

export type PixelFilter = (imageData: ImageData) => void
type Params = Record<string, number | string | boolean>

const REF_WIDTH = 1000

function num(p: Params, k: string, d: number): number {
  const v = p[k]
  return typeof v === 'number' ? v : d
}
function str(p: Params, k: string, d: string): string {
  const v = p[k]
  return typeof v === 'string' ? v : d
}

// Parse #rgb, #rrggbb or #rrggbbaa (alpha ignored) into an RGB triple.
function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k]
  return typeof v === 'boolean' ? v : d
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Scale a "unit" size to actual pixels for the current image width.
function unitToPx(units: number, width: number): number {
  return Math.max(1, Math.round((units * width) / REF_WIDTH))
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// ---- brightness / contrast (used as pre-adjust inside retro) ---------------
function applyBrightnessContrast(
  data: Uint8ClampedArray,
  bright: number, // -100..100
  contrast: number, // -100..100
) {
  if (bright === 0 && contrast === 0) return
  const b = bright * 2.55
  const cc = contrast * 2.55
  const f = (259 * (cc + 255)) / (255 * (259 - cc))
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp8(f * (data[i] - 128) + 128 + b)
    data[i + 1] = clamp8(f * (data[i + 1] - 128) + 128 + b)
    data[i + 2] = clamp8(f * (data[i + 2] - 128) + 128 + b)
  }
}

// ---- averaging into a coarse cell grid -------------------------------------
// `buf` holds the alpha-weighted average colour per cell (so transparent pixels,
// which are usually rgba(0,0,0,0), don't drag the colour toward black), and
// `alpha` holds the mean alpha (0..255) per cell so drawing effects can keep
// transparent regions transparent instead of painting them black.
function averageCells(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  cell: number,
): { cols: number; rows: number; buf: Float32Array; alpha: Float32Array } {
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const buf = new Float32Array(cols * rows * 3)
  const alpha = new Float32Array(cols * rows)
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let r = 0, g = 0, b = 0, aSum = 0, n = 0
      const x1 = Math.min((cx + 1) * cell, W)
      const y1 = Math.min((cy + 1) * cell, H)
      for (let y = cy * cell; y < y1; y++) {
        for (let x = cx * cell; x < x1; x++) {
          const i = (y * W + x) * 4
          const a = data[i + 3]
          r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a
          aSum += a; n++
        }
      }
      const k = (cy * cols + cx) * 3
      if (aSum > 0) {
        buf[k] = r / aSum; buf[k + 1] = g / aSum; buf[k + 2] = b / aSum
      } else {
        buf[k] = 0; buf[k + 1] = 0; buf[k + 2] = 0
      }
      alpha[cy * cols + cx] = n > 0 ? aSum / n : 0
    }
  }
  return { cols, rows, buf, alpha }
}

// =====================  PIXELATE  ===========================================
export function makePixelate(p: Params): PixelFilter {
  const units = num(p, 'size', 8)
  const shape = str(p, 'shape', 'square')
  const gap = num(p, 'gap', 0) // 0..0.9
  const bg = hexToRgb(str(p, 'background', '#000000'))
  const transparent = bool(p, 'transparent', true)

  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const cell = unitToPx(units, W)
    const { cols, rows, buf, alpha } = averageCells(data, W, H, cell)

    if (shape === 'square' && gap === 0) {
      // Fast path: flat mosaic. Each block takes the cell's average alpha so a
      // transparent PNG stays transparent (transparent mode) or fills with the
      // background colour where it was transparent (opaque mode).
      for (let y = 0; y < H; y++) {
        const cy = Math.min(rows - 1, (y / cell) | 0)
        for (let x = 0; x < W; x++) {
          const cx = Math.min(cols - 1, (x / cell) | 0)
          const ci = cy * cols + cx
          const k = ci * 3
          const i = (y * W + x) * 4
          const ca = alpha[ci]
          if (transparent) {
            data[i] = buf[k]; data[i + 1] = buf[k + 1]; data[i + 2] = buf[k + 2]
            data[i + 3] = ca
          } else if (ca < 5) {
            data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255
          } else {
            data[i] = buf[k]; data[i + 1] = buf[k + 1]; data[i + 2] = buf[k + 2]; data[i + 3] = 255
          }
        }
      }
      return
    }

    // Shape path: draw cells onto an offscreen canvas.
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    if (!transparent) {
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`
      ctx.fillRect(0, 0, W, H)
    }
    const radius = (cell * (1 - gap)) / 2
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const ci = cy * cols + cx
        // Skip cells that were transparent in the source (transparent mode) so
        // they don't become solid coloured tiles.
        const ca = transparent ? alpha[ci] / 255 : 1
        if (ca < 0.02) continue
        const k = ci * 3
        ctx.globalAlpha = ca
        ctx.fillStyle = `rgb(${buf[k] | 0},${buf[k + 1] | 0},${buf[k + 2] | 0})`
        const midX = cx * cell + cell / 2
        const midY = cy * cell + cell / 2
        drawCellShape(ctx, shape, midX, midY, radius)
      }
    }
    ctx.globalAlpha = 1
    const out = ctx.getImageData(0, 0, W, H).data
    data.set(out)
  }
}

function drawCellShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  cx: number,
  cy: number,
  r: number,
) {
  switch (shape) {
    case 'dots':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy)
      ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy)
      ctx.closePath(); ctx.fill()
      break
    case 'cross': {
      const t = r * 0.5
      ctx.fillRect(cx - r, cy - t / 2, r * 2, t)
      ctx.fillRect(cx - t / 2, cy - r, t, r * 2)
      break
    }
    default: // square (with gap)
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
}

// =====================  RETRO (palette + dithering)  ========================
const BAYER: Record<string, { n: number; m: number[] }> = {
  bayer2: { n: 2, m: [0, 2, 3, 1] },
  bayer4: {
    n: 4,
    m: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
  },
  bayer8: {
    n: 8,
    m: [
      0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
    ],
  },
}

const ORDERED_STRENGTH = 64

function nearest(pal: RGB[], r: number, g: number, b: number): RGB {
  let best = pal[0]
  let bestD = Infinity
  for (const c of pal) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2]
    const d = dr * dr + dg * dg + db * db
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

// Diffusion kernels: [dx, dy, weight]
const FLOYD: [number, number, number][] = [
  [1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16],
]
const ATKINSON: [number, number, number][] = [
  [1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8],
  [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8],
]

// Dither + quantize a coarse buffer in place to the given palette.
function ditherQuantize(
  buf: Float32Array,
  cols: number,
  rows: number,
  pal: RGB[],
  mode: string,
) {
  if (mode.startsWith('bayer')) {
    const { n, m } = BAYER[mode]
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = ((m[(y % n) * n + (x % n)] + 0.5) / (n * n) - 0.5) * ORDERED_STRENGTH
        const k = (y * cols + x) * 3
        const c = nearest(pal, buf[k] + t, buf[k + 1] + t, buf[k + 2] + t)
        buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]
      }
    }
    return
  }
  if (mode === 'floyd' || mode === 'atkinson') {
    const K = mode === 'floyd' ? FLOYD : ATKINSON
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const k = (y * cols + x) * 3
        const or = buf[k], og = buf[k + 1], ob = buf[k + 2]
        const c = nearest(pal, or, og, ob)
        buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]
        const er = or - c[0], eg = og - c[1], eb = ob - c[2]
        for (const [dx, dy, w] of K) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= cols || ny >= rows) continue
          const nk = (ny * cols + nx) * 3
          buf[nk] += er * w; buf[nk + 1] += eg * w; buf[nk + 2] += eb * w
        }
      }
    }
    return
  }
  // none
  for (let i = 0; i < buf.length; i += 3) {
    const c = nearest(pal, buf[i], buf[i + 1], buf[i + 2])
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]
  }
}

const RETRO_WORK_MAX = 1600 // cap the dithering grid width for memory/speed

export function makeRetro(p: Params): PixelFilter {
  const paletteKey = str(p, 'palette', 'c64')
  const dither = str(p, 'dither', 'bayer4')
  const pixel = num(p, 'pixel', 1)
  const bright = num(p, 'brightness', 0)
  const contrast = num(p, 'contrast', 0)

  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const pal = PALETTES[paletteKey] ?? PALETTES.c64
    applyBrightnessContrast(data, bright, contrast)

    // Cell size from the "pixel" param, but never finer than RETRO_WORK_MAX
    // columns to bound the working buffer.
    let cell = unitToPx(pixel, W)
    cell = Math.max(cell, Math.ceil(W / RETRO_WORK_MAX))

    const { cols, rows, buf } = averageCells(data, W, H, cell)
    ditherQuantize(buf, cols, rows, pal, dither)

    // Upscale (nearest) back to full resolution, preserving alpha.
    for (let y = 0; y < H; y++) {
      const cy = Math.min(rows - 1, (y / cell) | 0)
      for (let x = 0; x < W; x++) {
        const cx = Math.min(cols - 1, (x / cell) | 0)
        const k = (cy * cols + cx) * 3
        const i = (y * W + x) * 4
        data[i] = buf[k]; data[i + 1] = buf[k + 1]; data[i + 2] = buf[k + 2]
      }
    }
  }
}

// =====================  ASCII  =============================================
const RAMPS: Record<string, string> = {
  standard: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  minimal: ' .oO@',
}

export function makeAscii(p: Params): PixelFilter {
  const unit = num(p, 'cell', 8)
  const colorMode = str(p, 'color', 'mono')
  const ink = str(p, 'ink', '#00ff66')
  const bg = str(p, 'background', '#000000')
  const transparent = bool(p, 'transparent', true)
  const ramp = RAMPS[str(p, 'ramp', 'standard')] ?? RAMPS.standard

  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const cell = unitToPx(unit, W)
    const { cols, rows, buf, alpha } = averageCells(data, W, H, cell)

    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    if (!transparent) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
    }
    ctx.font = `${cell}px monospace`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx
        // Keep transparent source regions transparent.
        const ca = transparent ? alpha[idx] / 255 : 1
        if (ca < 0.02) continue
        const k = idx * 3
        const l = luma(buf[k], buf[k + 1], buf[k + 2]) / 255
        const ch = ramp[Math.min(ramp.length - 1, (l * (ramp.length - 1)) | 0)]
        if (ch === ' ') continue
        ctx.globalAlpha = ca
        ctx.fillStyle =
          colorMode === 'source'
            ? `rgb(${buf[k] | 0},${buf[k + 1] | 0},${buf[k + 2] | 0})`
            : ink
        ctx.fillText(ch, cx * cell + cell / 2, cy * cell)
      }
    }
    ctx.globalAlpha = 1
    data.set(ctx.getImageData(0, 0, W, H).data)
  }
}

// =====================  DUOTONE  ===========================================
export function makeDuotone(p: Params): PixelFilter {
  const shadow = hexToRgb(str(p, 'shadow', '#1a1a2e'))
  const highlight = hexToRgb(str(p, 'highlight', '#f5d442'))
  return (imageData) => {
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      const t = luma(data[i], data[i + 1], data[i + 2]) / 255
      data[i] = shadow[0] + (highlight[0] - shadow[0]) * t
      data[i + 1] = shadow[1] + (highlight[1] - shadow[1]) * t
      data[i + 2] = shadow[2] + (highlight[2] - shadow[2]) * t
    }
  }
}

// =====================  POSTERIZE  =========================================
export function makePosterize(p: Params): PixelFilter {
  const levels = Math.max(2, Math.round(num(p, 'levels', 5)))
  return (imageData) => {
    const { data } = imageData
    const step = 255 / (levels - 1)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(data[i] / step) * step
      data[i + 1] = Math.round(data[i + 1] / step) * step
      data[i + 2] = Math.round(data[i + 2] / step) * step
    }
  }
}

// =====================  THRESHOLD  =========================================
export function makeThreshold(p: Params): PixelFilter {
  const level = num(p, 'level', 128)
  return (imageData) => {
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      const v = luma(data[i], data[i + 1], data[i + 2]) >= level ? 255 : 0
      data[i] = v; data[i + 1] = v; data[i + 2] = v
    }
  }
}

// =====================  INVERT  ============================================
export function makeInvert(): PixelFilter {
  return (imageData) => {
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
    }
  }
}

// =====================  TONE (highlights/shadows/whites/blacks/vibrance/dehaze)
export function makeTone(adj: ImageAdjustments): PixelFilter | null {
  const hl = adj.highlights / 100
  const sh = adj.shadows / 100
  const wh = adj.whites / 100
  const bk = adj.blacks / 100
  const vib = adj.vibrance / 100
  const dh = adj.dehaze / 100
  if (!hl && !sh && !wh && !bk && !vib && !dh) return null
  const tone = (v: number): number => {
    v += sh * (1 - v) * (1 - v) * 0.6
    v += hl * v * v * 0.6
    if (v < 0.5) v += bk * (1 - v) * 0.4
    else v += wh * v * 0.4
    return v
  }
  return (imageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      let r = tone(d[i] / 255)
      let g = tone(d[i + 1] / 255)
      let b = tone(d[i + 2] / 255)
      if (dh) {
        r = (r - 0.5) * (1 + dh * 0.6) + 0.5
        g = (g - 0.5) * (1 + dh * 0.6) + 0.5
        b = (b - 0.5) * (1 + dh * 0.6) + 0.5
      }
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const sat = mx <= 0 ? 0 : (mx - mn) / mx
      const boost = vib * (1 - sat) + dh * 0.4
      if (boost) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        r = l + (r - l) * (1 + boost)
        g = l + (g - l) * (1 + boost)
        b = l + (b - l) * (1 + boost)
      }
      d[i] = clamp8(r * 255)
      d[i + 1] = clamp8(g * 255)
      d[i + 2] = clamp8(b * 255)
    }
  }
}

// =====================  DETAIL (sharpness / structure / clarity)  ==========
// Unsharp masking at increasing radii. Radii scale with width for WYSIWYG.
export function makeDetail(adj: ImageAdjustments): PixelFilter | null {
  const sharp = adj.sharpness / 100
  const struct = adj.structure / 100
  const clar = adj.clarity / 100
  if (!sharp && !struct && !clar) return null

  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const n = W * H
    const unsharp = (radiusUnits: number, amount: number, midWeighted: boolean) => {
      const rad = Math.max(1, unitToPx(radiusUnits, W))
      for (let ch = 0; ch < 3; ch++) {
        const buf = new Float32Array(n)
        for (let q = 0; q < n; q++) buf[q] = data[q * 4 + ch]
        const blurred = buf.slice()
        boxBlur(blurred, W, H, rad)
        for (let q = 0; q < n; q++) {
          const orig = buf[q]
          let w = amount
          if (midWeighted) w *= 1 - Math.abs(orig / 255 - 0.5) * 2
          data[q * 4 + ch] = clamp8(orig + (orig - blurred[q]) * w)
        }
      }
    }
    if (sharp) unsharp(1, sharp * 1.5, false)
    if (struct) unsharp(4, struct * 1.2, false)
    if (clar) unsharp(12, clar, true)
  }
}

// =====================  DISTORT  ===========================================
export function makeDistort(p: Params): PixelFilter {
  const type = str(p, 'type', 'wave')
  const amount = num(p, 'amount', 20)
  const freq = num(p, 'frequency', 6)
  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const src = new Uint8ClampedArray(data)
    const amp = (amount / 100) * W * 0.08
    const cx = W / 2, cy = H / 2
    const maxD = Math.hypot(cx, cy)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sx = x, sy = y
        if (type === 'wave') {
          sx = x + amp * Math.sin((2 * Math.PI * freq * y) / H)
          sy = y + amp * Math.sin((2 * Math.PI * freq * x) / W)
        } else if (type === 'ripple') {
          const dx = x - cx, dy = y - cy
          const d = Math.hypot(dx, dy)
          const off = amp * Math.sin((d / W) * freq * Math.PI * 2)
          const a = Math.atan2(dy, dx)
          sx = x + Math.cos(a) * off
          sy = y + Math.sin(a) * off
        } else if (type === 'swirl') {
          const dx = x - cx, dy = y - cy
          const d = Math.hypot(dx, dy)
          const amt = 1 - d / maxD
          const ang = amt * amt * (amount / 100) * Math.PI * 2
          const ca = Math.cos(ang), sa = Math.sin(ang)
          sx = cx + dx * ca - dy * sa
          sy = cy + dx * sa + dy * ca
        }
        let ix = sx | 0, iy = sy | 0
        ix = ix < 0 ? 0 : ix >= W ? W - 1 : ix
        iy = iy < 0 ? 0 : iy >= H ? H - 1 : iy
        const si = (iy * W + ix) * 4
        const di = (y * W + x) * 4
        data[di] = src[si]; data[di + 1] = src[si + 1]
        data[di + 2] = src[si + 2]; data[di + 3] = src[si + 3]
      }
    }
  }
}

// =====================  POP ART  ===========================================
export function makePopArt(p: Params): PixelFilter {
  const levels = Math.max(2, Math.round(num(p, 'levels', 4)))
  const sat = num(p, 'saturation', 1.8)
  return (imageData) => {
    const { data } = imageData
    const step = 255 / (levels - 1)
    for (let i = 0; i < data.length; i += 4) {
      const l = luma(data[i], data[i + 1], data[i + 2])
      const r = clamp8(l + (data[i] - l) * sat)
      const g = clamp8(l + (data[i + 1] - l) * sat)
      const b = clamp8(l + (data[i + 2] - l) * sat)
      data[i] = Math.round(r / step) * step
      data[i + 1] = Math.round(g / step) * step
      data[i + 2] = Math.round(b / step) * step
    }
  }
}

// =====================  HALFTONE (magazine)  ===============================
export function makeHalftone(p: Params): PixelFilter {
  const unit = num(p, 'dotSize', 10)
  const colorMode = str(p, 'color', 'mono')
  const ink = str(p, 'ink', '#111111')
  const bg = str(p, 'background', '#f5f5f0')
  const transparent = bool(p, 'transparent', false)
  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const cell = unitToPx(unit, W)
    const { cols, rows, buf, alpha } = averageCells(data, W, H, cell)
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    if (!transparent) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
    }
    const maxR = (cell / 2) * Math.SQRT2
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx
        // Skip cells that were transparent in the source so a transparent PNG
        // stays transparent instead of becoming a field of black dots.
        const ca = transparent ? alpha[idx] / 255 : 1
        if (ca < 0.02) continue
        const k = idx * 3
        const l = luma(buf[k], buf[k + 1], buf[k + 2]) / 255
        const r = maxR * (1 - l)
        if (r < 0.3) continue
        ctx.globalAlpha = ca
        ctx.fillStyle =
          colorMode === 'source'
            ? `rgb(${buf[k] | 0},${buf[k + 1] | 0},${buf[k + 2] | 0})`
            : ink
        ctx.beginPath()
        ctx.arc(cx * cell + cell / 2, cy * cell + cell / 2, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    data.set(ctx.getImageData(0, 0, W, H).data)
  }
}

// =====================  GRAIN  =============================================
export function makeGrain(p: Params): PixelFilter {
  const amount = num(p, 'amount', 30)
  const mono = str(p, 'mode', 'mono') === 'mono'
  return (imageData) => {
    const { data } = imageData
    const a = amount * 2
    for (let i = 0; i < data.length; i += 4) {
      if (mono) {
        const n = (Math.random() - 0.5) * a
        data[i] = clamp8(data[i] + n)
        data[i + 1] = clamp8(data[i + 1] + n)
        data[i + 2] = clamp8(data[i + 2] + n)
      } else {
        data[i] = clamp8(data[i] + (Math.random() - 0.5) * a)
        data[i + 1] = clamp8(data[i + 1] + (Math.random() - 0.5) * a)
        data[i + 2] = clamp8(data[i + 2] + (Math.random() - 0.5) * a)
      }
    }
  }
}

// =====================  VIGNETTE  ==========================================
export function makeVignette(p: Params): PixelFilter {
  const amount = num(p, 'amount', 60) / 100
  const size = num(p, 'size', 0.6)
  const softness = num(p, 'softness', 0.4)
  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const cx = W / 2, cy = H / 2
    const maxR = Math.hypot(cx, cy)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dn = Math.hypot(x - cx, y - cy) / maxR
        let t = (dn - size) / Math.max(0.001, softness)
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const m = 1 - t * amount
        const i = (y * W + x) * 4
        data[i] *= m; data[i + 1] *= m; data[i + 2] *= m
      }
    }
  }
}

// =====================  CELL SHADING (toon)  ===============================
export function makeCellShade(p: Params): PixelFilter {
  const levels = Math.max(2, Math.round(num(p, 'levels', 4)))
  const edgeStrength = num(p, 'edge', 60) / 100
  const edgeColor = hexToRgb(str(p, 'edgeColor', '#000000'))
  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const src = new Uint8ClampedArray(data)
    const step = 255 / (levels - 1)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(data[i] / step) * step
      data[i + 1] = Math.round(data[i + 1] / step) * step
      data[i + 2] = Math.round(data[i + 2] / step) * step
    }
    const lum = (i: number) => 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]
    const row = W * 4
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4
        const gx =
          -lum(i - 4 - row) + lum(i + 4 - row) -
          2 * lum(i - 4) + 2 * lum(i + 4) -
          lum(i - 4 + row) + lum(i + 4 + row)
        const gy =
          -lum(i - 4 - row) - 2 * lum(i - row) - lum(i + 4 - row) +
          lum(i - 4 + row) + 2 * lum(i + row) + lum(i + 4 + row)
        const mag = Math.hypot(gx, gy)
        const e = Math.min(1, (mag / 255) * edgeStrength * 4)
        if (e > 0.05) {
          data[i] = clamp8(data[i] * (1 - e) + edgeColor[0] * e)
          data[i + 1] = clamp8(data[i + 1] * (1 - e) + edgeColor[1] * e)
          data[i + 2] = clamp8(data[i + 2] * (1 - e) + edgeColor[2] * e)
        }
      }
    }
  }
}

// =====================  BLOOM / GLOW  ======================================
function clampI(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function boxBlur(buf: Float32Array, W: number, H: number, r: number) {
  const tmp = new Float32Array(buf.length)
  const win = r * 2 + 1
  for (let y = 0; y < H; y++) {
    let sum = 0
    for (let x = -r; x <= r; x++) sum += buf[y * W + clampI(x, 0, W - 1)]
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = sum / win
      sum += buf[y * W + clampI(x + r + 1, 0, W - 1)] - buf[y * W + clampI(x - r, 0, W - 1)]
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[clampI(y, 0, H - 1) * W + x]
    for (let y = 0; y < H; y++) {
      buf[y * W + x] = sum / win
      sum += tmp[clampI(y + r + 1, 0, H - 1) * W + x] - tmp[clampI(y - r, 0, H - 1) * W + x]
    }
  }
}

// =====================  CHROMATIC ABERRATION  ==============================
// Split the red and blue channels in opposite directions along `angle`. The
// green channel stays put. `offsetPx` is the shift distance in pixels.
function chromaShift(imageData: ImageData, offsetPx: number, angleDeg: number) {
  const { data, width: W, height: H } = imageData
  if (offsetPx < 0.3) return
  const src = new Uint8ClampedArray(data)
  const rad = (angleDeg * Math.PI) / 180
  const ox = Math.cos(rad) * offsetPx
  const oy = Math.sin(rad) * offsetPx
  // Bilinear sample so sub-pixel offsets give a smooth, anti-aliased fringe
  // instead of hard stair-stepped colour bars.
  const sample = (fx: number, fy: number, ch: number): number => {
    if (fx < 0) fx = 0; else if (fx > W - 1) fx = W - 1
    if (fy < 0) fy = 0; else if (fy > H - 1) fy = H - 1
    const x0 = fx | 0, y0 = fy | 0
    const x1 = x0 + 1 < W ? x0 + 1 : x0
    const y1 = y0 + 1 < H ? y0 + 1 : y0
    const tx = fx - x0, ty = fy - y0
    const a = src[(y0 * W + x0) * 4 + ch], b = src[(y0 * W + x1) * 4 + ch]
    const c = src[(y1 * W + x0) * 4 + ch], d = src[(y1 * W + x1) * 4 + ch]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      // Red pulled one way, blue the other; green (and geometry) stay centred.
      data[i] = sample(x - ox, y - oy, 0)
      data[i + 2] = sample(x + ox, y + oy, 2)
      // Keep the widest alpha so the coloured fringes stay visible on
      // transparent layers instead of being clipped to the green silhouette.
      data[i + 3] = Math.max(
        src[i + 3],
        sample(x - ox, y - oy, 3),
        sample(x + ox, y + oy, 3),
      )
    }
  }
}

// Image-effect variant: amount is in resolution-independent units.
export function makeChromatic(p: Params): PixelFilter {
  const amount = num(p, 'amount', 6)
  const angle = num(p, 'angle', 0)
  return (imageData) => {
    // Resolution-independent: scale the pixel offset with the image width.
    const px = (amount * imageData.width) / REF_WIDTH
    chromaShift(imageData, px, angle)
  }
}

// Node-filter variant for cached vector/text nodes: amount is in pixels.
export function makeChromaShift(offsetPx: number, angleDeg: number): PixelFilter {
  return (imageData) => chromaShift(imageData, offsetPx, angleDeg)
}

// A true gaussian blur using the canvas `filter` primitive. Unlike Konva's
// stack blur this composites in premultiplied-alpha space, so it doesn't band
// smooth gradients or leave a bright/dark fringe around glow + transparency.
// Reads its radius from the node it's attached to (this.blurRadius()).
export function GaussianBlurFilter(this: unknown, imageData: ImageData) {
  const node = this as { blurRadius?: () => number }
  const r = typeof node?.blurRadius === 'function' ? node.blurRadius() || 0 : 0
  if (r <= 0) return
  const { width: W, height: H, data } = imageData
  const src = document.createElement('canvas')
  src.width = W; src.height = H
  src.getContext('2d')!.putImageData(imageData, 0, 0)
  const dst = document.createElement('canvas')
  dst.width = W; dst.height = H
  const dctx = dst.getContext('2d')!
  dctx.filter = `blur(${r}px)`
  dctx.drawImage(src, 0, 0)
  data.set(dctx.getImageData(0, 0, W, H).data)
}

export function makeBloom(p: Params): PixelFilter {
  const threshold = num(p, 'threshold', 180)
  const radius = num(p, 'radius', 20)
  const intensity = num(p, 'intensity', 1)
  return (imageData) => {
    const { data, width: W, height: H } = imageData
    const n = W * H
    const br = new Float32Array(n)
    const bg = new Float32Array(n)
    const bb = new Float32Array(n)
    for (let i = 0, q = 0; i < data.length; i += 4, q++) {
      const l = luma(data[i], data[i + 1], data[i + 2])
      const f = l > threshold ? (l - threshold) / (255 - threshold) : 0
      br[q] = data[i] * f; bg[q] = data[i + 1] * f; bb[q] = data[i + 2] * f
    }
    const rad = Math.max(1, unitToPx(radius, W))
    boxBlur(br, W, H, rad); boxBlur(bg, W, H, rad); boxBlur(bb, W, H, rad)
    for (let i = 0, q = 0; i < data.length; i += 4, q++) {
      data[i] = clamp8(data[i] + br[q] * intensity)
      data[i + 1] = clamp8(data[i + 1] + bg[q] * intensity)
      data[i + 2] = clamp8(data[i + 2] + bb[q] * intensity)
    }
  }
}
