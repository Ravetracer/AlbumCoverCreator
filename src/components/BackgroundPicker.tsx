import { useEffect, useState } from 'react'
import { useEditor } from '../state/store'

interface CoverEntry {
  file: string
  thumb: string
  w: number
  h: number
}

export function BackgroundPicker({ onClose }: { onClose: () => void }) {
  const [covers, setCovers] = useState<CoverEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const addImageLayer = useEditor((s) => s.addImageLayer)

  useEffect(() => {
    fetch('/covers-manifest.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no manifest'))))
      .then(setCovers)
      .catch(() =>
        setError('No cover manifest found. Run `npm run thumbs` to generate it.'),
      )
  }, [])

  const pick = (c: CoverEntry) => {
    addImageLayer({
      src: `/covers/${c.file}`,
      naturalWidth: c.w,
      naturalHeight: c.h,
      name: c.file.replace(/\.[^.]+$/, ''),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>Choose a background</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div className="empty">{error}</div>}
        <div className="cover-grid">
          {covers.map((c) => (
            <button key={c.file} className="cover-cell" onClick={() => pick(c)}>
              <img src={c.thumb} alt={c.file} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
