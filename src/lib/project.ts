import type { CanvasDoc, Layer } from '../types'

export interface ProjectFile {
  app: 'AlbumCoverCreator'
  version: 1
  doc: CanvasDoc
  layers: Layer[]
}

export function serializeProject(doc: CanvasDoc, layers: Layer[]): string {
  const file: ProjectFile = { app: 'AlbumCoverCreator', version: 1, doc, layers }
  return JSON.stringify(file, null, 2)
}

export function downloadProject(doc: CanvasDoc, layers: Layer[]) {
  const blob = new Blob([serializeProject(doc, layers)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'album-cover-project.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function parseProject(text: string): { doc: CanvasDoc; layers: Layer[] } {
  const data = JSON.parse(text) as Partial<ProjectFile>
  if (data.app !== 'AlbumCoverCreator' || !data.doc || !data.layers) {
    throw new Error('Not a valid AlbumCoverCreator project file.')
  }
  return { doc: data.doc, layers: data.layers }
}
