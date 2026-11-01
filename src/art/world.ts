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
}

// ---------- zones ----------

const backyard: ZoneArt = {
  id: 'backyard',
  name: 'Backyard',
  accent: 0x6fb36a,
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

export const ZONES: ZoneArt[] = [backyard, coaster, beach, space];

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
  gear: {
    w: 16,
    h: 16,
    draw: (ctx) => {
      pixelDisc(ctx, '#e8c547', 8, 8, 6);
      for (const [x, y] of [
        [6, 0],
        [6, 13],
        [0, 6],
        [13, 6],
        [1, 1],
        [12, 1],
        [1, 12],
        [12, 12],
      ])
        rect(ctx, '#e8c547', x, y, 3, 3);
      pixelDisc(ctx, '#b8902a', 8, 8, 3);
      rect(ctx, '#fff3b0', 5, 4, 2, 2);
    },
  },
  shield: {
    w: 20,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#3bc6e0', 10, 10, 9);
      rect(ctx, '#f2f2f2', 6, 5, 8, 9);
      rect(ctx, '#3bc6e0', 8, 7, 4, 5);
    },
  },
  magnet: {
    w: 20,
    h: 20,
    draw: (ctx) => {
      pixelDisc(ctx, '#d84b4b', 10, 10, 9);
      rect(ctx, '#f2f2f2', 5, 5, 3, 9);
      rect(ctx, '#f2f2f2', 12, 5, 3, 9);
      rect(ctx, '#f2f2f2', 5, 12, 10, 3);
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
  robot0: { w: 84, h: 104, draw: (ctx) => drawRobot(ctx, 0) },
  robot1: { w: 84, h: 104, draw: (ctx) => drawRobot(ctx, 1) },
};

function drawRobot(ctx: CanvasRenderingContext2D, f: number) {
  const step = f ? 4 : 0;
  // legs
  rect(ctx, '#5c5c5c', 18 + step, 74, 14, 26);
  rect(ctx, '#5c5c5c', 52 - step, 74, 14, 26);
  rect(ctx, '#2d2d2d', 14 + step, 98, 22, 6);
  rect(ctx, '#2d2d2d', 48 - step, 98, 22, 6);
  // body
  rect(ctx, '#9a9fbb', 8, 30, 68, 46);
  rect(ctx, '#6f7494', 8, 70, 68, 6);
  rect(ctx, '#d84b4b', 30, 44, 24, 14);
  rect(ctx, '#ff8a8a', 34, 48, 6, 4);
  // arms
  rect(ctx, '#6f7494', 0, 34, 8, 30 + step);
  rect(ctx, '#6f7494', 76, 34, 8, 34 - step);
  // head
  rect(ctx, '#9a9fbb', 20, 4, 44, 28);
  rect(ctx, '#111111', 26, 12, 32, 10);
  rect(ctx, f ? '#ff4d4d' : '#e8c547', 30 + step * 2, 14, 8, 6);
  rect(ctx, f ? '#ff4d4d' : '#e8c547', 46 + step * 2, 14, 8, 6);
  rect(ctx, '#5c5c5c', 40, 0, 4, 6);
  rect(ctx, '#d84b4b', 38, 0, 8, 2);
}

export const SKY_SIZE = { w: VIEW_W, h: VIEW_H };
export const LAYER_SIZE = { w: LAYER_W, h: 180 };
export const GROUND_TILE = { w: 64, h: 60 };
