export type RGB = readonly [number, number, number];

export type PaletteId = 'game' | 'full' | 'grey' | 'retro';

function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The game palette. It has a wide range of skin tones and hair colours
 * on purpose, so every face keeps its real tone after quantizing.
 */
export const GAME_PALETTE: RGB[] = [
  // skin, light to deep
  '#ffe8d1',
  '#ffd5ae',
  '#f5c08e',
  '#e7aa74',
  '#d4915c',
  '#bb7a4a',
  '#a0643b',
  '#86512f',
  '#6b3f25',
  '#52301c',
  '#3c2215',
  // hair and dark tones
  '#0e0b0a',
  '#231914',
  '#3d2a1e',
  '#5f4130',
  '#8a6243',
  '#b58b5c',
  '#e2c290',
  '#b8502b',
  // greys and whites
  '#ffffff',
  '#d6d6d6',
  '#9a9a9a',
  '#5c5c5c',
  '#2d2d2d',
  // lips, cheeks
  '#c05a5f',
  '#e08a80',
  // clothes and backgrounds
  '#1b1f3b',
  '#2e4a7d',
  '#5b8bd4',
  '#9cc8f0',
  '#2f6b3a',
  '#6fb36a',
  '#e8c547',
  '#8e4fb3',
  '#d84b4b',
].map(hex);

export const RETRO_PALETTE: RGB[] = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'].map(hex);

export const GREY_PALETTE: RGB[] = [
  '#111111',
  '#3a3a3a',
  '#666666',
  '#939393',
  '#c4c4c4',
  '#f2f2f2',
].map(hex);

export const OUTLINE_COLOR: RGB = hex('#14121c');

export function paletteFor(id: PaletteId): RGB[] | null {
  switch (id) {
    case 'game':
      return GAME_PALETTE;
    case 'retro':
      return RETRO_PALETTE;
    case 'grey':
      return GREY_PALETTE;
    case 'full':
      return null;
  }
}
