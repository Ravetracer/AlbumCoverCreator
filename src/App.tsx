import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Toolbar } from './components/Toolbar'
import { LayerPanel } from './components/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { CanvasStage } from './components/CanvasStage'
import { RestoreImagesModal } from './components/RestoreImagesModal'
import { useEditor } from './state/store'

export default function App() {
  const stageRef = useRef<Konva.Stage>(null)
  const [showRestore, setShowRestore] = useState(false)

  // On load, if the restored project references uploaded images (in-memory
  // blob: URLs that don't survive a reload), prompt the user to re-select them.
  useEffect(() => {
    const needsRestore = useEditor
      .getState()
      .layers.some((l) => l.type === 'image' && l.src.startsWith('blob:'))
    if (needsRestore) setShowRestore(true)
  }, [])

  // Editor keyboard shortcuts. Ignored while typing in a form field so text
  // editing keeps its native behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return

      const state = useEditor.getState()
      const ctrl = e.ctrlKey || e.metaKey

      // Undo / redo
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        state.redo()
        return
      }

      const id = state.selectedId
      if (!id) return
      const layer = state.layers.find((l) => l.id === id)

      // Duplicate
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        state.duplicateLayer(id)
        return
      }
      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
        e.preventDefault()
        state.removeLayer(id)
        return
      }
      // Arrow-key nudge (Shift = larger step). Locked layers stay put.
      const nudges: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      }
      const dir = nudges[e.key]
      if (dir && layer && !layer.locked) {
        e.preventDefault()
        const step = e.shiftKey ? 50 : 10
        state.updateLayer(id, { x: layer.x + dir[0] * step, y: layer.y + dir[1] * step })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Toolbar stageRef={stageRef} />
      <div className="workspace">
        <aside className="left">
          <LayerPanel />
        </aside>
        <main className="center">
          <CanvasStage stageRef={stageRef} />
        </main>
        <aside className="right">
          <PropertiesPanel />
        </aside>
      </div>
      {showRestore && <RestoreImagesModal onClose={() => setShowRestore(false)} />}
    </div>
  )
}
