import { useRef } from 'react'
import type Konva from 'konva'
import { Toolbar } from './components/Toolbar'
import { LayerPanel } from './components/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { CanvasStage } from './components/CanvasStage'

export default function App() {
  const stageRef = useRef<Konva.Stage>(null)

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
    </div>
  )
}
