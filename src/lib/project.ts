import type { CanvasDoc, ImageLayer, Layer } from '../types'

export interface ProjectFile {
  app: 'AlbumCoverCreator'
  version: 1
  doc: CanvasDoc
  layers: Layer[]
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(new Error('Could not read image data'))
    fr.readAsDataURL(blob)
  })
}

// Inline uploaded images (in-memory blob: URLs) as base64 data URLs so the
// exported project file is self-contained and survives being reopened later or
// on another machine. Built-in /covers paths and existing data:/http URLs are
// left as-is (they resolve without embedding).
async function embedImages(layers: Layer[]): Promise<Layer[]> {
  return Promise.all(
    layers.map(async (l) => {
      if (l.type !== 'image') return l
      const src = (l as ImageLayer).src
      if (!src.startsWith('blob:')) return l
      try {
        const blob = await fetch(src).then((r) => r.blob())
        return { ...l, src: await blobToDataURL(blob) } as Layer
      } catch {
        return l // upload no longer available; export what we have
      }
    }),
  )
}

export function serializeProject(doc: CanvasDoc, layers: Layer[]): string {
  const file: ProjectFile = { app: 'AlbumCoverCreator', version: 1, doc, layers }
  return JSON.stringify(file, null, 2)
}

export async function downloadProject(doc: CanvasDoc, layers: Layer[]) {
  const embedded = await embedImages(layers)
  const blob = new Blob([serializeProject(doc, embedded)], {
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
