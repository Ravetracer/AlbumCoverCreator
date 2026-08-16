// Curated display fonts (ported from the LogoForge project) loaded from the
// Google Fonts CSS API for live preview, plus user-uploaded custom fonts via
// the FontFace API. Konva renders text to canvas using whatever fonts the
// browser has loaded, so PNG/JPG export just works once a font is ready.

export interface FontDef {
  name: string // display name
  family: string // canvas font-family value
  cat: string // category (for optgroup)
  param: string | null // Google Fonts css2 param, or null for system/custom
  custom?: boolean
}

export const FONTS: FontDef[] = [
  // Fantasy / medieval
  { name: 'Cinzel', family: 'Cinzel', cat: 'Fantasy', param: 'Cinzel:wght@400;700;900' },
  { name: 'Cinzel Decorative', family: 'Cinzel Decorative', cat: 'Fantasy', param: 'Cinzel+Decorative:wght@400;700;900' },
  { name: 'MedievalSharp', family: 'MedievalSharp', cat: 'Fantasy', param: 'MedievalSharp' },
  { name: 'Metamorphous', family: 'Metamorphous', cat: 'Fantasy', param: 'Metamorphous' },
  { name: 'Pirata One', family: 'Pirata One', cat: 'Fantasy', param: 'Pirata+One' },
  { name: 'UnifrakturCook', family: 'UnifrakturCook', cat: 'Fantasy', param: 'UnifrakturCook:wght@700' },
  { name: 'Grenze Gotisch', family: 'Grenze Gotisch', cat: 'Fantasy', param: 'Grenze+Gotisch:wght@400;700;900' },
  // Sci-Fi / tech
  { name: 'Orbitron', family: 'Orbitron', cat: 'Sci-Fi', param: 'Orbitron:wght@400;700;900' },
  { name: 'Audiowide', family: 'Audiowide', cat: 'Sci-Fi', param: 'Audiowide' },
  { name: 'Russo One', family: 'Russo One', cat: 'Sci-Fi', param: 'Russo+One' },
  { name: 'Wallpoet', family: 'Wallpoet', cat: 'Sci-Fi', param: 'Wallpoet' },
  { name: 'Syncopate', family: 'Syncopate', cat: 'Sci-Fi', param: 'Syncopate:wght@400;700' },
  { name: 'Megrim', family: 'Megrim', cat: 'Sci-Fi', param: 'Megrim' },
  // Esports / heavy display
  { name: 'Bebas Neue', family: 'Bebas Neue', cat: 'Esports', param: 'Bebas+Neue' },
  { name: 'Anton', family: 'Anton', cat: 'Esports', param: 'Anton' },
  { name: 'Teko', family: 'Teko', cat: 'Esports', param: 'Teko:wght@400;600;700' },
  { name: 'Saira Stencil One', family: 'Saira Stencil One', cat: 'Esports', param: 'Saira+Stencil+One' },
  { name: 'Black Ops One', family: 'Black Ops One', cat: 'Esports', param: 'Black+Ops+One' },
  { name: 'Oswald', family: 'Oswald', cat: 'Esports', param: 'Oswald:wght@400;600;700' },
  { name: 'Archivo Black', family: 'Archivo Black', cat: 'Esports', param: 'Archivo+Black' },
  // Blocky / arcade
  { name: 'Bungee', family: 'Bungee', cat: 'Arcade', param: 'Bungee' },
  { name: 'Bungee Inline', family: 'Bungee Inline', cat: 'Arcade', param: 'Bungee+Inline' },
  { name: 'Press Start 2P', family: 'Press Start 2P', cat: 'Arcade', param: 'Press+Start+2P' },
  { name: 'Silkscreen', family: 'Silkscreen', cat: 'Arcade', param: 'Silkscreen:wght@400;700' },
  { name: 'Monoton', family: 'Monoton', cat: 'Arcade', param: 'Monoton' },
  { name: 'Faster One', family: 'Faster One', cat: 'Arcade', param: 'Faster+One' },
  // Bold / impact
  { name: 'Rubik Mono One', family: 'Rubik Mono One', cat: 'Bold', param: 'Rubik+Mono+One' },
  { name: 'Bowlby One SC', family: 'Bowlby One SC', cat: 'Bold', param: 'Bowlby+One+SC' },
  { name: 'Titan One', family: 'Titan One', cat: 'Bold', param: 'Titan+One' },
  { name: 'Fredoka', family: 'Fredoka', cat: 'Bold', param: 'Fredoka:wght@400;600;700' },
  { name: 'Luckiest Guy', family: 'Luckiest Guy', cat: 'Bold', param: 'Luckiest+Guy' },
  // System (always available)
  { name: 'Arial', family: 'Arial, sans-serif', cat: 'System', param: null },
  { name: 'Helvetica', family: 'Helvetica, Arial, sans-serif', cat: 'System', param: null },
  { name: 'Georgia', family: 'Georgia, serif', cat: 'System', param: null },
  { name: 'Times New Roman', family: "'Times New Roman', serif", cat: 'System', param: null },
  { name: 'Courier New', family: "'Courier New', monospace", cat: 'System', param: null },
  { name: 'Impact', family: "Impact, 'Arial Black', sans-serif", cat: 'System', param: null },
]

const CUSTOM_KEY = 'acc-custom-fonts'
interface CustomRec { name: string; family: string; dataUrl: string; format: string }

// Fires whenever the FONTS list changes (custom font added) so UIs re-render.
type Listener = () => void
const listeners = new Set<Listener>()
export function onFontsChanged(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
function notify() { listeners.forEach((l) => l()) }

let linkInjected = false
export function loadGoogleFonts() {
  if (linkInjected) return
  linkInjected = true
  const params = FONTS.filter((f) => f.param).map((f) => `family=${f.param}`).join('&')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`
  document.head.appendChild(link)
}

export function fontByFamily(family: string): FontDef | undefined {
  return FONTS.find((f) => f.family === family)
}

// Synchronous best-effort check: is this font already available to canvas?
// Used to gate first render so Konva never measures/draws a not-yet-loaded font
// (which produces a transient 0-size canvas). System fonts report true.
export function isFontReady(family: string, bold = false): boolean {
  const primary = family.replace(/'/g, '').split(',')[0].trim()
  try {
    return document.fonts.check(`${bold ? 700 : 400} 64px "${primary}"`)
  } catch {
    return true
  }
}

// Ensure a font weight is actually loaded before rendering/exporting.
export async function ensureFontReady(family: string, bold = false): Promise<void> {
  const primary = family.replace(/'/g, '').split(',')[0].trim()
  try {
    await document.fonts.load(`${bold ? 700 : 400} 64px "${primary}"`)
    await document.fonts.ready
  } catch {
    /* fall back to whatever the browser has */
  }
}

function bufToB64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

function formatFor(ext: string): string {
  return ({ ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' } as Record<string, string>)[ext] || 'truetype'
}

function persistCustom() {
  const recs: CustomRec[] = FONTS.filter((f) => f.custom).map((f) => ({
    name: f.name, family: f.family, dataUrl: (f as FontDef & { dataUrl: string }).dataUrl, format: (f as FontDef & { format: string }).format,
  }))
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(recs)) } catch { /* quota */ }
}

async function addFontFace(rec: CustomRec) {
  const ff = new FontFace(rec.family, `url(${rec.dataUrl}) format('${rec.format}')`)
  await ff.load()
  document.fonts.add(ff)
  FONTS.push({ name: rec.name, family: rec.family, cat: 'Custom', param: null, custom: true, ...( { dataUrl: rec.dataUrl, format: rec.format } as object) })
}

// Register a user font from a File; returns the new family name.
export async function registerCustomFont(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const buf = await file.arrayBuffer()
  const dataUrl = `data:font/${ext};base64,${bufToB64(buf)}`
  const base = file.name.replace(/\.[^.]+$/, '').trim() || 'Custom Font'
  let name = base, n = 2
  while (FONTS.some((f) => f.name === name)) name = `${base} ${n++}`
  await addFontFace({ name, family: name, dataUrl, format: formatFor(ext) })
  persistCustom()
  notify()
  return name
}

// Re-register persisted custom fonts on startup.
export async function restoreCustomFonts() {
  let recs: CustomRec[] = []
  try { recs = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]') } catch { recs = [] }
  for (const rec of recs) {
    if (FONTS.some((f) => f.name === rec.name)) continue
    try { await addFontFace(rec) } catch { /* skip bad font */ }
  }
  if (recs.length) notify()
}
