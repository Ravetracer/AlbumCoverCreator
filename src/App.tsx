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
