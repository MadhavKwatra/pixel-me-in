/**
 * All world art (zones, obstacles, pickups, robot) drawn in code as pixel
 * art. No image files are needed, so the game works offline and the repo
 * stays small. Contributors can swap any of these for real sprites later.
 */
import { VIEW_H, VIEW_W } from '../config';

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function paint(w: number, h: number, fn: Painter): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  fn(ctx, w, h);
  return c;
}

/** Deterministic noise so the scenery looks the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const rect = (
  ctx: CanvasRenderingContext2D,
  c: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function pixelDisc(ctx: CanvasRenderingContext2D, c: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

/** Vertical gradient in hard pixel bands (looks retro, compresses well). */
function sky(top: string, bottom: string, bands = 12): Painter {
  return (ctx, w, h) => {
    const a = hexToRgb(top);
    const b = hexToRgb(bottom);
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = a.map((v, k) => Math.round(v + (b[k] - v) * t));
      rect(ctx, `rgb(${col.join(',')})`, 0, (h * i) / bands, w, h / bands + 1);
    }
  };
}

function hexToRgb(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const GROUND_Y = 300;
const LAYER_W = 512;

export interface ZoneArt {
  id: string;
  name: string;
  sky: Painter;
  far: Painter;
  mid: Painter;
  ground: Painter;
  low: { key: string; w: number; h: number; draw: Painter };
  high: { key: string; w: number; h: number; draw: Painter };
  /** Tint for particles/text in this zone. */
  accent: number;
  /** Floating clouds in the sky (off indoors and in space). */
  clouds: boolean;
}

// ---------- zones ----------

const backyard: ZoneArt = {
  id: 'backyard',
  name: 'Backyard',
  accent: 0x6fb36a,
  clouds: true,
  sky: sky('#7ec8f2', '#d9f1ff'),
  far: (ctx) => {
    const r = rng(1);
    for (let x = 0; x < LAYER_W; x += 64) {
      const hh = 40 + Math.floor(r() * 30);
      rect(ctx, '#b9c9e0', x + 6, 120 - hh, 52, hh);
      rect(ctx, '#9aaeca', x + 2, 120 - hh - 10, 60, 10);
      rect(ctx, '#e8f0fa', x + 16, 130 - hh, 8, 8);
      rect(ctx, '#e8f0fa', x + 36, 130 - hh, 8, 8);
    }
    rect(ctx, '#b9c9e0', 0, 120, LAYER_W, 60);
  },
  mid: (ctx) => {
    const r = rng(2);
    // fence
    for (let x = 0; x < LAYER_W; x += 12) rect(ctx, '#d9a066', x, 120, 9, 50);
    rect(ctx, '#b07a45', 0, 130, LAYER_W, 4);
    rect(ctx, '#b07a45', 0, 155, LAYER_W, 4);
    // trees
    for (let x = 30; x < LAYER_W; x += 150 + Math.floor(r() * 40)) {
      rect(ctx, '#6b4226', x + 18, 90, 10, 80);
      pixelDisc(ctx, '#2f6b3a', x + 23, 80, 30);
      pixelDisc(ctx, '#3f8a4a', x + 16, 72, 16);
    }
  },
  ground: (ctx, w) => {
    rect(ctx, '#5fa85a', 0, 0, w, 8);
    rect(ctx, '#3f8a4a', 0, 8, w, 3);
    rect(ctx, '#8a6243', 0, 11, w, 49);
    for (let x = 0; x < w; x += 8) rect(ctx, '#6fb36a', x, 0, 3, 2);
    for (let x = 4; x < w; x += 16) rect(ctx, '#6b4c33', x, 24 + (x % 3) * 8, 4, 3);
  },
  low: {
    key: 'gnome',
    w: 22,
    h: 32,
    draw: (ctx) => {
      rect(ctx, '#d84b4b', 7, 0, 8, 4);
      rect(ctx, '#d84b4b', 5, 4, 12, 8);
      rect(ctx, '#ffd5ae', 6, 12, 10, 6);
      rect(ctx, '#f2f2f2', 5, 16, 12, 6);
      rect(ctx, '#2e4a7d', 3, 20, 16, 9);
      rect(ctx, '#5f4130', 2, 29, 18, 3);
    },
  },
  high: {
    key: 'clothesline',
    w: 64,
    h: 40,
    draw: (ctx) => {
      rect(ctx, '#5c5c5c', 0, 0, 64, 2);
      rect(ctx, '#f2f2f2', 4, 2, 24, 30);
      rect(ctx, '#5b8bd4', 34, 2, 24, 22);
      rect(ctx, '#d6d6d6', 4, 28, 24, 4);
      rect(ctx, '#e8c547', 40, 8, 12, 4);
    },
  },
};

const coaster: ZoneArt = {
  id: 'coaster',
  name: 'Rollercoaster',
  accent: 0xe8c547,
  clouds: true,
  sky: sky('#f08a6b', '#ffd9a0'),
  far: (ctx) => {
    ctx.strokeStyle = '#c4627a';
    ctx.lineWidth = 4;
    for (let x = 0; x < LAYER_W; x += 256) {
      ctx.beginPath();
      ctx.arc(x + 128, 90, 50, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 6; k++) rect(ctx, '#c4627a', x + 60 + k * 28, 100, 3, 80);
    }
    rect(ctx, '#c4627a', 0, 160, LAYER_W, 20);
  },
  mid: (ctx) => {
    // track on stilts
    rect(ctx, '#8a3d52', 0, 100, LAYER_W, 6);
    for (let x = 0; x < LAYER_W; x += 32) {
      rect(ctx, '#a34d66', x, 106, 4, 70);
      rect(ctx, '#a34d66', x, 130 + ((x / 32) % 2) * 20, 32, 3);
    }
    // flags
    for (let x = 16; x < LAYER_W; x += 96) {
      rect(ctx, '#f2f2f2', x, 70, 2, 30);
      rect(ctx, '#e8c547', x + 2, 70, 12, 8);
    }
  },
  ground: (ctx, w) => {
    rect(ctx, '#b07a45', 0, 0, w, 60);
    for (let x = 0; x < w; x += 16) rect(ctx, '#8a5a30', x, 0, 2, 60);
    rect(ctx, '#d9a066', 0, 0, w, 4);
    for (let y = 14; y < 60; y += 12) rect(ctx, '#8a5a30', 0, y, w, 1);
  },
  low: {
    key: 'cone',
    w: 22,
    h: 30,
    draw: (ctx) => {
      for (let i = 0; i < 26; i++)
        rect(ctx, i % 10 < 5 ? '#f08a24' : '#f2f2f2', 11 - i / 3, i, (i / 3) * 2 + 1, 1);
      rect(ctx, '#2d2d2d', 1, 26, 20, 4);
    },
  },
  high: {
    key: 'coasterbar',
    w: 70,
    h: 30,
    draw: (ctx) => {
      rect(ctx, '#8a3d52', 0, 0, 70, 10);
      rect(ctx, '#e8c547', 6, 10, 58, 14);
      rect(ctx, '#2d2d2d', 10, 13, 50, 8);
      rect(ctx, '#f2f2f2', 14, 15, 42, 4);
      rect(ctx, '#2d2d2d', 10, 24, 6, 6);
      rect(ctx, '#2d2d2d', 54, 24, 6, 6);
    },
  },
};

const beach: ZoneArt = {
  id: 'beach',
  name: 'Beach',
  accent: 0x3bc6e0,
  clouds: true,
  sky: sky('#4fb6e8', '#c8f0ff'),
  far: (ctx) => {
    pixelDisc(ctx, '#ffe39a', 400, 50, 26);
    rect(ctx, '#2e7fb8', 0, 120, LAYER_W, 60);
    for (let x = 0; x < LAYER_W; x += 24)
      rect(ctx, '#9cc8f0', x + ((x / 24) % 2) * 8, 126 + ((x / 24) % 3) * 10, 10, 2);
  },
  mid: (ctx) => {
    const r = rng(5);
    for (let x = 40; x < LAYER_W; x += 180 + Math.floor(r() * 50)) {
      for (let k = 0; k < 9; k++) rect(ctx, '#8a6243', x + k * 2, 80 + k * 10, 6, 11);
      for (let a = 0; a < 5; a++) {
        const ang = Math.PI * (0.9 + a * 0.3);
        for (let s = 0; s < 22; s++)
          rect(
            ctx,
            '#2f8a3a',
            x + 2 + Math.cos(ang) * s * 1.4,
            80 + Math.sin(ang) * s * 0.7 + s * 0.3,
            4,
            3,
          );
      }
    }
  },
  ground: (ctx, w) => {
    rect(ctx, '#f2d58f', 0, 0, w, 60);
    rect(ctx, '#ffe6a8', 0, 0, w, 4);
    for (let x = 3; x < w; x += 13) rect(ctx, '#d9b86a', x, 12 + (x % 5) * 8, 2, 2);
  },
  low: {
    key: 'sandcastle',
    w: 30,
    h: 28,
    draw: (ctx) => {
      rect(ctx, '#d9b86a', 2, 12, 26, 16);
      rect(ctx, '#d9b86a', 0, 6, 8, 22);
      rect(ctx, '#d9b86a', 22, 6, 8, 22);
      rect(ctx, '#d9b86a', 10, 2, 10, 12);
      rect(ctx, '#8a6243', 13, 18, 4, 10);
      rect(ctx, '#d84b4b', 14, 0, 6, 3);
    },
  },
  high: {
    key: 'seagull',
    w: 40,
    h: 22,
    draw: (ctx) => {
      rect(ctx, '#f2f2f2', 10, 8, 20, 8);
      rect(ctx, '#d6d6d6', 0, 4, 12, 4);
      rect(ctx, '#d6d6d6', 28, 4, 12, 4);
      rect(ctx, '#f2f2f2', 4, 0, 6, 4);
      rect(ctx, '#f2f2f2', 30, 0, 6, 4);
      rect(ctx, '#e8c547', 30, 10, 6, 3);
      rect(ctx, '#111111', 26, 9, 2, 2);
      rect(ctx, '#9a9a9a', 12, 16, 16, 4);
    },
  },
};

const space: ZoneArt = {
  id: 'space',
  name: 'Space',
  accent: 0x9b7bff,
  clouds: false,
  sky: (ctx, w, h) => {
    sky('#05061a', '#1b1f3b')(ctx, w, h);
    const r = rng(9);
    for (let i = 0; i < 120; i++)
      rect(ctx, r() > 0.8 ? '#e8c547' : '#ffffff', r() * w, r() * h * 0.8, 1, 1);
  },
  far: (ctx) => {
    pixelDisc(ctx, '#d84b4b', 120, 60, 24);
    pixelDisc(ctx, '#b83c3c', 112, 54, 8);
    pixelDisc(ctx, '#5b8bd4', 380, 90, 14);
    rect(ctx, '#9cc8f0', 360, 89, 40, 2);
  },
  mid: (ctx) => {
    for (let x = 0; x < LAYER_W; x += 128) {
      rect(ctx, '#3a3f66', x, 140, 128, 40);
      pixelDisc(ctx, '#3a3f66', x + 64, 140, 40);
      rect(ctx, '#9a9a9a', x + 90, 90, 2, 40);
      rect(ctx, '#d84b4b', x + 89, 88, 4, 3);
    }
  },
  ground: (ctx, w) => {
    rect(ctx, '#7a7f99', 0, 0, w, 60);
    rect(ctx, '#a3a8c2', 0, 0, w, 4);
    for (let x = 6; x < w; x += 20) {
      pixelDisc(ctx, '#5c6080', x, 22 + (x % 7) * 3, 4);
    }
  },
  low: {
    key: 'moonrock',
    w: 30,
    h: 24,
    draw: (ctx) => {
      pixelDisc(ctx, '#9a9fbb', 15, 14, 12);
      rect(ctx, '#9a9fbb', 3, 14, 24, 10);
      pixelDisc(ctx, '#6f7494', 10, 12, 3);
      pixelDisc(ctx, '#6f7494', 20, 18, 2);
    },
  },
  high: {
    key: 'ufo',
    w: 56,
    h: 26,
    draw: (ctx) => {
      pixelDisc(ctx, '#9cc8f0', 28, 10, 10);
      rect(ctx, '#a9b4c4', 2, 12, 52, 8);
      rect(ctx, '#5c6080', 8, 20, 40, 4);
      for (let x = 8; x < 50; x += 10) rect(ctx, '#e8c547', x, 14, 4, 3);
    },
  },
};

// ---------- "Save Your RAM" zones ----------

/** You are tiny, running across your own computer desk at night. */
const desk: ZoneArt = {
  id: 'desk',
  name: 'Your Desk',
  accent: 0x5fd0ff,
  clouds: false,
  sky: sky('#231f42', '#4b3f73'),
  far: (ctx) => {
    // RGB light strip along the wall
    const cols = ['#ff5a8a', '#e8c547', '#4dff88', '#5fd0ff', '#9b7bff'];
    for (let x = 0; x < LAYER_W; x += 6) rect(ctx, cols[(x / 6) % cols.length], x, 4, 4, 2);
    // window with the night city
    rect(ctx, '#14121c', 18, 18, 136, 96);
    rect(ctx, '#1b2a55', 24, 24, 124, 84);
    pixelDisc(ctx, '#f4f1e8', 124, 44, 8);
    pixelDisc(ctx, '#1b2a55', 128, 41, 6);
    const r = rng(21);
    for (let i = 0; i < 14; i++) rect(ctx, '#f4f1e8', 26 + r() * 118, 26 + r() * 40, 1, 1);
    for (let x = 26; x < 146; x += 14) {
      const hh = 14 + Math.floor(r() * 26);
      rect(ctx, '#2c3a6b', x, 108 - hh, 12, hh);
      if (hh > 22) rect(ctx, '#e8c547', x + 4, 112 - hh, 2, 2);
    }
    rect(ctx, '#14121c', 84, 24, 4, 84);
    rect(ctx, '#14121c', 24, 64, 124, 4);
    // the big monitor: code, and a RAM bar that is almost full
    rect(ctx, '#14121c', 196, 26, 208, 110);
    rect(ctx, '#16213e', 203, 33, 194, 92);
    const code = ['#5fd0ff', '#9b7bff', '#4dff88', '#e8c547', '#f4f1e8'];
    for (let y = 40; y < 96; y += 7) {
      const i = Math.round((y - 40) / 7);
      rect(ctx, code[i % code.length], 210 + (i % 3) * 8, y, 40 + ((i * 23) % 70), 3);
    }
    rect(ctx, '#2a2f55', 210, 104, 180, 12);
    rect(ctx, '#d84b4b', 212, 106, 170, 8);
    rect(ctx, '#14121c', 290, 136, 20, 26);
    rect(ctx, '#14121c', 268, 160, 64, 6);
    // a poster with a heart
    rect(ctx, '#e8c547', 432, 30, 56, 72);
    rect(ctx, '#14121c', 436, 34, 48, 64);
    pixelDisc(ctx, '#d84b4b', 452, 58, 8);
    pixelDisc(ctx, '#d84b4b', 468, 58, 8);
    rect(ctx, '#d84b4b', 446, 60, 28, 8);
    for (let k = 0; k < 10; k++) rect(ctx, '#d84b4b', 450 + k, 66 + k, 20 - k * 2, 1);
    rect(ctx, '#3a335f', 0, 160, LAYER_W, 20);
  },
  mid: (ctx) => {
    // keyboard with an RGB underglow
    rect(ctx, '#5fd0ff', 18, 168, 124, 2);
    rect(ctx, '#2a2a3a', 20, 156, 120, 12);
    for (let x = 24; x < 136; x += 6)
      for (let y = 158; y < 166; y += 4) rect(ctx, '#5a5a7a', x, y, 4, 2);
    // plant
    rect(ctx, '#c46a4a', 176, 148, 22, 22);
    rect(ctx, '#a3553a', 174, 146, 26, 4);
    pixelDisc(ctx, '#2f6b3a', 187, 132, 12);
    pixelDisc(ctx, '#3f8a4a', 180, 128, 7);
    pixelDisc(ctx, '#3f8a4a', 194, 124, 6);
    // books
    rect(ctx, '#5b8bd4', 226, 150, 40, 8);
    rect(ctx, '#d84b4b', 230, 142, 34, 8);
    rect(ctx, '#e8c547', 224, 158, 44, 12);
    // PC tower: glass side, RGB fans and glowing RAM inside
    rect(ctx, '#1f1f2e', 300, 84, 58, 86);
    rect(ctx, '#2d2d44', 306, 90, 46, 74);
    pixelDisc(ctx, '#ff5a8a', 329, 108, 9);
    pixelDisc(ctx, '#2d2d44', 329, 108, 5);
    pixelDisc(ctx, '#5fd0ff', 329, 140, 9);
    pixelDisc(ctx, '#2d2d44', 329, 140, 5);
    for (let x = 310; x < 324; x += 4) rect(ctx, '#4dff88', x, 120, 2, 10);
    // desk lamp
    rect(ctx, '#14121c', 424, 164, 30, 6);
    for (let k = 0; k < 40; k++) rect(ctx, '#5c6080', 438 - k * 0.4, 164 - k, 3, 1);
    for (let k = 0; k < 26; k++) rect(ctx, '#5c6080', 422 + k, 124 + k * 0.3, 1, 3);
    rect(ctx, '#5c6080', 446, 126, 18, 8);
    rect(ctx, '#ffe39a', 448, 134, 14, 2);
  },
  ground: (ctx, w) => {
    rect(ctx, '#a8744a', 0, 0, w, 60);
    rect(ctx, '#c99566', 0, 0, w, 4);
    for (const [y, len] of [
      [12, 22],
      [21, 34],
      [30, 18],
    ])
      for (let x = (y * 3) % 16; x < w; x += 40) rect(ctx, '#8e5f3a', x, y, len, 1);
    rect(ctx, '#7a4f30', 0, 42, w, 18);
    rect(ctx, '#5f3c24', 0, 42, w, 2);
  },
  low: {
    key: 'mug',
    w: 26,
    h: 28,
    draw: (ctx) => {
      rect(ctx, 'rgba(255,255,255,0.7)', 7, 0, 2, 3);
      rect(ctx, 'rgba(255,255,255,0.7)', 12, 1, 2, 3);
      rect(ctx, '#f2f2f2', 2, 6, 17, 22);
      rect(ctx, '#d6d6d6', 2, 24, 17, 4);
      rect(ctx, '#6b4226', 3, 6, 15, 3);
      rect(ctx, '#f2f2f2', 19, 10, 6, 3);
      rect(ctx, '#f2f2f2', 22, 10, 3, 11);
      rect(ctx, '#f2f2f2', 19, 18, 6, 3);
      pixelDisc(ctx, '#d84b4b', 8, 15, 2);
      pixelDisc(ctx, '#d84b4b', 12, 15, 2);
      rect(ctx, '#d84b4b', 7, 16, 7, 2);
      rect(ctx, '#d84b4b', 9, 18, 3, 2);
    },
  },
  high: {
    key: 'headset',
    w: 48,
    h: 38,
    draw: (ctx) => {
      rect(ctx, '#14121c', 23, 0, 2, 10);
      rect(ctx, '#3a3f66', 10, 9, 28, 4);
      rect(ctx, '#3a3f66', 7, 12, 4, 12);
      rect(ctx, '#3a3f66', 37, 12, 4, 12);
      rect(ctx, '#2d2d3a', 3, 22, 12, 16);
      rect(ctx, '#2d2d3a', 33, 22, 12, 16);
      rect(ctx, '#5fd0ff', 3, 22, 2, 16);
      rect(ctx, '#ff5a8a', 43, 22, 2, 16);
    },
  },
};

/** The villain's home: endless server racks, blinking lights, cold air. */
const datacenter: ZoneArt = {
  id: 'datacenter',
  name: 'Data Center',
  accent: 0x4dff88,
  clouds: false,
  sky: sky('#070b16', '#141d33'),
  far: (ctx) => {
    const r = rng(33);
    rect(ctx, '#0f1524', 0, 0, LAYER_W, 180);
    rect(ctx, '#3a4560', 0, 6, LAYER_W, 6);
    for (let x = 0; x < LAYER_W; x += 8) rect(ctx, '#232d45', x, 12, 2, 6);
    for (let x = 0; x < LAYER_W; x += 44) {
      rect(ctx, '#1c2436', x + 2, 22, 40, 158);
      rect(ctx, '#2a3550', x + 2, 22, 40, 2);
      rect(ctx, '#2a3550', x + 2, 22, 2, 158);
      for (let y = 28; y < 176; y += 8) {
        rect(ctx, '#151b2a', x + 6, y + 6, 32, 1);
        const roll = r();
        const led = roll > 0.92 ? '#ff5a5a' : roll > 0.6 ? '#5fd0ff' : '#4dff88';
        rect(ctx, led, x + 8, y + 2, 2, 2);
        if (r() > 0.4) rect(ctx, '#4dff88', x + 12, y + 2, 2, 2);
        if (r() > 0.7) rect(ctx, '#e8c547', x + 16, y + 2, 2, 2);
      }
    }
  },
  mid: (ctx) => {
    // cooling pipes across the ceiling
    rect(ctx, '#5c6b8a', 0, 26, LAYER_W, 10);
    rect(ctx, '#8a99b8', 0, 27, LAYER_W, 2);
    rect(ctx, '#46536e', 0, 40, LAYER_W, 6);
    for (let x = 30; x < LAYER_W; x += 128) rect(ctx, '#46536e', x, 46, 6, 20);
    // front racks with glowing doors
    for (let x = 60; x < LAYER_W; x += 170) {
      rect(ctx, '#232d45', x, 54, 60, 116);
      rect(ctx, '#2e3a58', x + 4, 58, 52, 108);
      rect(ctx, '#2e8bff', x + 6, 60, 2, 104);
      rect(ctx, '#2e8bff', x + 52, 60, 2, 104);
      for (let y = 66; y < 160; y += 10) rect(ctx, '#1a2133', x + 12, y, 36, 4);
      rect(ctx, '#4dff88', x + 44, 64, 3, 3);
    }
    // hazard strip on the floor edge
    for (let x = 0; x < LAYER_W; x += 12) {
      rect(ctx, '#e8c547', x, 166, 6, 4);
      rect(ctx, '#14121c', x + 6, 166, 6, 4);
    }
  },
  ground: (ctx, w) => {
    rect(ctx, '#4a5268', 0, 0, w, 60);
    rect(ctx, '#6b7590', 0, 0, w, 3);
    for (let x = 0; x < w; x += 16) rect(ctx, '#363c50', x, 0, 1, 60);
    for (const y of [16, 32, 48]) rect(ctx, '#363c50', 0, y, w, 1);
    // air vents in every other floor tile
    for (let tx = 0; tx < w; tx += 32)
      for (let y = 4; y < 14; y += 3)
        for (let x = 3; x < 14; x += 3) rect(ctx, '#2b3040', tx + x, y, 1, 1);
  },
  low: {
    key: 'coolingunit',
    w: 30,
    h: 28,
    draw: (ctx) => {
      rect(ctx, '#8a93a8', 0, 2, 30, 26);
      rect(ctx, '#a9b2c6', 0, 2, 30, 2);
      for (let x = 3; x < 27; x += 4) rect(ctx, '#5c6680', x, 5, 2, 3);
      pixelDisc(ctx, '#4a5268', 15, 18, 8);
      pixelDisc(ctx, '#2b3040', 15, 18, 2);
      rect(ctx, '#2b3040', 9, 17, 12, 2);
      rect(ctx, '#2b3040', 14, 12, 2, 12);
      rect(ctx, '#4dff88', 25, 24, 2, 2);
    },
  },
  high: {
    key: 'drone',
    w: 50,
    h: 24,
    draw: (ctx) => {
      rect(ctx, '#c8cce0', 0, 3, 14, 2);
      rect(ctx, '#c8cce0', 36, 3, 14, 2);
      rect(ctx, '#5c6080', 6, 5, 2, 5);
      rect(ctx, '#5c6080', 42, 5, 2, 5);
      rect(ctx, '#5c6080', 6, 9, 38, 3);
      rect(ctx, '#3a4560', 14, 8, 22, 12);
      rect(ctx, '#14121c', 19, 11, 12, 6);
      rect(ctx, '#ff5a5a', 22, 12, 6, 4);
      rect(ctx, '#ffd0d0', 23, 13, 2, 1);
      rect(ctx, '#5c6080', 24, 20, 2, 4);
    },
  },
};

/** "Save Your RAM": your desk, then the data center (they repeat). */
export const ZONES: ZoneArt[] = [desk, datacenter];
/** The first theme (backyard to space), kept for a "Classic" mode later. */
export const CLASSIC_ZONES: ZoneArt[] = [backyard, coaster, beach, space];

// ---------- shared sprites ----------

export const SPRITES: Record<string, { w: number; h: number; draw: Painter }> = {
  crate: {
    w: 28,
    h: 28,
    draw: (ctx) => {
      rect(ctx, '#b07a45', 0, 0, 28, 28);
      rect(ctx, '#8a5a30', 0, 0, 28, 3);
      rect(ctx, '#8a5a30', 0, 25, 28, 3);
      rect(ctx, '#8a5a30', 0, 0, 3, 28);
      rect(ctx, '#8a5a30', 25, 0, 3, 28);
      for (let i = 3; i < 25; i++) rect(ctx, '#8a5a30', i, i, 2, 2);
    },
  },
  /** A stick of RAM (1 GB): green board, black chips, gold pins. */
  ram: {
    w: 22,
    h: 11,
    draw: (ctx) => {
      rect(ctx, '#14121c', 0, 0, 22, 9);
      rect(ctx, '#2f8a4a', 1, 1, 20, 7);
      rect(ctx, '#4fb36a', 1, 1, 20, 1);
      for (const x of [2, 7, 12, 17]) rect(ctx, '#14121c', x, 3, 4, 4);
      rect(ctx, '#f2f2f2', 7, 1, 3, 1);
      for (let x = 1; x < 21; x += 2) if (x < 9 || x > 11) rect(ctx, '#e8c547', x, 9, 1, 2);
    },
  },
  /** Rare RGB gaming stick (8 GB): dark heatsink with a rainbow light bar. */
  ramRgb: {
    w: 24,
    h: 13,
    draw: (ctx) => {
      rect(ctx, '#14121c', 0, 0, 24, 11);
      const cols = ['#ff5a8a', '#f08a24', '#e8c547', '#4dff88', '#5fd0ff', '#9b7bff'];
      cols.forEach((c, i) => rect(ctx, c, 1 + i * 3.7, 1, 4, 2));
      rect(ctx, '#2d2d3a', 1, 3, 22, 7);
      rect(ctx, '#4a4e6e', 3, 5, 18, 1);
      rect(ctx, '#e8c547', 3, 7, 6, 1);
      for (let x = 1; x < 23; x += 2) if (x < 10 || x > 12) rect(ctx, '#e8c547', x, 11, 1, 2);
    },
  },
  /** Firewall (the shield power-up): a brick wall. */
  shield: {
    w: 20,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#f08a24', 10, 10, 9);
      rect(ctx, '#f2f2f2', 4, 5, 12, 10);
      for (const [y, off] of [
        [5, 0],
        [9, 3],
        [13, 0],
      ])
        for (let x = 4 + off; x < 16; x += 6) rect(ctx, '#d84b4b', x, y, 5, 2);
    },
  },
  /** Download More RAM (the magnet power-up): a big down arrow. */
  magnet: {
    w: 20,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#2f8a4a', 10, 10, 9);
      rect(ctx, '#f2f2f2', 8, 4, 4, 7);
      for (let k = 0; k < 5; k++) rect(ctx, '#f2f2f2', 5 + k, 10 + k, 10 - k * 2, 1);
      rect(ctx, '#e8c547', 5, 15, 10, 2);
    },
  },
  jetpack: {
    w: 20,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#8e4fb3', 10, 10, 9);
      rect(ctx, '#d6d6d6', 6, 4, 4, 9);
      rect(ctx, '#d6d6d6', 11, 4, 4, 9);
      rect(ctx, '#f08a24', 7, 13, 2, 3);
      rect(ctx, '#f08a24', 12, 13, 2, 3);
    },
  },
  flame: {
    w: 6,
    h: 10,
    draw: (ctx) => {
      rect(ctx, '#f08a24', 0, 0, 6, 6);
      rect(ctx, '#e8c547', 1, 4, 4, 4);
      rect(ctx, '#fff3b0', 2, 7, 2, 3);
    },
  },
  spark: { w: 2, h: 2, draw: (ctx) => rect(ctx, '#ffffff', 0, 0, 2, 2) },
  /** One pixel, tinted and scaled for the "break into pixels" effect. */
  pixel: { w: 1, h: 1, draw: (ctx) => rect(ctx, '#ffffff', 0, 0, 1, 1) },
  puff: {
    w: 6,
    h: 6,
    draw: (ctx) => {
      pixelDisc(ctx, 'rgba(255,255,255,0.9)', 3, 3, 3);
      rect(ctx, 'rgba(255,255,255,1)', 2, 1, 2, 1);
    },
  },
  shadow: {
    w: 30,
    h: 6,
    draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,18,28,0.35)';
      for (let y = 0; y < 6; y++) {
        const half = Math.round(15 * Math.sqrt(1 - ((y - 2.5) / 3) ** 2));
        ctx.fillRect(15 - half, y, half * 2, 1);
      }
    },
  },
  /** "Cloud drop": a small storm cloud that uploads whatever it lands on. */
  bomb: {
    w: 24,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#14121c', 8, 11, 7);
      pixelDisc(ctx, '#14121c', 15, 8, 8);
      rect(ctx, '#14121c', 1, 11, 22, 9);
      pixelDisc(ctx, '#5c6080', 8, 11, 5);
      pixelDisc(ctx, '#6f7494', 15, 8, 6);
      rect(ctx, '#5c6080', 3, 12, 18, 6);
      rect(ctx, '#9a9fbb', 11, 4, 4, 2);
      rect(ctx, '#ff5a5a', 9, 13, 2, 2);
      rect(ctx, '#ff5a5a', 15, 13, 2, 2);
      rect(ctx, '#e8c547', 12, 16, 2, 2);
    },
  },
  mark: {
    w: 34,
    h: 10,
    draw: (ctx) => {
      for (let y = 0; y < 10; y++) {
        const half = Math.round(17 * Math.sqrt(1 - ((y - 4.5) / 5) ** 2));
        const inner = Math.round(12 * Math.sqrt(Math.max(0, 1 - ((y - 4.5) / 3) ** 2)));
        ctx.fillStyle = 'rgba(216,75,75,0.85)';
        ctx.fillRect(17 - half, y, half - inner, 1);
        ctx.fillRect(17 + inner, y, half - inner, 1);
      }
    },
  },
  speedline: { w: 28, h: 1, draw: (ctx) => rect(ctx, 'rgba(255,255,255,0.7)', 0, 0, 28, 1) },
  cloud: {
    w: 48,
    h: 18,
    draw: (ctx) => {
      pixelDisc(ctx, '#ffffff', 14, 11, 7);
      pixelDisc(ctx, '#ffffff', 26, 8, 8);
      pixelDisc(ctx, '#ffffff', 37, 11, 6);
      rect(ctx, '#ffffff', 8, 11, 34, 7);
      rect(ctx, '#e3f1fb', 8, 16, 34, 2);
    },
  },
};

export const SKY_SIZE = { w: VIEW_W, h: VIEW_H };
export const LAYER_SIZE = { w: LAYER_W, h: 180 };
export const GROUND_TILE = { w: 64, h: 60 };
