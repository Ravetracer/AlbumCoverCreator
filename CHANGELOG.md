# Changelog

All notable changes to AlbumCoverCreator are documented here.

## Versioning

This project uses a simple `X.Y.Z` scheme:

- **X** — major update (large-scale changes or milestones)
- **Y** — new feature
- **Z** — bug fixes

## [0.2.3] — 2026-08-16

### Added

- Halftone effect gains an **Invert (light = dots)** toggle. Classic halftone
  sizes dots by darkness, so a light-coloured logo on a transparent background
  produces no dots and appears to vanish; inverting makes bright areas the large
  dots so light-on-transparent artwork renders correctly.

## [0.2.2] — 2026-08-16

### Fixed

- Effects on transparent images no longer paint the transparent regions black.
  Halftone, ASCII and Pixelate read the source **alpha**: transparent pixels
  (which are `rgba(0,0,0,0)`, i.e. luma 0 → previously the largest/darkest
  marks) are now skipped in "Transparent BG" mode and filled with the background
  colour otherwise. Cell colour averaging is alpha-weighted so edges don't darken.

## [0.2.1] — 2026-08-16

### Added

- **Rounded ends** option for line shapes: semicircular caps at both ends instead
  of the flat cut, enabling capsule/pill shapes (works with taper and
  fade-to-transparent gradients).

## [0.2.0] — 2026-08-16

Corrections and additions pass.

### Added

- **Chromatic aberration** as an image effect and as an option on shape and text
  layers (RGB channel split with amount and angle).
- **Alignment to canvas** for image, text and shape layers (left / center /
  right / top / middle / bottom), similar to a vector editor's align tool.
- **Text stroke** (outline) and **text glow / bloom** with colour and blur.
- **Transparent colours everywhere**: all colour pickers now include an opacity
  slider and store 8-digit hex, so fills, strokes, glows and gradients can fade
  to full transparency (e.g. a gradient or line fading out to nothing).
- **Transparent background** option for the Pixelate, ASCII and Halftone effects
  instead of a forced solid colour.
- **Drag an image file directly onto the canvas** to add it as a layer, with no
  file dialog.
- **Double-click a slider** to reset it to its default value.
- Lens flare: **Show ghosts** toggle to hide the bokeh/ring ghost elements and
  keep only the main source burst.
- **Hold Ctrl while rotating** to snap rotation to 45° increments.

### Fixed

- Lens flare layer **opacity** now applies (the flare draws directly to the
  canvas and previously ignored the layer opacity).
- **Banding artifacts** when blurring a shape/line: body blur now uses a true
  gaussian blur (canvas filter) instead of the stack blur.
- **White fringe** around a shape/line when glow and softness were combined: the
  gaussian blur composites in premultiplied-alpha space, removing the halo.

## [0.1.0] — 2026-08-16

Initial build. A complete, backend-free, browser-based album cover editor built
in a single day.

### Foundation

- React 19 + TypeScript + Vite project scaffold.
- Konva / react-konva canvas engine with a full layer system.
- Zustand state store with localStorage autosave and JSON project import/export.
- 55 built-in background presets (served from `./covers` with generated WebP
  thumbnails) plus custom image upload.
- High-resolution export to PNG or JPG, up to 4K, rendered at full document
  resolution independent of the on-screen zoom.

### Layers

- Five layer types: **images, text, vector shapes, lens flares, glowing
  particles**.
- Per-layer opacity, rotation, and 16 blend modes.
- Free drag-and-drop positioning and transform handles on the canvas.
- Layer panel with visibility toggle, duplicate, delete, and ordering.

### Image adjustments & effects

- Basic corrections: brightness, contrast, saturation, hue, luminance, blur,
  grayscale, sepia.
- Tone controls: highlights, shadows, whites, blacks, vibrance, dehaze.
- Detail controls: sharpness, clarity, structure (unsharp masking).
- Crop (top/right/bottom/left insets).
- A stackable, per-layer creative **effect stack** (add / remove / reorder /
  toggle), resolution-independent so the editing preview matches the 4K export:
  - Pixelate (square / dots / diamond / cross)
  - Retro / color reduction (C64, EGA/Amiga, CGA, ZX Spectrum, Game Boy,
    grayscale, 1-bit) with ordered, Floyd–Steinberg and Atkinson dithering
  - ASCII
  - Duotone, Posterize, Threshold, Invert
  - Distortion (wave / ripple / swirl)
  - Pop Art
  - Halftone / Magazine
  - Film Grain
  - Vignette
  - Cell Shading
  - Glow / Bloom

### Text

- ~35 curated display fonts grouped by category, plus custom TTF/OTF upload.
- Content, size, style, alignment, color, letter spacing, line height.
- Curved text (arc) and X/Y perspective tilt.

### Vector shapes

- Rectangle, ellipse, triangle, polygon, star, and tapered line.
- Solid / linear-gradient / radial-gradient fills, stroke, colored glow, and
  gaussian body blur.

### Lens flares

- Faithful 2D port of the reference lens-flare renderer: gaussian anamorphic
  streaks with sub-streaks, bokeh ghosts with chromatic fringes, chromatic
  RGB-split rings, and organic starbursts.
- 13 presets, streak controls, adjustable size / intensity / tint / rotation,
  and per-element scale / opacity / color overrides.
- Draggable light source.

### Glowing particles

- Seeded, stable scatter with adjustable count, size, and size variance.
- Shapes (dot / star / triangle / square) and color modes (solid / random hue /
  gradient).
- Colored glow halo, with an option to use each particle's own color as its
  glow.

### Editor UX

- Collapsible (accordion) property sections and collapsible effect cards.
- Lockable layers (locked layers can't be dragged or transformed).
- Drag-and-drop layer reordering.
- Deferred "Exporting…" state for large renders.

### Fixed

- Canvas element no longer overflows across the page and intercepts clicks meant
  for the side panels (which had caused layers to deselect when editing).
- Effect cards no longer collapse to zero height inside the properties panel.
- Selection transform handles are excluded from the exported image.
