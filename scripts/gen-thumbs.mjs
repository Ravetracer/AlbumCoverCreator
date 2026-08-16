// Generates small WebP thumbnails + a manifest for the ./covers folder so the
// background picker stays lightweight (the originals are ~7MB each).
// Requires ImageMagick (`convert` / `identify`) on PATH. Run: npm run thumbs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const COVERS = join(ROOT, 'covers')
const OUT_DIR = join(ROOT, 'public', 'covers-thumb')
const MANIFEST = join(ROOT, 'public', 'covers-manifest.json')

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
mkdirSync(OUT_DIR, { recursive: true })

const files = readdirSync(COVERS).filter((f) => IMG_EXT.has(extname(f).toLowerCase()))
const manifest = []

for (const file of files) {
  const src = join(COVERS, file)
  const thumbName = file.replace(/\.[^.]+$/, '.webp')
  const thumbPath = join(OUT_DIR, thumbName)

  const dims = execFileSync('identify', ['-format', '%w %h', src], {
    encoding: 'utf8',
  }).trim().split(/\s+/)
  const [w, h] = dims.map(Number)

  execFileSync('convert', [
    src,
    '-thumbnail', '400x400^',
    '-gravity', 'center',
    '-extent', '400x400',
    '-quality', '78',
    thumbPath,
  ])

  manifest.push({ file, thumb: `/covers-thumb/${thumbName}`, w, h })
  process.stdout.write('.')
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
console.log(`\nGenerated ${manifest.length} thumbnails + manifest.`)
