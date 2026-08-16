import { useRef, useState } from 'react'
import type Konva from 'konva'
import { useEditor } from '../state/store'
import { exportStage, type ExportFormat } from '../lib/export'
import { downloadProject, parseProject } from '../lib/project'
import { BackgroundPicker } from './BackgroundPicker'

const SIZES = [
  { label: 'Square 2000', w: 2000, h: 2000 },
  { label: 'Square 3000', w: 3000, h: 3000 },
  { label: 'Square 4000 (4K)', w: 4000, h: 4000 },
]

const EXPORT_EDGES = [
  { label: '1000 px', edge: 1000 },
  { label: '2000 px', edge: 2000 },
  { label: '3000 px', edge: 3000 },
  { label: '4000 px (4K)', edge: 4000 },
]

export function Toolbar({
  stageRef,
}: {
  stageRef: React.RefObject<Konva.Stage | null>
}) {
  const doc = useEditor((s) => s.doc)
  const layers = useEditor((s) => s.layers)
  const setDoc = useEditor((s) => s.setDoc)
  const addImageLayer = useEditor((s) => s.addImageLayer)
  const addTextLayer = useEditor((s) => s.addTextLayer)
  const addShapeLayer = useEditor((s) => s.addShapeLayer)
  const addFlareLayer = useEditor((s) => s.addFlareLayer)
  const addParticleLayer = useEditor((s) => s.addParticleLayer)
  const loadProject = useEditor((s) => s.loadProject)
  const reset = useEditor((s) => s.reset)

  const [showBg, setShowBg] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [edge, setEdge] = useState(3000)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<HTMLInputElement>(null)

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      addImageLayer({
        src: url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        name: file.name.replace(/\.[^.]+$/, ''),
      })
    }
    img.src = url
    e.target.value = ''
  }

  const onLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      try {
        loadProject(parseProject(text))
      } catch (err) {
        alert((err as Error).message)
      }
    })
    e.target.value = ''
  }

  const doExport = () => {
    if (!stageRef.current || exporting) return
    setExporting(true)
    // Defer so the button repaints as "Exporting…" before the (heavy,
    // synchronous) full-resolution render blocks the main thread.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          exportStage(stageRef.current!, doc, { format, targetLongEdge: edge })
        } finally {
          setExporting(false)
        }
      })
    })
  }

  return (
    <div className="toolbar">
      <span className="brand">AlbumCoverCreator</span>

      <div className="tb-group">
        <button onClick={() => setShowBg(true)}>Background</button>
        <button onClick={() => uploadRef.current?.click()}>Upload Image</button>
        <button onClick={addTextLayer}>Add Text</button>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addShapeLayer(e.target.value as never)
            e.target.value = ''
          }}
        >
          <option value="">+ Shape…</option>
          <option value="rect">Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="triangle">Triangle</option>
          <option value="polygon">Polygon</option>
          <option value="star">Star</option>
          <option value="line">Line</option>
        </select>
        <button onClick={addFlareLayer}>Flare</button>
        <button onClick={addParticleLayer}>Particles</button>
      </div>

      <div className="tb-group">
        <label>Canvas</label>
        <select
          value={`${doc.width}x${doc.height}`}
          onChange={(e) => {
            const s = SIZES.find((x) => `${x.w}x${x.h}` === e.target.value)
            if (s) setDoc({ width: s.w, height: s.h })
          }}
        >
          {SIZES.map((s) => (
            <option key={s.label} value={`${s.w}x${s.h}`}>{s.label}</option>
          ))}
        </select>
        <input
          type="color"
          title="Backdrop color"
          value={doc.background}
          onChange={(e) => setDoc({ background: e.target.value })}
        />
      </div>

      <div className="tb-group right">
        <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="png">PNG</option>
          <option value="jpeg">JPG</option>
        </select>
        <select value={edge} onChange={(e) => setEdge(parseInt(e.target.value))}>
          {EXPORT_EDGES.map((x) => (
            <option key={x.edge} value={x.edge}>{x.label}</option>
          ))}
        </select>
        <button className="primary" onClick={doExport} disabled={layers.length === 0 || exporting}>
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      <div className="tb-group">
        <button
          disabled={saving}
          onClick={async () => {
            if (saving) return
            setSaving(true)
            try {
              await downloadProject(doc, layers)
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => projectRef.current?.click()}>Open</button>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Clear the current project?')) reset()
          }}
        >
          New
        </button>
      </div>

      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onUpload} />
      <input ref={projectRef} type="file" accept="application/json,.json" hidden onChange={onLoadProject} />

      {showBg && <BackgroundPicker onClose={() => setShowBg(false)} />}
    </div>
  )
}
