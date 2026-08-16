import { useRef, useState } from 'react'
import { useEditor } from '../state/store'
import type { ImageLayer } from '../types'

// Uploaded images live as in-memory blob: URLs that don't survive a page
// reload, so a project restored from localStorage references images the browser
// can no longer load. This modal lists those layers and lets the user re-select
// the original files from disk to restore them. (Built-in /covers backgrounds
// and embedded data: URLs load fine and are never listed.)
function isMissing(l: { type: string; src?: string }): boolean {
  return l.type === 'image' && !!l.src && l.src.startsWith('blob:')
}

export function RestoreImagesModal({ onClose }: { onClose: () => void }) {
  const updateLayer = useEditor((s) => s.updateLayer)

  // Capture the layers needing restore once, so each row stays visible (with a
  // check mark once done) instead of disappearing mid-flow.
  const [targets] = useState(() =>
    (useEditor.getState().layers.filter(isMissing) as ImageLayer[]).map((l) => ({
      id: l.id,
      name: l.name,
    })),
  )

  // Track which layers the user has restored this session. (A re-selected file
  // becomes a new blob: URL too, so "is it still a blob" can't tell us — we mark
  // a layer done once its replacement image has actually loaded.)
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const restoredCount = targets.filter((t) => done.has(t.id)).length
  const allDone = targets.length > 0 && restoredCount === targets.length

  const restore = (id: string, file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      updateLayer(id, { src: url, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
      setDone((prev) => new Set(prev).add(id))
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  // Bulk: match selected files to not-yet-restored layers by name (filename
  // without extension, case-insensitive).
  const onBulk = (files: FileList) => {
    const byName = new Map<string, File>()
    for (const f of Array.from(files)) {
      byName.set(f.name.replace(/\.[^.]+$/, '').toLowerCase(), f)
    }
    for (const t of targets) {
      if (done.has(t.id)) continue
      const f = byName.get(t.name.toLowerCase())
      if (f) restore(t.id, f)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal restore-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>Restore project images</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <p className="empty" style={{ padding: '12px 16px 4px' }}>
          Your project was restored from this browser, but uploaded images can't be
          reloaded automatically. Re-select the original files below to restore them.
          Built-in backgrounds are already loaded. Tip: use <em>Save</em> to export a
          self-contained project file that keeps its images.
        </p>

        <div className="restore-bulk">
          <BulkPicker onPick={onBulk} />
          <span className="muted">{restoredCount} / {targets.length} restored</span>
        </div>

        <div className="restore-list">
          {targets.map((t) => (
            <RestoreRow
              key={t.id}
              name={t.name}
              restored={done.has(t.id)}
              onPick={(f) => restore(t.id, f)}
            />
          ))}
        </div>

        <div className="restore-actions">
          <button className={allDone ? 'primary' : ''} onClick={onClose}>
            {allDone ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestoreRow({
  name,
  restored,
  onPick,
}: {
  name: string
  restored: boolean
  onPick: (file: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className={`restore-row${restored ? ' done' : ''}`}>
      <span className="restore-status">{restored ? '✓' : '○'}</span>
      <span className="restore-name" title={name}>{name}</span>
      <button onClick={() => ref.current?.click()}>
        {restored ? 'Replace…' : 'Choose file…'}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function BulkPicker({ onPick }: { onPick: (files: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button onClick={() => ref.current?.click()}>Select image files…</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}
