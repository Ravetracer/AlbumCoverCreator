// Declarative registry of Phase 2 effects. Each definition lists its params as a
// schema so the properties panel can render controls generically, and provides
// the defaults used when an effect is added. buildFilter() turns an effect
// instance into a Konva-compatible pixel filter.
import type { Effect, EffectType } from '../types'
import { PALETTE_OPTIONS } from './palettes'
import {
  makeAscii, makeBloom, makeCellShade, makeChromatic, makeDistort, makeDuotone,
  makeGrain, makeHalftone, makeInvert, makePixelate, makePopArt, makePosterize,
  makeRetro, makeThreshold, makeVignette, type PixelFilter,
} from './filters'

export type ParamSpec =
  | { key: string; label: string; kind: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; label: string; kind: 'color'; default: string }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; kind: 'toggle'; default: boolean }

export interface EffectDef {
  type: EffectType
  label: string
  params: ParamSpec[]
}

const DITHER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bayer2', label: 'Ordered 2×2' },
  { value: 'bayer4', label: 'Ordered 4×4' },
  { value: 'bayer8', label: 'Ordered 8×8' },
  { value: 'floyd', label: 'Floyd–Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
]

export const EFFECT_DEFS: EffectDef[] = [
  {
    type: 'pixelate',
    label: 'Pixelate',
    params: [
      { key: 'size', label: 'Cell Size', kind: 'range', min: 1, max: 64, step: 1, default: 8 },
      { key: 'shape', label: 'Shape', kind: 'select', default: 'square', options: [
        { value: 'square', label: 'Square' },
        { value: 'dots', label: 'Dots' },
        { value: 'diamond', label: 'Diamond' },
        { value: 'cross', label: 'Cross' },
      ] },
      { key: 'gap', label: 'Gap', kind: 'range', min: 0, max: 0.9, step: 0.05, default: 0 },
      { key: 'transparent', label: 'Transparent BG', kind: 'toggle', default: true },
      { key: 'background', label: 'Background', kind: 'color', default: '#000000' },
    ],
  },
  {
    type: 'retro',
    label: 'Retro / Color Reduce',
    params: [
      { key: 'palette', label: 'Palette', kind: 'select', default: 'c64', options: PALETTE_OPTIONS },
      { key: 'dither', label: 'Dithering', kind: 'select', default: 'bayer4', options: DITHER_OPTIONS },
      { key: 'pixel', label: 'Pixel Size', kind: 'range', min: 1, max: 32, step: 1, default: 3 },
      { key: 'brightness', label: 'Brightness', kind: 'range', min: -100, max: 100, step: 1, default: 0 },
      { key: 'contrast', label: 'Contrast', kind: 'range', min: -100, max: 100, step: 1, default: 0 },
    ],
  },
  {
    type: 'ascii',
    label: 'ASCII',
    params: [
      { key: 'cell', label: 'Cell Size', kind: 'range', min: 4, max: 24, step: 1, default: 8 },
      { key: 'ramp', label: 'Character Set', kind: 'select', default: 'standard', options: [
        { value: 'standard', label: 'Standard' },
        { value: 'blocks', label: 'Blocks' },
        { value: 'minimal', label: 'Minimal' },
      ] },
      { key: 'color', label: 'Color', kind: 'select', default: 'mono', options: [
        { value: 'mono', label: 'Monochrome' },
        { value: 'source', label: 'From Image' },
      ] },
      { key: 'ink', label: 'Ink', kind: 'color', default: '#00ff66' },
      { key: 'transparent', label: 'Transparent BG', kind: 'toggle', default: true },
      { key: 'background', label: 'Background', kind: 'color', default: '#000000' },
    ],
  },
  {
    type: 'duotone',
    label: 'Duotone',
    params: [
      { key: 'shadow', label: 'Shadow', kind: 'color', default: '#1a1a2e' },
      { key: 'highlight', label: 'Highlight', kind: 'color', default: '#f5d442' },
    ],
  },
  {
    type: 'posterize',
    label: 'Posterize',
    params: [
      { key: 'levels', label: 'Levels', kind: 'range', min: 2, max: 16, step: 1, default: 5 },
    ],
  },
  {
    type: 'threshold',
    label: 'Threshold',
    params: [
      { key: 'level', label: 'Level', kind: 'range', min: 0, max: 255, step: 1, default: 128 },
    ],
  },
  {
    type: 'invert',
    label: 'Invert',
    params: [],
  },
  {
    type: 'distort',
    label: 'Distortion',
    params: [
      { key: 'type', label: 'Type', kind: 'select', default: 'wave', options: [
        { value: 'wave', label: 'Wave' },
        { value: 'ripple', label: 'Ripple' },
        { value: 'swirl', label: 'Swirl' },
      ] },
      { key: 'amount', label: 'Amount', kind: 'range', min: 0, max: 100, step: 1, default: 20 },
      { key: 'frequency', label: 'Frequency', kind: 'range', min: 1, max: 30, step: 1, default: 6 },
    ],
  },
  {
    type: 'popart',
    label: 'Pop Art',
    params: [
      { key: 'levels', label: 'Levels', kind: 'range', min: 2, max: 6, step: 1, default: 4 },
      { key: 'saturation', label: 'Saturation', kind: 'range', min: 1, max: 3, step: 0.1, default: 1.8 },
    ],
  },
  {
    type: 'halftone',
    label: 'Halftone / Magazine',
    params: [
      { key: 'dotSize', label: 'Dot Size', kind: 'range', min: 3, max: 40, step: 1, default: 10 },
      { key: 'color', label: 'Color', kind: 'select', default: 'mono', options: [
        { value: 'mono', label: 'Monochrome' },
        { value: 'source', label: 'From Image' },
      ] },
      { key: 'ink', label: 'Ink', kind: 'color', default: '#111111' },
      { key: 'transparent', label: 'Transparent BG', kind: 'toggle', default: false },
      { key: 'background', label: 'Background', kind: 'color', default: '#f5f5f0' },
    ],
  },
  {
    type: 'grain',
    label: 'Film Grain',
    params: [
      { key: 'amount', label: 'Amount', kind: 'range', min: 0, max: 100, step: 1, default: 30 },
      { key: 'mode', label: 'Mode', kind: 'select', default: 'mono', options: [
        { value: 'mono', label: 'Monochrome' },
        { value: 'color', label: 'Color' },
      ] },
    ],
  },
  {
    type: 'vignette',
    label: 'Vignette',
    params: [
      { key: 'amount', label: 'Amount', kind: 'range', min: 0, max: 100, step: 1, default: 60 },
      { key: 'size', label: 'Size', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.6 },
      { key: 'softness', label: 'Softness', kind: 'range', min: 0.05, max: 1, step: 0.05, default: 0.4 },
    ],
  },
  {
    type: 'cellshade',
    label: 'Cell Shading',
    params: [
      { key: 'levels', label: 'Levels', kind: 'range', min: 2, max: 8, step: 1, default: 4 },
      { key: 'edge', label: 'Edge Strength', kind: 'range', min: 0, max: 100, step: 1, default: 60 },
      { key: 'edgeColor', label: 'Edge Color', kind: 'color', default: '#000000' },
    ],
  },
  {
    type: 'bloom',
    label: 'Glow / Bloom',
    params: [
      { key: 'threshold', label: 'Threshold', kind: 'range', min: 0, max: 255, step: 1, default: 180 },
      { key: 'radius', label: 'Radius', kind: 'range', min: 1, max: 60, step: 1, default: 20 },
      { key: 'intensity', label: 'Intensity', kind: 'range', min: 0, max: 3, step: 0.1, default: 1 },
    ],
  },
  {
    type: 'chromatic',
    label: 'Chromatic Aberration',
    params: [
      { key: 'amount', label: 'Amount', kind: 'range', min: 0, max: 40, step: 0.5, default: 6 },
      { key: 'angle', label: 'Angle', kind: 'range', min: 0, max: 360, step: 1, default: 0 },
    ],
  },
]

export const EFFECT_DEF_BY_TYPE: Record<EffectType, EffectDef> = Object.fromEntries(
  EFFECT_DEFS.map((d) => [d.type, d]),
) as Record<EffectType, EffectDef>

export function defaultParams(type: EffectType): Record<string, number | string | boolean> {
  const def = EFFECT_DEF_BY_TYPE[type]
  const out: Record<string, number | string | boolean> = {}
  for (const p of def.params) out[p.key] = p.default
  return out
}

export function buildFilter(effect: Effect): PixelFilter | null {
  switch (effect.type) {
    case 'pixelate': return makePixelate(effect.params)
    case 'retro': return makeRetro(effect.params)
    case 'ascii': return makeAscii(effect.params)
    case 'duotone': return makeDuotone(effect.params)
    case 'posterize': return makePosterize(effect.params)
    case 'threshold': return makeThreshold(effect.params)
    case 'invert': return makeInvert()
    case 'distort': return makeDistort(effect.params)
    case 'popart': return makePopArt(effect.params)
    case 'halftone': return makeHalftone(effect.params)
    case 'grain': return makeGrain(effect.params)
    case 'vignette': return makeVignette(effect.params)
    case 'cellshade': return makeCellShade(effect.params)
    case 'bloom': return makeBloom(effect.params)
    case 'chromatic': return makeChromatic(effect.params)
    default: return null
  }
}
