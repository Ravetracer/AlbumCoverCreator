// Fixed retro palettes for the color-reduction effect. Each is a list of
// [r, g, b] triplets (0..255). Kept intentionally small so nearest-color search
// stays cheap.
export type RGB = [number, number, number]

function hexList(...hex: string[]): RGB[] {
  return hex.map((h) => {
    const n = parseInt(h.replace('#', ''), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as RGB
  })
}

export const PALETTES: Record<string, RGB[]> = {
  // Commodore 64 (16 colors)
  c64: hexList(
    '000000', 'ffffff', '880000', 'aaffee', 'cc44cc', '00cc55', '0000aa',
    'eeee77', 'dd8855', '664400', 'ff7777', '333333', '777777', 'aaff66',
    '0088ff', 'bbbbbb',
  ),
  // EGA / Amiga-ish 16 color
  ega16: hexList(
    '000000', '0000aa', '00aa00', '00aaaa', 'aa0000', 'aa00aa', 'aa5500',
    'aaaaaa', '555555', '5555ff', '55ff55', '55ffff', 'ff5555', 'ff55ff',
    'ffff55', 'ffffff',
  ),
  // CGA mode 4, palette 1 (high intensity)
  cga4: hexList('000000', '55ffff', 'ff55ff', 'ffffff'),
  // ZX Spectrum (normal + bright)
  zx: hexList(
    '000000', '0000d7', 'd70000', 'd700d7', '00d700', '00d7d7', 'd7d700',
    'd7d7d7', '0000ff', 'ff0000', 'ff00ff', '00ff00', '00ffff', 'ffff00',
    'ffffff',
  ),
  // Original Game Boy (DMG) greens
  gameboy: hexList('0f380f', '306230', '8bac0f', '9bbc0f'),
  // 4-tone grayscale (classic Mac / mono handheld)
  gray4: hexList('000000', '555555', 'aaaaaa', 'ffffff'),
  // 1-bit
  bw1bit: hexList('000000', 'ffffff'),
}

export const PALETTE_OPTIONS = [
  { value: 'c64', label: 'Commodore 64' },
  { value: 'ega16', label: 'EGA / Amiga 16' },
  { value: 'cga4', label: 'CGA 4-color' },
  { value: 'zx', label: 'ZX Spectrum' },
  { value: 'gameboy', label: 'Game Boy' },
  { value: 'gray4', label: 'Grayscale 4' },
  { value: 'bw1bit', label: '1-bit B/W' },
]
