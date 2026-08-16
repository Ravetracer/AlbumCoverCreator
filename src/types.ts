// Core domain model for the editor.
// The whole document is serializable to JSON for save/load and export/import.

export type LayerType = 'image' | 'text' | 'shape' | 'flare' | 'particle'

// Konva globalCompositeOperation values we expose as blend modes.
export type BlendMode =
  | 'source-over' // normal
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

// Basic image corrections. Values are neutral at their defaults.
export interface ImageAdjustments {
  brightness: number // -1 .. 1   (Konva Brighten)
  contrast: number //   -100 .. 100 (Konva Contrast)
  saturation: number // -2 .. 10  (Konva HSV saturation delta)
  hue: number //         0 .. 360 (Konva HSV hue rotate)
  luminance: number //  -2 .. 2   (Konva HSV value delta)
  blur: number //        0 .. 100 (px)
  grayscale: number //   0 .. 1   (mix, applied via enable threshold)
  sepia: number //       0 .. 1   (mix)
  // Tone controls (-100..100, custom filter)
  highlights: number
  shadows: number
  whites: number
  blacks: number
  vibrance: number
  dehaze: number //      0 .. 100
  // Detail controls (custom unsharp-mask filter)
  sharpness: number //   0 .. 100
  clarity: number //    -100 .. 100
  structure: number //   0 .. 100
}

export interface BaseLayer {
  id: string
  type: LayerType
  name: string
  visible: boolean
  locked: boolean // when true, the layer can't be dragged or transformed
  opacity: number // 0 .. 1
  blendMode: BlendMode
  // Transform — position is the layer's own coordinates on the stage.
  x: number
  y: number
  rotation: number // degrees
  scaleX: number
  scaleY: number
}

// Phase 2 creative effect stack. Each effect is applied in order after the
// basic adjustments. Params are stored generically and interpreted per type by
// the effects registry.
export type EffectType =
  | 'pixelate'
  | 'retro'
  | 'ascii'
  | 'duotone'
  | 'posterize'
  | 'threshold'
  | 'invert'
  | 'distort'
  | 'popart'
  | 'halftone'
  | 'grain'
  | 'vignette'
  | 'cellshade'
  | 'bloom'
  | 'chromatic'

export interface Effect {
  id: string
  type: EffectType
  enabled: boolean
  params: Record<string, number | string | boolean>
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string // object URL or /covers/... path
  naturalWidth: number
  naturalHeight: number
  adjustments: ImageAdjustments
  effects: Effect[]
  // Crop insets as fractions of natural size (0..0.45 each).
  cropTop: number
  cropRight: number
  cropBottom: number
  cropLeft: number
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  fontStyle: string // 'normal' | 'bold' | 'italic' | 'italic bold'
  fill: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  width?: number // optional wrap width
  curve: number // -100..100 arc bend (0 = straight); nonzero renders on a path
  skewX: number // perspective tilt
  skewY: number
  // Stroke (outline)
  strokeEnabled: boolean
  stroke: string
  strokeWidth: number
  // Glow / bloom (rendered as a shadow)
  glowEnabled: boolean
  glowColor: string
  glowBlur: number
  // Chromatic aberration (RGB split), 0 = off. Requires caching.
  chromAmount: number
  chromAngle: number // degrees
}

// ---- Vector shapes --------------------------------------------------------
export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'line'
export type FillMode = 'none' | 'solid' | 'linear' | 'radial'

export interface ShapeLayer extends BaseLayer {
  type: 'shape'
  shape: ShapeKind
  width: number
  height: number
  fillMode: FillMode
  fill: string
  gradFrom: string
  gradTo: string
  gradAngle: number // degrees, for linear gradient
  strokeEnabled: boolean
  stroke: string
  strokeWidth: number
  cornerRadius: number // rect
  sides: number // polygon
  starPoints: number // star
  starInner: number // star inner/outer ratio 0..1
  startWidth: number // line: width at start
  endWidth: number // line: width at end
  lineRound: boolean // line: rounded (semicircular) end caps instead of flat
  glowEnabled: boolean
  glowColor: string
  glowBlur: number
  blur: number // gaussian softening of the whole shape (0 = none)
  // Chromatic aberration (RGB split), 0 = off. Requires caching.
  chromAmount: number
  chromAngle: number // degrees
}

// ---- Lens flare -----------------------------------------------------------
// x/y (from BaseLayer) hold the light-source point in document coordinates and
// are set by dragging. rotation/scale from BaseLayer are unused.
// Preset keys are defined in effects/flare.ts.
export type FlarePreset = string

export interface FlareElementOverride {
  scale?: number // multiplies element radius
  opacity?: number // multiplies element opacity
  color?: string // overrides element color
}

export interface FlareLayer extends BaseLayer {
  type: 'flare'
  preset: FlarePreset
  size: number // global scale multiplier
  intensity: number // brightness / opacity multiplier
  color: string // tint
  flareRotation: number // streak / starburst angle offset (degrees)
  // Anamorphic streak controls.
  streakFalloff: number // 0..1 gaussian focus
  streakCount: number // sub-streak count
  streakSpread: number // vertical spacing
  streakOffset: number // horizontal parallax
  streakFullWidth: boolean
  // When false, only the main source burst is drawn (ghosts strung along the
  // source→center axis — bokeh, rings, orbs — are hidden).
  showGhosts: boolean
  // Per-element overrides, keyed by element index within the preset.
  overrides: Record<string, FlareElementOverride>
}

// ---- Glowing particles ----------------------------------------------------
// x/y hold a drag offset applied to every particle. Positions are generated
// deterministically from `seed` so redraws are stable.
export type ParticleShape = 'dot' | 'star' | 'triangle' | 'square'
export type ParticleColorMode = 'solid' | 'hue' | 'gradient'

export interface ParticleLayer extends BaseLayer {
  type: 'particle'
  count: number
  size: number // base px
  sizeVariance: number // 0..1
  shape: ParticleShape
  colorMode: ParticleColorMode
  color: string
  gradFrom: string
  gradTo: string
  glowSize: number // halo radius multiple of particle size (0 = none)
  glowColor: string
  glowUseParticleColor: boolean // use each particle's color for its glow
  seed: number
}

export type Layer = ImageLayer | TextLayer | ShapeLayer | FlareLayer | ParticleLayer

export interface CanvasDoc {
  width: number
  height: number
  background: string // solid backdrop color behind all layers
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  luminance: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  dehaze: 0,
  sharpness: 0,
  clarity: 0,
  structure: 0,
}

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
]
