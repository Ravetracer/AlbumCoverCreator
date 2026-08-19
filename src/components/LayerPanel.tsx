import { useState } from 'react'
import { useEditor } from '../state/store'

export function LayerPanel() {
  const layers = useEditor((s) => s.layers)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const updateLayer = useEditor((s) => s.updateLayer)
  const removeLayer = useEditor((s) => s.removeLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const setLayerOrder = useEditor((s) => s.setLayerOrder)

  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // Which edge of the hovered row we'd drop against, in display order.
  const [overPos, setOverPos] = useState<'above' | 'below'>('above')

  // Show top layer first (reverse of stacking order).
  const rows = [...layers].reverse()

  // Commit a drop: rebuild the display order (top→bottom), then hand the store
  // the bottom→top stacking order. Works in either drag direction and lets a
  // layer land at the very top or very bottom of the list.
  const commitDrop = () => {
    if (dragId && overId && dragId !== overId) {
      const displayIds = rows.map((r) => r.id).filter((id) => id !== dragId)
      let insertAt = displayIds.indexOf(overId)
      if (overPos === 'below') insertAt += 1
      displayIds.splice(insertAt, 0, dragId)
      setLayerOrder([...displayIds].reverse())
    }
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="panel">
      <div className="panel-head">Layers</div>
      <div className="layer-list">
        {rows.length === 0 && (
          <div className="empty">No layers yet. Add a background or text.</div>
        )}
        {rows.map((l) => (
          <div
            key={l.id}
            className={`layer-row ${selectedId === l.id ? 'sel' : ''} ${overId === l.id ? `drop-${overPos}` : ''} ${dragId === l.id ? 'dragging' : ''}`}
            draggable
            onClick={() => select(l.id)}
            onDragStart={(e) => {
              setDragId(l.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              // Drop above or below the target depending on which half of the
              // row the pointer is over.
              const rect = e.currentTarget.getBoundingClientRect()
              const pos = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
              if (l.id !== overId) setOverId(l.id)
              if (pos !== overPos) setOverPos(pos)
            }}
            onDrop={(e) => {
              e.preventDefault()
              commitDrop()
            }}
            onDragEnd={() => { setDragId(null); setOverId(null) }}
          >
            <span className="drag-grip" title="Drag to reorder">⠿</span>
            <button
              className="icon-btn"
              title={l.visible ? 'Hide' : 'Show'}
              onClick={(e) => {
                e.stopPropagation()
                updateLayer(l.id, { visible: !l.visible })
              }}
            >
              {l.visible ? '◉' : '○'}
            </button>
            <button
              className="icon-btn"
              title={l.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => {
                e.stopPropagation()
                updateLayer(l.id, { locked: !l.locked })
              }}
            >
              {l.locked ? '🔒' : '🔓'}
            </button>
            <span className="layer-name">{l.name}</span>
            <span className="layer-type">{l.type}</span>
          </div>
        ))}
      </div>
      {selectedId && (
        <div className="layer-actions">
          <button onClick={() => moveLayer(selectedId, 'up')}>↑</button>
          <button onClick={() => moveLayer(selectedId, 'down')}>↓</button>
          <button onClick={() => duplicateLayer(selectedId)}>Dup</button>
          <button className="danger" onClick={() => removeLayer(selectedId)}>
            Del
          </button>
        </div>
      )}
    </div>
  )
}
