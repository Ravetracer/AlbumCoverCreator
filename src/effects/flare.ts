// Static 2D lens flare, ported faithfully from the musicviz LensFlareLayer:
// a single light source with ghost elements strung along the source→center
// axis, drawn additively ('lighter'). Element renderers reproduce the original
// gradient stops, bokeh chromatic fringes, gaussian anamorphic streaks and
// organic starburst rays.
import type { FlareLayer } from '../types'

type ElType =
  | 'glow' | 'orb' | 'spot' | 'ring' | 'halo' | 'hex' | 'bokeh'
  | 'chromatic' | 'starburst' | 'streak'

interface Element {
  type: ElType
  t: number
  size: number
  color: string
  opacity: number
  color2?: string
  hexRot?: number
  sides?: number
  rays?: number
  angleOff?: number
  alt?: boolean
  angle?: number
  streakLen?: number
}

// ---- color helpers ---------------------------------------------------------
function hexToRgba(hex: string, a: number): string {
  if (!hex || hex.length < 7) return `rgba(255,255,255,${+a.toFixed(3)})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${+a.toFixed(3)})`
}
function hexToRgb(hex: string): [number, number, number] {
  if (!hex || hex.length < 7) return [255, 255, 255]
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function tintColor(hex: string, tint: string): string {
  if (!tint || tint === '#ffffff') return hex
  const [r1, g1, b1] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(tint)
  return '#' + [r1 * r2 / 255, g1 * g2 / 255, b1 * b2 / 255]
    .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

// ---- element renderers (verbatim gradient math) ----------------------------
function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, c2?: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.07, hexToRgba(c2 || c, 0.95))
  g.addColorStop(0.22, hexToRgba(c, 0.7))
  g.addColorStop(0.5, hexToRgba(c, 0.35))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, hexToRgba(c, 0.9))
  g.addColorStop(0.35, hexToRgba(c, 0.5))
  g.addColorStop(0.7, hexToRgba(c, 0.18))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function drawSpot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, 'rgba(255,255,255,.95)')
  g.addColorStop(0.2, hexToRgba(c, 0.85))
  g.addColorStop(0.55, hexToRgba(c, 0.35))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, rw?: number) {
  const w = Math.max(2, rw ?? r * 0.28)
  const inner = Math.max(0, r - w), outer = r + w * 0.5
  const g = ctx.createRadialGradient(x, y, inner, x, y, outer)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.3, hexToRgba(c, 0.45))
  g.addColorStop(0.55, hexToRgba(c, 1))
  g.addColorStop(0.7, hexToRgba(c, 0.45))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2); ctx.fill()
}

function drawHalo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, hw?: number) {
  const w = hw ?? r * 0.45, inner = Math.max(0, r - w), outer = r + w * 0.5
  const g = ctx.createRadialGradient(x, y, inner, x, y, outer)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.5, hexToRgba(c, 0.28))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, outer, 0, Math.PI * 2); ctx.fill()
}

function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, rot = 30) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  g.addColorStop(0, hexToRgba(c, 0.22))
  g.addColorStop(0.65, hexToRgba(c, 0.1))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath(); ctx.fillStyle = g; ctx.fill()
  ctx.strokeStyle = hexToRgba(c, 0.5); ctx.lineWidth = Math.max(1, r * 0.05); ctx.stroke()
  ctx.restore()
}

function drawBokeh(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, sides = 6, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180)
  const poly = (radius: number) => {
    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius)
      else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
    }
    ctx.closePath()
  }
  const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  fill.addColorStop(0, hexToRgba(color, 0.03))
  fill.addColorStop(0.65, hexToRgba(color, 0.07))
  fill.addColorStop(1, 'rgba(0,0,0,0)')
  poly(r); ctx.fillStyle = fill; ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.044); ctx.strokeStyle = hexToRgba(color, 0.88); poly(r); ctx.stroke()
  ctx.lineWidth = Math.max(0.5, r * 0.018); ctx.strokeStyle = hexToRgba(color, 0.32); poly(r * 0.86); ctx.stroke()
  ctx.lineWidth = Math.max(0.5, r * 0.02); ctx.strokeStyle = 'rgba(255,65,25,.26)'; poly(r * 1.032); ctx.stroke()
  ctx.strokeStyle = 'rgba(45,95,255,.26)'; poly(r * 0.958); ctx.stroke()
  ctx.restore()
}

function drawChromatic(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, rw?: number) {
  const w = rw ?? r * 0.22
  drawRing(ctx, x - w * 0.5, y, r, '#ff4422', w * 0.8)
  drawRing(ctx, x, y, r, c, w)
  drawRing(ctx, x + w * 0.5, y, r, '#2255ff', w * 0.8)
}

const RAY_GROUPS = [1.0, 0.55, 0.68, 0.38, 0.9, 0.44, 0.62, 0.35]

function drawStarburst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rays: number, angleOff: number, alt: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((angleOff * Math.PI) / 180)
  const blob = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.14)
  blob.addColorStop(0, 'rgba(255,255,255,1)')
  blob.addColorStop(0.38, hexToRgba(color, 0.88))
  blob.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = blob
  ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill()
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    const rr = alt ? r * RAY_GROUPS[i % RAY_GROUPS.length] : r
    ctx.save(); ctx.rotate(a)
    const gw = Math.max(2, rr * 0.052)
    const gg = ctx.createLinearGradient(0, 0, rr, 0)
    gg.addColorStop(0, hexToRgba(color, 0.55))
    gg.addColorStop(0.1, hexToRgba(color, 0.32))
    gg.addColorStop(0.55, hexToRgba(color, 0.05))
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gg; ctx.fillRect(0, -gw, rr, gw * 2)
    const tw = Math.max(0.5, rr * 0.009)
    const cg = ctx.createLinearGradient(0, 0, rr, 0)
    cg.addColorStop(0, 'rgba(255,255,255,1)')
    cg.addColorStop(0.06, hexToRgba(color, 0.98))
    cg.addColorStop(0.44, hexToRgba(color, 0.28))
    cg.addColorStop(0.85, hexToRgba(color, 0.04))
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg; ctx.fillRect(0, -tw, rr, tw * 2)
    ctx.restore()
  }
  ctx.restore()
}

let _sc1: HTMLCanvasElement | null = null
let _sc2: HTMLCanvasElement | null = null

function drawStreak(
  ctx: CanvasRenderingContext2D, srcX: number, srcY: number, cw: number, ch: number,
  hh: number, color: string, angle: number, streakLen: number, falloff: number,
  count: number, spread: number, xOffset: number,
) {
  if (!_sc1) { _sc1 = document.createElement('canvas'); _sc2 = document.createElement('canvas') }
  const sc1 = _sc1!, sc2 = _sc2!
  ctx.save(); ctx.translate(srcX, srcY); ctx.rotate((angle * Math.PI) / 180)
  const hw = cw * streakLen / 2
  const fo2 = falloff * falloff * 7.5
  const tw = Math.ceil(hw * 2) + 4

  const makeFalloffGrad = (gctx: CanvasRenderingContext2D, w: number, dx: number) => {
    const g = gctx.createLinearGradient(0, 0, w, 0)
    for (let i = 0; i <= 64; i++) {
      const screenX = (i / 64) * w - w / 2
      const tt = (screenX - dx) / hw
      const a = fo2 > 0.005 ? Math.exp(-tt * tt * fo2) : 1
      g.addColorStop(i / 64, `rgba(255,255,255,${Math.max(0, Math.min(1, a)).toFixed(5)})`)
    }
    return g
  }

  const bodyH = Math.ceil(hh * 2) + 4
  const coreHh = hh * 0.13
  const coreH = Math.ceil(coreHh * 2) + 4
  const lightNormX = (srcX - cw / 2) / (cw / 2)
  const lightAbsY = Math.abs((srcY - ch / 2) / (ch / 2))

  for (let sub = 0; sub < count; sub++) {
    const i = sub - (count - 1) / 2
    const yOff = i * hh * spread * lightAbsY
    const dx = -i * xOffset * lightNormX * cw

    sc1.width = tw; sc1.height = bodyH
    const bx = sc1.getContext('2d')!
    const vg = bx.createLinearGradient(0, 0, 0, bodyH)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(0.15, hexToRgba(color, 0.18))
    vg.addColorStop(0.5, hexToRgba(color, 0.74))
    vg.addColorStop(0.85, hexToRgba(color, 0.18))
    vg.addColorStop(1, 'rgba(0,0,0,0)')
    bx.fillStyle = vg; bx.fillRect(0, 0, tw, bodyH)
    if (fo2 > 0.005) {
      bx.globalCompositeOperation = 'destination-in'
      bx.fillStyle = makeFalloffGrad(bx, tw, dx); bx.fillRect(0, 0, tw, bodyH)
    }
    ctx.drawImage(sc1, -hw - 2, yOff - hh - 2)

    sc2.width = tw; sc2.height = coreH
    const cx = sc2.getContext('2d')!
    const cg = cx.createLinearGradient(0, 0, 0, coreH)
    cg.addColorStop(0, 'rgba(0,0,0,0)')
    cg.addColorStop(0.5, 'rgba(255,255,255,.88)')
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    cx.fillStyle = cg; cx.fillRect(0, 0, tw, coreH)
    if (fo2 > 0.005) {
      cx.globalCompositeOperation = 'destination-in'
      cx.fillStyle = makeFalloffGrad(cx, tw, dx); cx.fillRect(0, 0, tw, coreH)
    }
    ctx.drawImage(sc2, -hw - 2, yOff - coreHh - 2)
  }
  ctx.restore()
}

// ---- presets ---------------------------------------------------------------
const e = (type: ElType, t: number, size: number, color: string, opacity: number, opts: Partial<Element> = {}): Element =>
  ({ type, t, size, color, opacity, ...opts })

export const PRESETS: Record<string, Element[]> = {
  'classic-cinema': [
    e('glow', 0, 0.18, '#fffae8', 1.0, { color2: '#ffdd88' }),
    e('orb', 0.35, 0.05, '#ffcc66', 0.48),
    e('ring', 0.55, 0.09, '#ddaa44', 0.35),
    e('hex', 0.72, 0.08, '#cc9933', 0.3, { hexRot: 30 }),
    e('orb', 0.88, 0.04, '#ffbb55', 0.42),
    e('ring', 1.08, 0.07, '#bb9922', 0.28),
    e('orb', 1.3, 0.03, '#ddaa44', 0.25),
  ],
  'blue-streak': [
    e('glow', 0, 0.16, '#ffffff', 1.0, { color2: '#aaccff' }),
    e('streak', 0, 0.03, '#3366ff', 0.9),
    e('bokeh', 0.4, 0.05, '#6699ff', 0.45),
    e('ring', 0.62, 0.08, '#3355dd', 0.35),
    e('bokeh', 0.77, 0.035, '#4477cc', 0.38),
    e('bokeh', 0.92, 0.07, '#1133aa', 0.28, { hexRot: 30 }),
    e('bokeh', 1.12, 0.028, '#2244bb', 0.28),
    e('ring', 1.38, 0.055, '#1144aa', 0.18),
  ],
  anamorphic: [
    e('glow', 0, 0.14, '#ffffff', 1.0, { color2: '#cfe0ff' }),
    e('streak', 0, 0.03, '#7fb0ff', 0.85, { streakLen: 1.6 }),
    e('bokeh', 0.45, 0.05, '#9cc0ff', 0.4),
    e('ring', 0.9, 0.09, '#5f8fff', 0.24),
    e('bokeh', 1.15, 0.06, '#3f6fdd', 0.24, { hexRot: 30 }),
  ],
  'rgb-split': [
    e('glow', 0, 0.14, '#ffffff', 1.0),
    e('streak', 0, 0.025, '#ff3333', 0.5, { angle: -1.5 }),
    e('streak', 0, 0.025, '#33ff44', 0.5, { angle: 0 }),
    e('streak', 0, 0.025, '#3355ff', 0.5, { angle: 1.5 }),
    e('chromatic', 0.7, 0.08, '#88aaff', 0.4),
  ],
  bokeh: [
    e('glow', 0, 0.1, '#ffffff', 0.9),
    e('bokeh', 0.3, 0.07, '#ffe0a0', 0.24, { hexRot: 12 }),
    e('bokeh', 0.55, 0.11, '#ffd080', 0.2, { hexRot: 40 }),
    e('bokeh', 0.8, 0.06, '#fff0c0', 0.26, { hexRot: 5 }),
    e('bokeh', 1.15, 0.14, '#ffcf90', 0.16, { hexRot: 22 }),
    e('bokeh', 1.5, 0.09, '#ffe0a0', 0.2, { hexRot: 33 }),
  ],
  spherical: [
    e('glow', 0, 0.16, '#ffffff', 1.0, { color2: '#eaf2ff' }),
    e('orb', 0.3, 0.05, '#cfe0ff', 0.4),
    e('ring', 0.5, 0.09, '#9fc0ff', 0.3),
    e('hex', 0.7, 0.08, '#7fa8ff', 0.28, { hexRot: 30 }),
    e('orb', 0.9, 0.04, '#bcd6ff', 0.36),
    e('halo', 0, 0.4, '#a8c8ff', 0.16),
    e('ring', 1.2, 0.06, '#6f98ee', 0.22),
  ],
  sun: [
    e('halo', 0, 0.55, '#ff8800', 0.15),
    e('halo', 0, 0.35, '#ffcc44', 0.28),
    e('glow', 0, 0.24, '#ffffff', 1.0, { color2: '#ffee88' }),
    e('starburst', 0, 0.45, '#ffcc44', 0.7, { rays: 12, angleOff: 7.5, alt: true }),
    e('starburst', 0, 0.25, '#ffdd66', 0.5, { rays: 12, angleOff: 0, alt: false }),
    e('orb', 0.6, 0.035, '#ffcc44', 0.32),
  ],
  'solar-eruption': [
    e('halo', 0, 0.5, '#ff6600', 0.16),
    e('glow', 0, 0.2, '#ffffff', 1.0, { color2: '#ffcc66' }),
    e('starburst', 0, 0.65, '#ff7722', 0.7, { rays: 12, angleOff: 0, alt: true }),
    e('starburst', 0, 0.32, '#ffcc44', 0.55, { rays: 12, angleOff: 15, alt: false }),
    e('starburst', 0, 0.18, '#ffee88', 0.4, { rays: 24, angleOff: 7.5, alt: false }),
  ],
  'cross-streak': [
    e('glow', 0, 0.16, '#ffffff', 1.0),
    e('streak', 0, 0.025, '#ffffff', 0.85, { angle: 0 }),
    e('streak', 0, 0.025, '#ffffff', 0.85, { angle: 90 }),
    e('ring', 0.8, 0.07, '#cfe0ff', 0.22),
  ],
  'rainbow-star': [
    e('glow', 0, 0.14, '#ffffff', 1.0),
    e('starburst', 0, 0.4, '#ff3333', 0.5, { rays: 2, angleOff: 0, alt: false }),
    e('starburst', 0, 0.4, '#ffaa22', 0.5, { rays: 2, angleOff: 30, alt: false }),
    e('starburst', 0, 0.4, '#ffee33', 0.5, { rays: 2, angleOff: 60, alt: false }),
    e('starburst', 0, 0.4, '#33dd55', 0.5, { rays: 2, angleOff: 90, alt: false }),
    e('starburst', 0, 0.4, '#3388ff', 0.5, { rays: 2, angleOff: 120, alt: false }),
    e('starburst', 0, 0.4, '#aa55ff', 0.5, { rays: 2, angleOff: 150, alt: false }),
  ],
  eclipse: [
    e('halo', 0, 0.35, '#ffcc44', 0.22),
    e('ring', 0, 0.18, '#ff8800', 0.7),
    e('glow', 0, 0.12, '#000011', 0.9),
    e('halo', 0, 0.22, '#ffaa22', 0.28),
  ],
  minimal: [
    e('glow', 0, 0.18, '#ffffff', 1.0),
    e('halo', 0, 0.36, '#fff4d6', 0.22),
  ],
  classic: [
    e('glow', 0, 0.16, '#ffffff', 1.0, { color2: '#fff4d6' }),
    e('ring', 0, 0.22, '#fff4d6', 0.3),
    e('orb', 0.32, 0.05, '#fff4d6', 0.35),
    e('spot', 0.5, 0.028, '#ffffff', 0.5),
    e('bokeh', 0.7, 0.06, '#fff4d6', 0.25, { hexRot: 30 }),
    e('orb', 0.9, 0.04, '#fff4d6', 0.3),
    e('ring', 1.2, 0.08, '#fff4d6', 0.2),
    e('bokeh', 1.5, 0.1, '#fff4d6', 0.18),
  ],
}

export type FlarePreset = keyof typeof PRESETS

export const FLARE_PRESET_OPTIONS: { value: string; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'classic-cinema', label: 'Classic Cinema' },
  { value: 'anamorphic', label: 'Anamorphic' },
  { value: 'blue-streak', label: 'Blue Streak' },
  { value: 'rgb-split', label: 'RGB Split' },
  { value: 'bokeh', label: 'Bokeh Ghosts' },
  { value: 'spherical', label: 'Spherical' },
  { value: 'sun', label: 'Sun / Corona' },
  { value: 'solar-eruption', label: 'Solar Eruption' },
  { value: 'cross-streak', label: 'Cross Streak' },
  { value: 'rainbow-star', label: 'Rainbow Star' },
  { value: 'eclipse', label: 'Eclipse' },
  { value: 'minimal', label: 'Minimal' },
]

// Element metadata for the per-element override UI.
export function getFlareElements(preset: string, tint: string) {
  const els = PRESETS[preset] ?? PRESETS.classic
  return els.map((el, i) => ({
    index: i,
    type: el.type,
    label: `${i + 1}. ${el.type}`,
    defaultColor: tintColor(el.color, tint),
    defaultOpacity: el.opacity,
  }))
}

// Draw the whole flare. Everything is in the node's local coordinates where the
// origin (0,0) sits on the light source and 1 unit = 1 document pixel.
export function drawFlare(ctx: CanvasRenderingContext2D, layer: FlareLayer, docW: number, docH: number) {
  const els = PRESETS[layer.preset] ?? PRESETS.classic
  const cw = docW, ch = docH
  const minDim = Math.min(cw, ch)
  const rot = layer.flareRotation
  const intensity = Math.max(0.2, layer.intensity)
  // Source is the node origin (0,0); doc-space source = layer.x/y.
  const sx = layer.x
  const cx2 = cw / 2 - layer.x // screen center in local coords
  const cy2 = ch / 2 - layer.y

  // Elements strung along the source→center axis (t > 0) are the "ghosts"
  // (bokeh, rings, orbs). When ghosts are disabled only the main source burst
  // (t == 0: glow, streak, starburst, halo) is drawn.
  const showGhosts = layer.showGhosts ?? true
  // Konva sets the context's globalAlpha to the node's absolute opacity before
  // calling sceneFunc; capture it so per-element alphas below honour the layer
  // opacity (drawing directly on the native ctx otherwise discards it).
  const layerAlpha = ctx.globalAlpha

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let idx = 0; idx < els.length; idx++) {
    const el = els[idx]
    if (!showGhosts && el.t > 0) continue
    const ov = layer.overrides?.[idx] ?? {}
    const elScale = ov.scale ?? 1
    const r = el.size * minDim * layer.size * elScale * intensity
    const a = Math.min(1, el.opacity * (ov.opacity ?? 1) * intensity) * layerAlpha
    const baseColor = ov.color ?? el.color
    const color = tintColor(baseColor, layer.color)
    ctx.globalAlpha = a
    const px = 0 + (cx2 - 0) * el.t
    const py = 0 + (cy2 - 0) * el.t
    switch (el.type) {
      case 'glow': drawGlow(ctx, px, py, r, color, el.color2 ? tintColor(el.color2, layer.color) : undefined); break
      case 'orb': drawOrb(ctx, px, py, r, color); break
      case 'spot': drawSpot(ctx, px, py, r, color); break
      case 'ring': drawRing(ctx, px, py, r, color); break
      case 'halo': drawHalo(ctx, px, py, r, color); break
      case 'hex': drawHex(ctx, px, py, r, color, el.hexRot ?? 30); break
      case 'bokeh': drawBokeh(ctx, px, py, r, color, el.sides ?? 6, el.hexRot ?? 30); break
      case 'chromatic': drawChromatic(ctx, px, py, r, color); break
      case 'starburst': drawStarburst(ctx, px, py, r, color, el.rays ?? 6, (el.angleOff ?? 0) + rot, el.alt !== false); break
      case 'streak': {
        const slen = layer.streakFullWidth
          ? 2 * Math.max((sx / cw), 1 - (sx / cw)) + 0.05
          : (el.streakLen ?? 1.3)
        drawStreak(
          ctx, 0, 0, cw, ch, r, color, (el.angle ?? 0) + rot, slen,
          layer.streakFalloff, Math.max(1, Math.round(layer.streakCount)),
          layer.streakSpread, layer.streakOffset,
        )
        break
      }
    }
  }
  ctx.restore()
}
