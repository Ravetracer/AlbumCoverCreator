import { useEditor } from '../state/store'
import {
  BLEND_MODES, type Effect, type FlareLayer, type ImageLayer,
  type ParticleLayer, type ShapeLayer, type TextLayer,
} from '../types'
import { useEffect, useRef, useState } from 'react'
import { EFFECT_DEFS, EFFECT_DEF_BY_TYPE, type ParamSpec } from '../effects/registry'
import { FLARE_PRESET_OPTIONS, getFlareElements } from '../effects/flare'
import { FONTS, onFontsChanged, registerCustomFont } from '../fonts/fonts'

function Slider({
  label,
  value,
  min,
  max,
  step,
  def,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  def?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="ctrl">
      <span className="ctrl-label">
        {label}
        <em>{Math.round(value * 100) / 100}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        title={def !== undefined ? 'Double-click to reset' : undefined}
        onDoubleClick={() => { if (def !== undefined) onChange(def) }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

// Colour + alpha control. Stores an 8-digit hex (#rrggbbaa) so colours can fade
// to transparency (gradients, line fills, glows). Legacy 6-digit values read as
// fully opaque.
function splitHex(v: string): { hex6: string; alpha: number } {
  if (typeof v !== 'string' || v[0] !== '#') return { hex6: '#000000', alpha: 1 }
  const hex6 = v.slice(0, 7)
  const alpha = v.length >= 9 ? parseInt(v.slice(7, 9), 16) / 255 : 1
  return { hex6, alpha }
}
function joinHex(hex6: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return `${hex6}${a.toString(16).padStart(2, '0')}`
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { hex6, alpha } = splitHex(value)
  return (
    <div className="ctrl">
      <span className="ctrl-label">
        {label}
        <em>{Math.round(alpha * 100)}%</em>
      </span>
      <div className="color-row">
        <input type="color" value={hex6} onChange={(e) => onChange(joinHex(e.target.value, alpha))} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          title="Opacity — drag to 0 for transparent"
          onChange={(e) => onChange(joinHex(hex6, parseFloat(e.target.value)))}
        />
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section">
      <button className="section-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}

export function PropertiesPanel() {
  const layer = useEditor((s) => s.layers.find((l) => l.id === s.selectedId))
  const updateLayer = useEditor((s) => s.updateLayer)
  const updateAdjustments = useEditor((s) => s.updateAdjustments)

  if (!layer) {
    return (
      <div className="panel">
        <div className="panel-head">Properties</div>
        <div className="empty">Select a layer to edit its properties.</div>
      </div>
    )
  }

  return (
    <div className="panel scroll">
      <div className="panel-head">Properties</div>

      <label className="ctrl">
        <span className="ctrl-label">Name</span>
        <input
          type="text"
          value={layer.name}
          onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
        />
      </label>

      <Slider
        label="Opacity"
        value={layer.opacity}
        min={0}
        max={1}
        step={0.01}
        def={1}
        onChange={(v) => updateLayer(layer.id, { opacity: v })}
      />
      <Slider
        label="Rotation"
        value={layer.rotation}
        min={-180}
        max={180}
        step={1}
        def={0}
        onChange={(v) => updateLayer(layer.id, { rotation: v })}
      />

      <AlignControls layer={layer} />

      <label className="ctrl">
        <span className="ctrl-label">Blend Mode</span>
        <select
          value={layer.blendMode}
          onChange={(e) =>
            updateLayer(layer.id, { blendMode: e.target.value as never })
          }
        >
          {BLEND_MODES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      {layer.type === 'image' && (
        <>
          <ImageControls layer={layer} onAdjust={updateAdjustments} onChange={updateLayer} />
          <EffectsSection layer={layer} />
        </>
      )}
      {layer.type === 'text' && (
        <TextControls layer={layer} onChange={updateLayer} />
      )}
      {layer.type === 'shape' && (
        <ShapeControls layer={layer} onChange={updateLayer} />
      )}
      {layer.type === 'flare' && (
        <FlareControls layer={layer} onChange={updateLayer} />
      )}
      {layer.type === 'particle' && (
        <ParticleControls layer={layer} onChange={updateLayer} />
      )}
    </div>
  )
}

function AlignControls({ layer }: { layer: { id: string; type: string } }) {
  const alignLayer = useEditor((s) => s.alignLayer)
  // Flares (light source point) and particles (scatter offset) have no box.
  if (layer.type === 'flare' || layer.type === 'particle') return null
  const b = (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom', label: string, title: string) => (
    <button className="align-btn" title={title} onClick={() => alignLayer(layer.id, mode)}>{label}</button>
  )
  return (
    <Section title="Align to Canvas" defaultOpen={false}>
      <div className="align-grid">
        {b('left', '⇤', 'Left edge')}
        {b('hcenter', '↔', 'Center horizontally')}
        {b('right', '⇥', 'Right edge')}
        {b('top', '⤒', 'Top edge')}
        {b('vcenter', '↕', 'Center vertically')}
        {b('bottom', '⤓', 'Bottom edge')}
      </div>
    </Section>
  )
}

function ImageControls({
  layer,
  onAdjust,
  onChange,
}: {
  layer: ImageLayer
  onAdjust: (id: string, patch: Partial<ImageLayer['adjustments']>) => void
  onChange: (id: string, patch: Partial<ImageLayer>) => void
}) {
  const a = layer.adjustments
  const set = (patch: Partial<ImageLayer['adjustments']>) =>
    onAdjust(layer.id, patch)
  return (
    <>
      <Section title="Adjustments">
        <Slider label="Brightness" value={a.brightness} min={-1} max={1} step={0.01} def={0} onChange={(v) => set({ brightness: v })} />
        <Slider label="Contrast" value={a.contrast} min={-100} max={100} step={1} def={0} onChange={(v) => set({ contrast: v })} />
        <Slider label="Saturation" value={a.saturation} min={-2} max={10} step={0.05} def={0} onChange={(v) => set({ saturation: v })} />
        <Slider label="Hue" value={a.hue} min={0} max={360} step={1} def={0} onChange={(v) => set({ hue: v })} />
        <Slider label="Luminance" value={a.luminance} min={-1} max={1} step={0.01} def={0} onChange={(v) => set({ luminance: v })} />
        <Slider label="Blur" value={a.blur} min={0} max={100} step={1} def={0} onChange={(v) => set({ blur: v })} />
        <label className="ctrl inline">
          <input type="checkbox" checked={a.grayscale >= 0.5} onChange={(e) => set({ grayscale: e.target.checked ? 1 : 0 })} />
          <span>Grayscale</span>
        </label>
        <label className="ctrl inline">
          <input type="checkbox" checked={a.sepia >= 0.5} onChange={(e) => set({ sepia: e.target.checked ? 1 : 0 })} />
          <span>Sepia</span>
        </label>
      </Section>

      <Section title="Tone" defaultOpen={false}>
        <Slider label="Highlights" value={a.highlights} min={-100} max={100} step={1} def={0} onChange={(v) => set({ highlights: v })} />
        <Slider label="Shadows" value={a.shadows} min={-100} max={100} step={1} def={0} onChange={(v) => set({ shadows: v })} />
        <Slider label="Whites" value={a.whites} min={-100} max={100} step={1} def={0} onChange={(v) => set({ whites: v })} />
        <Slider label="Blacks" value={a.blacks} min={-100} max={100} step={1} def={0} onChange={(v) => set({ blacks: v })} />
        <Slider label="Vibrance" value={a.vibrance} min={-100} max={100} step={1} def={0} onChange={(v) => set({ vibrance: v })} />
        <Slider label="Dehaze" value={a.dehaze} min={0} max={100} step={1} def={0} onChange={(v) => set({ dehaze: v })} />
      </Section>

      <Section title="Detail" defaultOpen={false}>
        <Slider label="Sharpness" value={a.sharpness} min={0} max={100} step={1} def={0} onChange={(v) => set({ sharpness: v })} />
        <Slider label="Clarity" value={a.clarity} min={-100} max={100} step={1} def={0} onChange={(v) => set({ clarity: v })} />
        <Slider label="Structure" value={a.structure} min={0} max={100} step={1} def={0} onChange={(v) => set({ structure: v })} />
      </Section>

      <Section title="Crop" defaultOpen={false}>
        <Slider label="Top" value={layer.cropTop} min={0} max={0.45} step={0.01} def={0} onChange={(v) => onChange(layer.id, { cropTop: v })} />
        <Slider label="Right" value={layer.cropRight} min={0} max={0.45} step={0.01} def={0} onChange={(v) => onChange(layer.id, { cropRight: v })} />
        <Slider label="Bottom" value={layer.cropBottom} min={0} max={0.45} step={0.01} def={0} onChange={(v) => onChange(layer.id, { cropBottom: v })} />
        <Slider label="Left" value={layer.cropLeft} min={0} max={0.45} step={0.01} def={0} onChange={(v) => onChange(layer.id, { cropLeft: v })} />
      </Section>
    </>
  )
}

function FontPicker({ layer, set }: { layer: TextLayer; set: (patch: Partial<TextLayer>) => void }) {
  const [, force] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => onFontsChanged(() => force((n) => n + 1)), [])

  // Group fonts by category for optgroups.
  const groups = FONTS.reduce<Record<string, typeof FONTS>>((acc, f) => {
    ;(acc[f.cat] ||= []).push(f)
    return acc
  }, {})

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) registerCustomFont(file).then((family) => set({ fontFamily: family }))
    e.target.value = ''
  }

  return (
    <>
      <label className="ctrl">
        <span className="ctrl-label">Font</span>
        <select value={layer.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
          {Object.entries(groups).map(([cat, fonts]) => (
            <optgroup key={cat} label={cat}>
              {fonts.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="ctrl">
        <button onClick={() => fileRef.current?.click()}>Upload font (TTF/OTF)…</button>
        <input ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden onChange={onUpload} />
      </div>
    </>
  )
}

function TextControls({
  layer,
  onChange,
}: {
  layer: TextLayer
  onChange: (id: string, patch: Partial<TextLayer>) => void
}) {
  const set = (patch: Partial<TextLayer>) => onChange(layer.id, patch)
  return (
    <>
      <Section title="Text">
        <label className="ctrl">
          <span className="ctrl-label">Content</span>
          <textarea
            rows={2}
            value={layer.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        </label>
        <FontPicker layer={layer} set={set} />
        <Slider label="Font Size" value={layer.fontSize} min={8} max={600} step={1} def={120} onChange={(v) => set({ fontSize: v })} />
        <label className="ctrl">
          <span className="ctrl-label">Style</span>
          <select value={layer.fontStyle} onChange={(e) => set({ fontStyle: e.target.value })}>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="italic">Italic</option>
            <option value="italic bold">Bold Italic</option>
          </select>
        </label>
        <label className="ctrl">
          <span className="ctrl-label">Align</span>
          <select value={layer.align} onChange={(e) => set({ align: e.target.value as never })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <ColorField label="Color" value={layer.fill} onChange={(v) => set({ fill: v })} />
        <Slider label="Letter Spacing" value={layer.letterSpacing} min={-20} max={80} step={1} def={0} onChange={(v) => set({ letterSpacing: v })} />
        <Slider label="Line Height" value={layer.lineHeight} min={0.7} max={3} step={0.05} def={1.1} onChange={(v) => set({ lineHeight: v })} />
      </Section>

      <Section title="Stroke" defaultOpen={false}>
        <Toggle label="Enable Stroke" checked={layer.strokeEnabled} onChange={(v) => set({ strokeEnabled: v })} />
        {layer.strokeEnabled && (
          <>
            <ColorField label="Stroke Color" value={layer.stroke} onChange={(v) => set({ stroke: v })} />
            <Slider label="Stroke Width" value={layer.strokeWidth} min={0} max={60} step={0.5} def={4} onChange={(v) => set({ strokeWidth: v })} />
          </>
        )}
      </Section>

      <Section title="Glow / Bloom" defaultOpen={false}>
        <Toggle label="Enable Glow" checked={layer.glowEnabled} onChange={(v) => set({ glowEnabled: v })} />
        {layer.glowEnabled && (
          <>
            <ColorField label="Glow Color" value={layer.glowColor} onChange={(v) => set({ glowColor: v })} />
            <Slider label="Glow Blur" value={layer.glowBlur} min={0} max={200} step={1} def={20} onChange={(v) => set({ glowBlur: v })} />
          </>
        )}
      </Section>

      <Section title="Chromatic Aberration" defaultOpen={false}>
        <Slider label="Amount" value={layer.chromAmount} min={0} max={40} step={0.5} def={0} onChange={(v) => set({ chromAmount: v })} />
        <Slider label="Angle" value={layer.chromAngle} min={0} max={360} step={1} def={0} onChange={(v) => set({ chromAngle: v })} />
      </Section>

      <Section title="Shape & Perspective" defaultOpen={false}>
        <Slider label="Curve" value={layer.curve} min={-100} max={100} step={1} def={0} onChange={(v) => set({ curve: v })} />
        <Slider label="Tilt X" value={layer.skewX} min={-1} max={1} step={0.02} def={0} onChange={(v) => set({ skewX: v })} />
        <Slider label="Tilt Y" value={layer.skewY} min={-1} max={1} step={0.02} def={0} onChange={(v) => set({ skewY: v })} />
      </Section>
    </>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <ColorField label={label} value={value} onChange={onChange} />
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ctrl inline">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function ShapeControls({ layer, onChange }: { layer: ShapeLayer; onChange: (id: string, patch: Partial<ShapeLayer>) => void }) {
  const set = (patch: Partial<ShapeLayer>) => onChange(layer.id, patch)
  const hasShapeProps = ['rect', 'polygon', 'star', 'line'].includes(layer.shape)
  return (
    <>
      <Section title="Fill">
        <label className="ctrl">
          <span className="ctrl-label">Fill Mode</span>
          <select value={layer.fillMode} onChange={(e) => set({ fillMode: e.target.value as never })}>
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="linear">Linear Gradient</option>
            <option value="radial">Radial Gradient</option>
          </select>
        </label>
        {layer.fillMode === 'solid' && (
          <ColorRow label="Color" value={layer.fill} onChange={(v) => set({ fill: v })} />
        )}
        {(layer.fillMode === 'linear' || layer.fillMode === 'radial') && (
          <>
            <ColorRow label="Gradient From" value={layer.gradFrom} onChange={(v) => set({ gradFrom: v })} />
            <ColorRow label="Gradient To" value={layer.gradTo} onChange={(v) => set({ gradTo: v })} />
            {layer.fillMode === 'linear' && (
              <Slider label="Angle" value={layer.gradAngle} min={0} max={360} step={1} def={90} onChange={(v) => set({ gradAngle: v })} />
            )}
          </>
        )}
      </Section>

      {hasShapeProps && (
        <Section title="Shape">
          {layer.shape === 'rect' && (
            <Slider label="Corner Radius" value={layer.cornerRadius} min={0} max={400} step={1} def={0} onChange={(v) => set({ cornerRadius: v })} />
          )}
          {layer.shape === 'polygon' && (
            <Slider label="Sides" value={layer.sides} min={3} max={12} step={1} def={6} onChange={(v) => set({ sides: v })} />
          )}
          {layer.shape === 'star' && (
            <>
              <Slider label="Points" value={layer.starPoints} min={3} max={12} step={1} def={5} onChange={(v) => set({ starPoints: v })} />
              <Slider label="Inner Ratio" value={layer.starInner} min={0.1} max={0.9} step={0.05} def={0.5} onChange={(v) => set({ starInner: v })} />
            </>
          )}
          {layer.shape === 'line' && (
            <>
              <Slider label="Start Width" value={layer.startWidth} min={1} max={300} step={1} def={30} onChange={(v) => set({ startWidth: v })} />
              <Slider label="End Width" value={layer.endWidth} min={1} max={300} step={1} def={2} onChange={(v) => set({ endWidth: v })} />
            </>
          )}
        </Section>
      )}

      <Section title="Stroke" defaultOpen={false}>
        <Toggle label="Enable Stroke" checked={layer.strokeEnabled} onChange={(v) => set({ strokeEnabled: v })} />
        {layer.strokeEnabled && (
          <>
            <ColorRow label="Stroke Color" value={layer.stroke} onChange={(v) => set({ stroke: v })} />
            <Slider label="Stroke Width" value={layer.strokeWidth} min={1} max={100} step={1} def={6} onChange={(v) => set({ strokeWidth: v })} />
          </>
        )}
      </Section>

      <Section title="Glow" defaultOpen={false}>
        <Toggle label="Enable Glow" checked={layer.glowEnabled} onChange={(v) => set({ glowEnabled: v })} />
        {layer.glowEnabled && (
          <>
            <ColorRow label="Glow Color" value={layer.glowColor} onChange={(v) => set({ glowColor: v })} />
            <Slider label="Glow Blur" value={layer.glowBlur} min={0} max={200} step={1} def={40} onChange={(v) => set({ glowBlur: v })} />
          </>
        )}
      </Section>

      <Section title="Blur" defaultOpen={false}>
        <Slider label="Softness" value={layer.blur} min={0} max={80} step={1} def={0} onChange={(v) => set({ blur: v })} />
      </Section>

      <Section title="Chromatic Aberration" defaultOpen={false}>
        <Slider label="Amount" value={layer.chromAmount} min={0} max={40} step={0.5} def={0} onChange={(v) => set({ chromAmount: v })} />
        <Slider label="Angle" value={layer.chromAngle} min={0} max={360} step={1} def={0} onChange={(v) => set({ chromAngle: v })} />
      </Section>
    </>
  )
}

function FlareControls({ layer, onChange }: { layer: FlareLayer; onChange: (id: string, patch: Partial<FlareLayer>) => void }) {
  const set = (patch: Partial<FlareLayer>) => onChange(layer.id, patch)
  return (
    <>
      <Section title="Lens Flare">
        <div className="empty" style={{ padding: '2px 4px' }}>Drag the flare on the canvas to move the light source.</div>
        <label className="ctrl">
          <span className="ctrl-label">Preset</span>
          <select value={layer.preset} onChange={(e) => set({ preset: e.target.value as never })}>
            {FLARE_PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <Slider label="Size" value={layer.size} min={0.1} max={4} step={0.05} def={1} onChange={(v) => set({ size: v })} />
        <Slider label="Intensity" value={layer.intensity} min={0} max={2} step={0.05} def={1} onChange={(v) => set({ intensity: v })} />
        <ColorRow label="Tint" value={layer.color} onChange={(v) => set({ color: v })} />
        <Slider label="Rotation" value={layer.flareRotation} min={-180} max={180} step={1} def={0} onChange={(v) => set({ flareRotation: v })} />
        <Toggle label="Show ghosts (bokeh / rings)" checked={layer.showGhosts} onChange={(v) => set({ showGhosts: v })} />
      </Section>

      <Section title="Streak" defaultOpen={false}>
        <Slider label="Falloff" value={layer.streakFalloff} min={0} max={1} step={0.02} def={0.65} onChange={(v) => set({ streakFalloff: v })} />
        <Slider label="Count" value={layer.streakCount} min={1} max={5} step={1} def={1} onChange={(v) => set({ streakCount: Math.round(v) })} />
        <Slider label="Spread" value={layer.streakSpread} min={0.5} max={5} step={0.1} def={2} onChange={(v) => set({ streakSpread: v })} />
        <Slider label="H-Offset" value={layer.streakOffset} min={-0.5} max={0.5} step={0.02} def={0} onChange={(v) => set({ streakOffset: v })} />
        <Toggle label="Full Width" checked={layer.streakFullWidth} onChange={(v) => set({ streakFullWidth: v })} />
      </Section>

      <FlareElementControls layer={layer} onChange={onChange} />
    </>
  )
}

function FlareElementControls({ layer, onChange }: { layer: FlareLayer; onChange: (id: string, patch: Partial<FlareLayer>) => void }) {
  const elements = getFlareElements(layer.preset, layer.color)
  const setOverride = (idx: number, patch: { scale?: number; opacity?: number; color?: string }) => {
    const overrides = { ...layer.overrides, [idx]: { ...layer.overrides[idx], ...patch } }
    onChange(layer.id, { overrides })
  }
  return (
    <Section title="Elements" defaultOpen={false}>
      {elements.map((el) => {
        const ov = layer.overrides[el.index] ?? {}
        return (
          <CollapsibleCard key={el.index} title={el.label} defaultOpen={false}>
            <Slider label="Scale" value={ov.scale ?? 1} min={0} max={3} step={0.05} def={1} onChange={(v) => setOverride(el.index, { scale: v })} />
            <Slider label="Opacity" value={ov.opacity ?? 1} min={0} max={1} step={0.05} def={1} onChange={(v) => setOverride(el.index, { opacity: v })} />
            <ColorRow label="Color" value={ov.color ?? el.defaultColor} onChange={(v) => setOverride(el.index, { color: v })} />
          </CollapsibleCard>
        )
      })}
    </Section>
  )
}

// A collapsible card (header toggles the body) used for flare elements.
function CollapsibleCard({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="fx-card">
      <button className="fx-head fx-head-btn" onClick={() => setOpen((o) => !o)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <span className="fx-name">{title}</span>
      </button>
      {open && <div className="fx-body">{children}</div>}
    </div>
  )
}

function ParticleControls({ layer, onChange }: { layer: ParticleLayer; onChange: (id: string, patch: Partial<ParticleLayer>) => void }) {
  const set = (patch: Partial<ParticleLayer>) => onChange(layer.id, patch)
  return (
    <>
      <Section title="Particles">
        <Slider label="Count" value={layer.count} min={1} max={1000} step={1} def={120} onChange={(v) => set({ count: Math.round(v) })} />
        <Slider label="Size" value={layer.size} min={1} max={80} step={1} onChange={(v) => set({ size: v })} />
        <Slider label="Size Variance" value={layer.sizeVariance} min={0} max={1} step={0.05} def={0.6} onChange={(v) => set({ sizeVariance: v })} />
        <label className="ctrl">
          <span className="ctrl-label">Shape</span>
          <select value={layer.shape} onChange={(e) => set({ shape: e.target.value as never })}>
            <option value="dot">Dot</option>
            <option value="star">Star</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label className="ctrl">
          <span className="ctrl-label">Color Mode</span>
          <select value={layer.colorMode} onChange={(e) => set({ colorMode: e.target.value as never })}>
            <option value="solid">Solid</option>
            <option value="hue">Random Hue</option>
            <option value="gradient">Gradient</option>
          </select>
        </label>
        {layer.colorMode === 'solid' && (
          <ColorRow label="Color" value={layer.color} onChange={(v) => set({ color: v })} />
        )}
        {layer.colorMode === 'gradient' && (
          <>
            <ColorRow label="From" value={layer.gradFrom} onChange={(v) => set({ gradFrom: v })} />
            <ColorRow label="To" value={layer.gradTo} onChange={(v) => set({ gradTo: v })} />
          </>
        )}
        <div className="ctrl">
          <button onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>Reshuffle</button>
        </div>
      </Section>

      <Section title="Glow">
        <Slider label="Glow Size" value={layer.glowSize} min={0} max={10} step={0.1} def={3} onChange={(v) => set({ glowSize: v })} />
        <Toggle label="Use particle color" checked={layer.glowUseParticleColor} onChange={(v) => set({ glowUseParticleColor: v })} />
        {!layer.glowUseParticleColor && (
          <ColorRow label="Glow Color" value={layer.glowColor} onChange={(v) => set({ glowColor: v })} />
        )}
      </Section>
    </>
  )
}

function EffectsSection({ layer }: { layer: ImageLayer }) {
  const addEffect = useEditor((s) => s.addEffect)
  const removeEffect = useEditor((s) => s.removeEffect)
  const toggleEffect = useEditor((s) => s.toggleEffect)
  const moveEffect = useEditor((s) => s.moveEffect)
  const updateEffectParams = useEditor((s) => s.updateEffectParams)

  return (
    <Section title="Effects">
      <div className="ctrl">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addEffect(layer.id, e.target.value as never)
            e.target.value = ''
          }}
        >
          <option value="">+ Add effect…</option>
          {EFFECT_DEFS.map((d) => (
            <option key={d.type} value={d.type}>{d.label}</option>
          ))}
        </select>
      </div>

      {layer.effects.length === 0 && (
        <div className="empty">No effects. Add one above to get creative.</div>
      )}

      {layer.effects.map((effect) => (
        <EffectCard
          key={effect.id}
          layerId={layer.id}
          effect={effect}
          onToggle={() => toggleEffect(layer.id, effect.id)}
          onRemove={() => removeEffect(layer.id, effect.id)}
          onMove={(dir) => moveEffect(layer.id, effect.id, dir)}
          onParam={(patch) => updateEffectParams(layer.id, effect.id, patch)}
        />
      ))}
    </Section>
  )
}

function EffectCard({
  effect,
  onToggle,
  onRemove,
  onMove,
  onParam,
}: {
  layerId: string
  effect: Effect
  onToggle: () => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
  onParam: (patch: Record<string, number | string | boolean>) => void
}) {
  const def = EFFECT_DEF_BY_TYPE[effect.type]
  const [open, setOpen] = useState(true)
  return (
    <div className={`fx-card ${effect.enabled ? '' : 'off'}`}>
      <div className="fx-head">
        <button className="icon-btn" title="Toggle enabled" onClick={onToggle}>
          {effect.enabled ? '◉' : '○'}
        </button>
        <button className="fx-name fx-name-btn" onClick={() => setOpen((o) => !o)} title="Collapse / expand">
          <span className="chev">{open ? '▾' : '▸'}</span> {def.label}
        </button>
        <button className="icon-btn" title="Move up" onClick={() => onMove('up')}>↑</button>
        <button className="icon-btn" title="Move down" onClick={() => onMove('down')}>↓</button>
        <button className="icon-btn danger" title="Remove" onClick={onRemove}>✕</button>
      </div>
      {open && (
        <div className="fx-body">
          {def.params.map((spec) => (
            <ParamControl
              key={spec.key}
              spec={spec}
              value={effect.params[spec.key]}
              onChange={(v) => onParam({ [spec.key]: v })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec
  value: number | string | boolean | undefined
  onChange: (v: number | string | boolean) => void
}) {
  switch (spec.kind) {
    case 'range':
      return (
        <Slider
          label={spec.label}
          value={typeof value === 'number' ? value : spec.default}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          def={spec.default}
          onChange={onChange}
        />
      )
    case 'color':
      return (
        <ColorField
          label={spec.label}
          value={typeof value === 'string' ? value : spec.default}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <label className="ctrl">
          <span className="ctrl-label">{spec.label}</span>
          <select
            value={typeof value === 'string' ? value : spec.default}
            onChange={(e) => onChange(e.target.value)}
          >
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      )
    case 'toggle':
      return (
        <label className="ctrl inline">
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : spec.default}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{spec.label}</span>
        </label>
      )
  }
}
