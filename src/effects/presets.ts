// One-click "looks" for image layers. A preset sets the basic adjustments and
// an effect stack in one go; applying replaces the layer's current adjustments
// and effects so the result is predictable.
import type { EffectType, ImageAdjustments } from '../types'

export interface Preset {
  id: string
  label: string
  adjustments?: Partial<ImageAdjustments>
  effects?: { type: EffectType; params?: Record<string, number | string | boolean> }[]
}

export const PRESETS: Preset[] = [
  {
    id: 'none',
    label: 'None (reset)',
    adjustments: {},
    effects: [],
  },
  {
    id: 'noir',
    label: 'Noir',
    adjustments: { grayscale: 1, contrast: 35, blacks: -20, clarity: 30 },
    effects: [
      { type: 'grain', params: { amount: 22, mode: 'mono' } },
      { type: 'vignette', params: { amount: 70, size: 0.55, softness: 0.5 } },
    ],
  },
  {
    id: 'vintage',
    label: 'Vintage Fade',
    adjustments: { sepia: 1, contrast: -12, vibrance: -20, highlights: -15, blacks: 18 },
    effects: [
      { type: 'grain', params: { amount: 28, mode: 'color' } },
      { type: 'vignette', params: { amount: 45, size: 0.65, softness: 0.5 } },
    ],
  },
  {
    id: 'vaporwave',
    label: 'Vaporwave',
    adjustments: { saturation: 1.2, hue: 300, contrast: 10 },
    effects: [
      { type: 'duotone', params: { shadow: '#2b1055', highlight: '#ff71ce' } },
      { type: 'chromatic', params: { amount: 8, angle: 90 } },
    ],
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    adjustments: { contrast: 20, saturation: 0.6 },
    effects: [
      { type: 'duotone', params: { shadow: '#0b1e3f', highlight: '#ff2bd6' } },
      { type: 'bloom', params: { threshold: 160, radius: 26, intensity: 1.3 } },
      { type: 'chromatic', params: { amount: 6, angle: 0 } },
    ],
  },
  {
    id: 'comic',
    label: 'Comic / Pop',
    adjustments: { saturation: 1.5, contrast: 15 },
    effects: [
      { type: 'popart', params: { levels: 4, saturation: 2 } },
      { type: 'cellshade', params: { levels: 5, edge: 70, edgeColor: '#000000' } },
    ],
  },
  {
    id: 'lofi',
    label: 'Lo-fi Print',
    adjustments: { contrast: -8, vibrance: -10 },
    effects: [
      { type: 'halftone', params: { dotSize: 8, color: 'source', transparent: false, background: '#f5f2ea' } },
      { type: 'grain', params: { amount: 20, mode: 'mono' } },
    ],
  },
  {
    id: 'c64',
    label: 'Retro C64',
    effects: [
      { type: 'retro', params: { palette: 'c64', dither: 'bayer4', pixel: 4 } },
    ],
  },
]
