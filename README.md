# AlbumCoverCreator

A backend-free, browser-based album cover designer. Pick or upload a background,
stack layers, apply extensive image and vector effects, and export up to 4K —
**no install, no sign-up, nothing leaves your browser.**

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Konva](https://img.shields.io/badge/Konva-canvas%20engine-0d83cd)

---

## Why

Musicians, bands, and producers often need to design a cover quickly without
wrestling with heavyweight desktop software. AlbumCoverCreator runs entirely in
the browser: open it, design, download. Your images are processed locally and
never uploaded to a server.

## Quick start

```bash
npm install
npm run thumbs   # one-time: builds cover thumbnails + manifest (needs ImageMagick)
npm run dev      # start the dev server → http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Features

### Layers
Everything is a layer with its own opacity, blend mode, ordering (drag-and-drop),
and lock. Five layer types:

- **Images** — pre-made backgrounds or your own uploads
- **Text** — rich typography (see below)
- **Vector shapes** — rectangle, ellipse, triangle, polygon, star, tapered line
- **Lens flares** — cinematic light sources with ghosts, streaks, starbursts
- **Glowing particles** — seeded dust/bokeh scatter with colored glow

Everything is positioned by **drag-and-drop** and resized with transform handles
(hold to keep ratio). Hold **Ctrl while rotating** to snap to 45°.

### Image adjustments & effects
- **Corrections** — brightness, contrast, saturation, hue, luminance, blur,
  grayscale, sepia
- **Tone** — highlights, shadows, whites, blacks, vibrance, dehaze
- **Detail** — sharpness, clarity, structure (width-scaled unsharp masking)
- **Crop** — per-side inset sliders
- **Creative effect stack** (add / reorder / toggle per layer):
  Pixelate · Retro / Color Reduce · ASCII · Duotone · Posterize · Threshold ·
  Invert · Distortion · Pop Art · Halftone / Magazine · Film Grain · Vignette ·
  Cell Shading · Glow / Bloom · **Chromatic Aberration**
- **Retro / Color Reduce** ships C64, EGA/Amiga, CGA, ZX, Game Boy, grayscale and
  1-bit palettes with ordered (2/4/8), Floyd–Steinberg and Atkinson dithering.
- Effects are **resolution-independent** — the editing preview matches the
  full-resolution export exactly.

### Text
Curated Google display fonts (grouped by category) plus custom **TTF/OTF upload**.
Color, size, letter spacing, line height, alignment, **curve** (arc), perspective
**tilt**, **stroke** (outline), **glow / bloom**, and **chromatic aberration**.

### Vector shapes
Fill (none / solid / linear or radial gradient), stroke, colored glow, gaussian
body blur, and chromatic aberration. Lines support independent start/end widths
for tapered strokes.

### Color everywhere
Every color control has an **opacity slider** and stores 8-digit hex, so fills,
strokes, glows and gradients can **fade to full transparency** (e.g. a line or
gradient fading out to nothing).

### Handy touches
- **Double-click any slider** to reset it to its default.
- **Align to canvas** — left / center / right / top / middle / bottom.
- **Drag an image file straight onto the canvas** to add it (no dialog).
- **Autosave** to localStorage plus **JSON project export/import** (Save / Open).
- **Export** to PNG or high-quality JPG, up to 4K, rendered at full document
  resolution regardless of the on-screen zoom.

## Cover backgrounds

The full-resolution originals live in `./covers` and are served read-only through
a `public/covers` symlink. Because they are large, `npm run thumbs` (ImageMagick)
generates small WebP thumbnails in `public/covers-thumb/` plus
`public/covers-manifest.json`, which the background picker reads. Re-run it
whenever the covers change. Thumbnails and the manifest are generated artifacts
and are not tracked in git.

## Tech & architecture

- **React 19 + TypeScript + Vite**
- **Konva / react-konva** — canvas scene graph: layers, drag/transform, text,
  shapes, blend modes
- **zustand** (`persist`) — layer state, localStorage autosave, JSON project I/O
- Effects are Konva `ImageData` filters and `sceneFunc` draws — they composite
  for free with layer ordering, blend modes and transforms, and re-cache at full
  resolution for a sharp export.

Key modules:

| Path | Responsibility |
|------|----------------|
| `src/state/store.ts` | zustand store: layers, doc, actions, persistence |
| `src/components/CanvasStage.tsx` | Konva stage, selection, transform, drop-to-add |
| `src/components/PropertiesPanel.tsx` | schema-driven controls for the selected layer |
| `src/components/nodes/*` | one node component per layer type |
| `src/effects/registry.ts` | declarative effect definitions (param schema → UI) |
| `src/effects/filters.ts` | the pixel algorithms |
| `src/lib/export.ts` | full-resolution PNG/JPG export |

## Roadmap & changes

See [CHANGELOG.md](./CHANGELOG.md) for the full history. All core features from
the spec are implemented; the current focus is refinement and new creative
effects.

## Known limitations

- Uploaded images use in-memory object URLs and are **not** restored after a hard
  refresh (only `/covers` paths persist). Saved project files reference the same
  URLs.
- The production bundle is dominated by Konva; code-splitting is a future task.

## License

- **Application source code** — [MIT License](./LICENSE).
- **Cover photographs in `covers/`** — the author's own work, released under the
  [Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
  public-domain dedication: **free to use for any purpose, no attribution
  required.**
