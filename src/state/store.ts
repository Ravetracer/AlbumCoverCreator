import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type CanvasDoc,
  type Effect,
  type EffectType,
  type FlareLayer,
  type ImageLayer,
  type Layer,
  type ParticleLayer,
  type ShapeKind,
  type ShapeLayer,
  type TextLayer,
  type AdjustLayer,
  DEFAULT_ADJUSTMENTS,
} from '../types'
import { defaultParams } from '../effects/registry'
import type { Preset } from '../effects/presets'

// Non-cryptographic id; fine for layer keys.
let idCounter = 0
function makeId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

// How many undo steps we keep. Older steps are dropped off the front.
const HISTORY_LIMIT = 10

// A point-in-time snapshot of the editable document. Selection is intentionally
// excluded so undo/redo only ever moves visible content, never focus.
interface Snapshot {
  doc: CanvasDoc
  layers: Layer[]
}

// Unrotated on-canvas bounding size of a layer, used for alignment. Flares and
// particles cover the whole canvas / have no meaningful box, so they're skipped.
function layerBox(l: Layer): { w: number; h: number } | null {
  if (l.type === 'image') {
    const iw = (1 - (l.cropLeft ?? 0) - (l.cropRight ?? 0)) * l.naturalWidth
    const ih = (1 - (l.cropTop ?? 0) - (l.cropBottom ?? 0)) * l.naturalHeight
    return { w: iw * l.scaleX, h: ih * l.scaleY }
  }
  if (l.type === 'shape') {
    return { w: l.width * l.scaleX, h: l.height * l.scaleY }
  }
  if (l.type === 'text') {
    const lines = l.text.split('\n').length
    const w = (l.width ?? Math.max(40, l.text.length * l.fontSize * 0.55)) * l.scaleX
    const h = l.fontSize * l.lineHeight * lines * l.scaleY
    return { w, h }
  }
  return null
}

interface EditorState {
  doc: CanvasDoc
  layers: Layer[] // index 0 = bottom of the stack
  selectedId: string | null

  // undo/redo history (not persisted)
  past: Snapshot[]
  future: Snapshot[]
  undo: () => void
  redo: () => void

  // selection
  select: (id: string | null) => void

  // Which layer's image mask is currently being edited on-canvas (move / scale
  // / rotate). Transient — never persisted or recorded in history.
  maskEditId: string | null
  setMaskEdit: (id: string | null) => void

  // doc
  setDoc: (patch: Partial<CanvasDoc>) => void

  // layer lifecycle
  addImageLayer: (opts: {
    src: string
    naturalWidth: number
    naturalHeight: number
    name?: string
  }) => void
  addTextLayer: () => void
  addShapeLayer: (kind: ShapeKind) => void
  addFlareLayer: () => void
  addParticleLayer: () => void
  addAdjustLayer: () => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void

  // layer edits
  updateLayer: (id: string, patch: Partial<Layer>) => void
  updateAdjustments: (id: string, patch: Partial<ImageLayer['adjustments']>) => void

  // one-click looks (image layers) — replaces adjustments + effect stack
  applyPreset: (layerId: string, preset: Preset) => void

  // effect stack (image layers)
  addEffect: (layerId: string, type: EffectType) => void
  removeEffect: (layerId: string, effectId: string) => void
  toggleEffect: (layerId: string, effectId: string) => void
  updateEffectParams: (
    layerId: string,
    effectId: string,
    patch: Record<string, number | string | boolean>,
  ) => void
  moveEffect: (layerId: string, effectId: string, dir: 'up' | 'down') => void

  // ordering
  moveLayer: (id: string, dir: 'up' | 'down' | 'top' | 'bottom') => void
  reorderLayer: (fromId: string, toId: string) => void
  // Set the full stacking order at once. Ids are bottom-to-top (array order).
  setLayerOrder: (orderedIds: string[]) => void

  // alignment relative to the canvas
  alignLayer: (id: string, mode: AlignMode) => void

  // project io
  loadProject: (data: { doc: CanvasDoc; layers: Layer[] }) => void
  reset: () => void
}

const DEFAULT_DOC: CanvasDoc = {
  width: 2000,
  height: 2000,
  background: '#111318',
}

// Backfill fields added in later phases so projects saved by earlier versions
// (or hand-edited files) load without undefined values.
function normalizeLayer(raw: Layer): Layer {
  const l = { ...raw, locked: raw.locked ?? false } as Layer
  if (l.type === 'particle') {
    const p = l as ParticleLayer
    return { ...p, glowUseParticleColor: p.glowUseParticleColor ?? false }
  }
  if (l.type === 'image') {
    const img = l as ImageLayer
    return {
      ...img,
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...img.adjustments },
      effects: Array.isArray(img.effects) ? img.effects : [],
      cropTop: img.cropTop ?? 0,
      cropRight: img.cropRight ?? 0,
      cropBottom: img.cropBottom ?? 0,
      cropLeft: img.cropLeft ?? 0,
    }
  }
  if (l.type === 'text') {
    const t = l as TextLayer
    return {
      ...t,
      curve: t.curve ?? 0,
      curveStyle: t.curveStyle ?? 'arc',
      skewX: t.skewX ?? 0,
      skewY: t.skewY ?? 0,
      strokeEnabled: t.strokeEnabled ?? false,
      stroke: t.stroke ?? '#000000',
      strokeWidth: t.strokeWidth ?? 4,
      glowEnabled: t.glowEnabled ?? false,
      glowColor: t.glowColor ?? '#4f8cff',
      glowBlur: t.glowBlur ?? 20,
      chromAmount: t.chromAmount ?? 0,
      chromAngle: t.chromAngle ?? 0,
    }
  }
  if (l.type === 'shape') {
    const s = l as ShapeLayer
    return { ...s, blur: s.blur ?? 0, chromAmount: s.chromAmount ?? 0, chromAngle: s.chromAngle ?? 0, lineRound: s.lineRound ?? false }
  }
  if (l.type === 'adjust') {
    const adj = l as AdjustLayer
    return {
      ...adj,
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...adj.adjustments },
      effects: Array.isArray(adj.effects) ? adj.effects : [],
    }
  }
  if (l.type === 'flare') {
    const f = l as FlareLayer
    return {
      ...f,
      overrides: f.overrides ?? {},
      streakFalloff: f.streakFalloff ?? 0.65,
      streakCount: f.streakCount ?? 1,
      streakSpread: f.streakSpread ?? 2.0,
      streakOffset: f.streakOffset ?? 0.0,
      streakFullWidth: f.streakFullWidth ?? false,
      showGhosts: f.showGhosts ?? true,
    }
  }
  return l
}

// Center a new layer of the given natural size within the canvas, scaled to
// cover roughly 90% of the shorter edge (images) or placed centered (text).
function coverScale(doc: CanvasDoc, w: number, h: number): number {
  const scale = Math.min(doc.width / w, doc.height / h)
  return scale
}

export const useEditor = create<EditorState>()(
  persist(
    (set, get) => {
      // History coalescing: rapid edits of the same kind (a slider drag, moving
      // a layer around the canvas) collapse into a single undo step instead of
      // flooding the stack. `key` identifies the edit stream; a matching key
      // within the window extends the current step rather than opening a new one.
      let lastKey = ''
      let lastTime = 0

      // Snapshot the current document into the undo stack. Call this *before*
      // applying a mutation. Passing a key enables coalescing for that stream.
      const record = (key = '') => {
        const now = Date.now()
        if (key && key === lastKey && now - lastTime < 600) {
          lastTime = now
          return
        }
        lastKey = key
        lastTime = now
        const s = get()
        const past = [...s.past, { doc: s.doc, layers: s.layers }]
        while (past.length > HISTORY_LIMIT) past.shift()
        set({ past, future: [] })
      }

      // Undo/redo swap a snapshot between the two stacks. Reset the coalescing
      // key so the next edit always opens a fresh step.
      const restore = (from: 'past' | 'future') => {
        const s = get()
        const stack = s[from]
        if (stack.length === 0) return
        const snap = stack[stack.length - 1]
        const rest = stack.slice(0, -1)
        const current: Snapshot = { doc: s.doc, layers: s.layers }
        const other =
          from === 'past'
            ? [...s.future, current].slice(-HISTORY_LIMIT)
            : [...s.past, current].slice(-HISTORY_LIMIT)
        lastKey = ''
        lastTime = 0
        // Drop the selection if the restored snapshot no longer contains it.
        const stillThere = snap.layers.some((l) => l.id === s.selectedId)
        set(
          from === 'past'
            ? { doc: snap.doc, layers: snap.layers, past: rest, future: other, selectedId: stillThere ? s.selectedId : null }
            : { doc: snap.doc, layers: snap.layers, future: rest, past: other, selectedId: stillThere ? s.selectedId : null },
        )
      }

      return {
        doc: DEFAULT_DOC,
        layers: [],
        selectedId: null,
        maskEditId: null,
        past: [],
        future: [],

        undo: () => restore('past'),
        redo: () => restore('future'),

        // Selecting a different layer leaves any mask-edit mode.
        select: (id) => set((s) => ({ selectedId: id, maskEditId: id === s.maskEditId ? s.maskEditId : null })),
        setMaskEdit: (id) => set({ maskEditId: id }),

        setDoc: (patch) => {
          record('doc')
          set((s) => ({ doc: { ...s.doc, ...patch } }))
        },

        addImageLayer: ({ src, naturalWidth, naturalHeight, name }) => {
          record()
          set((s) => {
            const scale = coverScale(s.doc, naturalWidth, naturalHeight)
            const id = makeId('img')
            const layer: ImageLayer = {
              id,
              type: 'image',
              name: name ?? `Image ${s.layers.length + 1}`,
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'source-over',
              x: (s.doc.width - naturalWidth * scale) / 2,
              y: (s.doc.height - naturalHeight * scale) / 2,
              rotation: 0,
              scaleX: scale,
              scaleY: scale,
              src,
              naturalWidth,
              naturalHeight,
              adjustments: { ...DEFAULT_ADJUSTMENTS },
              effects: [],
              cropTop: 0,
              cropRight: 0,
              cropBottom: 0,
              cropLeft: 0,
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        addTextLayer: () => {
          record()
          set((s) => {
            const id = makeId('txt')
            const layer: TextLayer = {
              id,
              type: 'text',
              name: 'Text',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'source-over',
              x: s.doc.width / 2 - 300,
              y: s.doc.height / 2 - 60,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              text: 'Album Title',
              fontFamily: 'Anton',
              fontSize: 120,
              fontStyle: 'bold',
              fill: '#ffffff',
              align: 'center',
              lineHeight: 1.1,
              letterSpacing: 0,
              width: 600,
              curve: 0,
              curveStyle: 'arc',
              skewX: 0,
              skewY: 0,
              strokeEnabled: false,
              stroke: '#000000',
              strokeWidth: 4,
              glowEnabled: false,
              glowColor: '#4f8cff',
              glowBlur: 20,
              chromAmount: 0,
              chromAngle: 0,
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        addShapeLayer: (kind) => {
          record()
          set((s) => {
            const id = makeId('shp')
            const size = Math.min(s.doc.width, s.doc.height) * 0.4
            const layer: ShapeLayer = {
              id,
              type: 'shape',
              name: kind.charAt(0).toUpperCase() + kind.slice(1),
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'source-over',
              x: (s.doc.width - size) / 2,
              y: (s.doc.height - (kind === 'line' ? size * 0.2 : size)) / 2,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              shape: kind,
              width: size,
              height: kind === 'line' ? size * 0.2 : size,
              fillMode: kind === 'line' ? 'solid' : 'solid',
              fill: '#4f8cff',
              gradFrom: '#4f8cff',
              gradTo: '#a24fff',
              gradAngle: 90,
              strokeEnabled: false,
              stroke: '#ffffff',
              strokeWidth: 6,
              cornerRadius: kind === 'rect' ? 0 : 0,
              sides: 6,
              starPoints: 5,
              starInner: 0.5,
              startWidth: 30,
              endWidth: 2,
              lineRound: false,
              glowEnabled: false,
              glowColor: '#4f8cff',
              glowBlur: 40,
              blur: 0,
              chromAmount: 0,
              chromAngle: 0,
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        addFlareLayer: () => {
          record()
          set((s) => {
            const id = makeId('flr')
            const layer: FlareLayer = {
              id,
              type: 'flare',
              name: 'Lens Flare',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'screen',
              x: s.doc.width * 0.28,
              y: s.doc.height * 0.28,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              preset: 'classic',
              size: 1,
              intensity: 1,
              color: '#fff4d6',
              flareRotation: 0,
              streakFalloff: 0.65,
              streakCount: 1,
              streakSpread: 2.0,
              streakOffset: 0.0,
              streakFullWidth: false,
              showGhosts: true,
              overrides: {},
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        addParticleLayer: () => {
          record()
          set((s) => {
            const id = makeId('ptc')
            const layer: ParticleLayer = {
              id,
              type: 'particle',
              name: 'Particles',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'screen',
              x: 0,
              y: 0,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              count: 120,
              size: Math.max(4, Math.round(Math.min(s.doc.width, s.doc.height) * 0.004)),
              sizeVariance: 0.6,
              shape: 'dot',
              colorMode: 'solid',
              color: '#ffffff',
              gradFrom: '#4f8cff',
              gradTo: '#ffd24f',
              glowSize: 3,
              glowColor: '#88bbff',
              glowUseParticleColor: false,
              seed: Math.floor(Math.random() * 1e9),
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        addAdjustLayer: () => {
          record()
          set((s) => {
            const id = makeId('adj')
            const layer: AdjustLayer = {
              id,
              type: 'adjust',
              name: 'Adjustment',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'source-over',
              x: 0,
              y: 0,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              adjustments: { ...DEFAULT_ADJUSTMENTS },
              effects: [],
            }
            return { layers: [...s.layers, layer], selectedId: id }
          })
        },

        removeLayer: (id) => {
          record()
          set((s) => ({
            layers: s.layers.filter((l) => l.id !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
          }))
        },

        duplicateLayer: (id) => {
          record()
          set((s) => {
            const src = s.layers.find((l) => l.id === id)
            if (!src) return s
            const copy = {
              ...src,
              id: makeId(src.type === 'image' ? 'img' : 'txt'),
              name: `${src.name} copy`,
              x: src.x + 40,
              y: src.y + 40,
            } as Layer
            const idx = s.layers.findIndex((l) => l.id === id)
            const next = [...s.layers]
            next.splice(idx + 1, 0, copy)
            return { layers: next, selectedId: copy.id }
          })
        },

        updateLayer: (id, patch) => {
          record(`update:${id}`)
          set((s) => ({
            layers: s.layers.map((l) =>
              l.id === id ? ({ ...l, ...patch } as Layer) : l,
            ),
          }))
        },

        updateAdjustments: (id, patch) => {
          record(`adj:${id}`)
          set((s) => ({
            layers: s.layers.map((l) =>
              l.id === id && (l.type === 'image' || l.type === 'adjust')
                ? { ...l, adjustments: { ...l.adjustments, ...patch } }
                : l,
            ),
          }))
        },

        applyPreset: (layerId, preset) => {
          record()
          set((s) => ({
            layers: s.layers.map((l) => {
              if (l.id !== layerId || (l.type !== 'image' && l.type !== 'adjust')) return l
              const effects: Effect[] = (preset.effects ?? []).map((e) => ({
                id: makeId('fx'),
                type: e.type,
                enabled: true,
                params: { ...defaultParams(e.type), ...(e.params ?? {}) },
              }))
              return {
                ...l,
                adjustments: { ...DEFAULT_ADJUSTMENTS, ...(preset.adjustments ?? {}) },
                effects,
              }
            }),
          }))
        },

        addEffect: (layerId, type) => {
          record()
          set((s) => {
            const effect: Effect = {
              id: makeId('fx'),
              type,
              enabled: true,
              params: defaultParams(type),
            }
            return {
              layers: s.layers.map((l) =>
                l.id === layerId && (l.type === 'image' || l.type === 'adjust')
                  ? { ...l, effects: [...l.effects, effect] }
                  : l,
              ),
            }
          })
        },

        removeEffect: (layerId, effectId) => {
          record()
          set((s) => ({
            layers: s.layers.map((l) =>
              l.id === layerId && (l.type === 'image' || l.type === 'adjust')
                ? { ...l, effects: l.effects.filter((e) => e.id !== effectId) }
                : l,
            ),
          }))
        },

        toggleEffect: (layerId, effectId) => {
          record()
          set((s) => ({
            layers: s.layers.map((l) =>
              l.id === layerId && (l.type === 'image' || l.type === 'adjust')
                ? {
                    ...l,
                    effects: l.effects.map((e) =>
                      e.id === effectId ? { ...e, enabled: !e.enabled } : e,
                    ),
                  }
                : l,
            ),
          }))
        },

        updateEffectParams: (layerId, effectId, patch) => {
          record(`fxp:${layerId}:${effectId}`)
          set((s) => ({
            layers: s.layers.map((l) =>
              l.id === layerId && (l.type === 'image' || l.type === 'adjust')
                ? {
                    ...l,
                    effects: l.effects.map((e) =>
                      e.id === effectId
                        ? { ...e, params: { ...e.params, ...patch } }
                        : e,
                    ),
                  }
                : l,
            ),
          }))
        },

        moveEffect: (layerId, effectId, dir) => {
          record()
          set((s) => ({
            layers: s.layers.map((l) => {
              if (l.id !== layerId || (l.type !== 'image' && l.type !== 'adjust')) return l
              const idx = l.effects.findIndex((e) => e.id === effectId)
              if (idx === -1) return l
              // Effects apply in array order; "up" = applied earlier (lower idx).
              const target = dir === 'up' ? idx - 1 : idx + 1
              if (target < 0 || target >= l.effects.length) return l
              const effects = [...l.effects]
              ;[effects[idx], effects[target]] = [effects[target], effects[idx]]
              return { ...l, effects }
            }),
          }))
        },

        moveLayer: (id, dir) => {
          record()
          set((s) => {
            const idx = s.layers.findIndex((l) => l.id === id)
            if (idx === -1) return s
            const next = [...s.layers]
            const [item] = next.splice(idx, 1)
            if (dir === 'top') next.push(item)
            else if (dir === 'bottom') next.unshift(item)
            else if (dir === 'up') next.splice(Math.min(idx + 1, next.length), 0, item)
            else next.splice(Math.max(idx - 1, 0), 0, item)
            return { layers: next }
          })
        },

        reorderLayer: (fromId, toId) => {
          record()
          set((s) => {
            if (fromId === toId) return s
            const from = s.layers.findIndex((l) => l.id === fromId)
            const to = s.layers.findIndex((l) => l.id === toId)
            if (from === -1 || to === -1) return s
            const next = [...s.layers]
            const [moved] = next.splice(from, 1)
            const insertAt = next.findIndex((l) => l.id === toId)
            next.splice(insertAt, 0, moved)
            return { layers: next }
          })
        },

        setLayerOrder: (orderedIds) => {
          record()
          set((s) => {
            const byId = new Map(s.layers.map((l) => [l.id, l]))
            const next = orderedIds
              .map((id) => byId.get(id))
              .filter((l): l is Layer => l != null)
            // Guard against a mismatched id list silently dropping layers.
            if (next.length !== s.layers.length) return s
            return { layers: next }
          })
        },

        alignLayer: (id, mode) => {
          record()
          set((s) => ({
            layers: s.layers.map((l) => {
              if (l.id !== id) return l
              const box = layerBox(l)
              if (!box) return l
              const patch: Partial<Layer> = {}
              if (mode === 'left') patch.x = 0
              else if (mode === 'hcenter') patch.x = (s.doc.width - box.w) / 2
              else if (mode === 'right') patch.x = s.doc.width - box.w
              else if (mode === 'top') patch.y = 0
              else if (mode === 'vcenter') patch.y = (s.doc.height - box.h) / 2
              else if (mode === 'bottom') patch.y = s.doc.height - box.h
              return { ...l, ...patch } as Layer
            }),
          }))
        },

        loadProject: (data) => {
          lastKey = ''
          set({
            doc: data.doc,
            layers: data.layers.map(normalizeLayer),
            selectedId: null,
            maskEditId: null,
            past: [],
            future: [],
          })
        },

        reset: () => {
          lastKey = ''
          set({ doc: DEFAULT_DOC, layers: [], selectedId: null, maskEditId: null, past: [], future: [] })
        },
      }
    },
    {
      name: 'acc-project-v1',
      version: 2,
      // Object URLs from uploads are not persistable across reloads; only
      // /covers paths survive. We keep everything but uploaded blobs will need
      // re-adding after a hard refresh (documented limitation for Phase 1).
      // History (past/future) is deliberately not persisted.
      partialize: (s) => ({ doc: s.doc, layers: s.layers }),
      migrate: (persisted) => {
        const p = persisted as { doc: CanvasDoc; layers: Layer[] } | undefined
        if (!p) return p
        return { ...p, layers: (p.layers ?? []).map(normalizeLayer) }
      },
    },
  ),
)
