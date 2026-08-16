// Static glowing-particle field. Positions are generated from a seed so the
// scatter is stable across redraws; changing the seed reshuffles it.
import type { ParticleLayer } from '../types'

// Deterministic PRNG (mulberry32).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Apply alpha to any CSS color string (hex, hsl(), rgb()).
function withAlpha(c: string, a: number): string {
  if (c[0] === '#') return rgba(c, a)
  if (c.startsWith('hsl(')) return c.replace('hsl(', 'hsla(').replace(')', `,${a})`)
  if (c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `,${a})`)
  return c
}

function lerpHex(from: string, to: string, t: number): string {
  const a = parseInt(from.replace('#', ''), 16)
  const b = parseInt(to.replace('#', ''), 16)
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t)
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t)
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t)
  return `rgb(${r},${g},${bl})`
}

function drawShape(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, s: number) {
  switch (shape) {
    case 'square':
      ctx.fillRect(x - s, y - s, s * 2, s * 2)
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.lineTo(x + s, y + s)
      ctx.lineTo(x - s, y + s)
      ctx.closePath(); ctx.fill()
      break
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s : s * 0.45
        const ang = (i / 10) * Math.PI * 2 - Math.PI / 2
        const px = x + Math.cos(ang) * r
        const py = y + Math.sin(ang) * r
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.fill()
      break
    }
    default: // dot
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill()
  }
}

interface Particle { x: number; y: number; s: number }

// Generate particle positions/sizes in document coordinates (deterministic).
export function generateParticles(layer: ParticleLayer, docW: number, docH: number): Particle[] {
  const rnd = mulberry32(layer.seed || 1)
  const out: Particle[] = []
  for (let i = 0; i < layer.count; i++) {
    const x = rnd() * docW
    const y = rnd() * docH
    const sv = 1 + (rnd() * 2 - 1) * layer.sizeVariance
    out.push({ x, y, s: Math.max(0.5, layer.size * sv) })
    rnd() // advance for color determinism
  }
  return out
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  layer: ParticleLayer,
  docW: number,
  docH: number,
) {
  const rnd = mulberry32(layer.seed || 1)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < layer.count; i++) {
    const x = rnd() * docW
    const y = rnd() * docH
    const sv = 1 + (rnd() * 2 - 1) * layer.sizeVariance
    const s = Math.max(0.5, layer.size * sv)
    const ct = rnd()

    let color = layer.color
    if (layer.colorMode === 'hue') color = `hsl(${Math.floor(ct * 360)},95%,62%)`
    else if (layer.colorMode === 'gradient') color = lerpHex(layer.gradFrom, layer.gradTo, ct)

    if (layer.glowSize > 0) {
      const gr = s * layer.glowSize
      const glowCol = layer.glowUseParticleColor ? color : layer.glowColor
      const g = ctx.createRadialGradient(x, y, 0, x, y, gr)
      g.addColorStop(0, withAlpha(glowCol, 0.8))
      g.addColorStop(1, withAlpha(glowCol, 0))
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, gr, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = color
    drawShape(ctx, layer.shape, x, y, s)
  }
  ctx.restore()
}
