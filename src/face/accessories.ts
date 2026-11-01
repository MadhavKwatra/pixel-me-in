/**
 * Hats and face accessories, drawn as pixel art in "head frame" coordinates.
 *
 * The head frame is 64x64. The round head sits at x 8..56, y 10..58.
 * Because every face is normalized (eyes level, same spot), the eyes are
 * always near y 32, x 25 and x 39, and the mouth near y 45.
 * Contributors: add a new item by adding one entry below. See CONTRIBUTING.md.
 */
import type { FaceAccId, HatId } from './faceStore';

type Draw = (ctx: CanvasRenderingContext2D) => void;

export interface Accessory<Id extends string> {
  id: Id;
  label: string;
  draw: Draw;
}

function rects(colour: string, list: number[][]): Draw {
  return (ctx) => {
    ctx.fillStyle = colour;
    for (const [x, y, w, h] of list) ctx.fillRect(x, y, w, h);
  };
}

function all(...draws: Draw[]): Draw {
  return (ctx) => draws.forEach((d) => d(ctx));
}

function clearRects(list: number[][]): Draw {
  return (ctx) => list.forEach(([x, y, w, h]) => ctx.clearRect(x, y, w, h));
}

/** Pixel-perfect ring/disc, so round things stay crisp. */
function disc(cx: number, cy: number, r0: number, r1: number, colour: string): Draw {
  return (ctx) => {
    ctx.fillStyle = colour;
    for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
      for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r1 && d > r0) ctx.fillRect(x, y, 1, 1);
      }
    }
  };
}

export const HATS: Accessory<HatId>[] = [
  {
    id: 'cap',
    label: 'Cap',
    draw: all(
      rects('#d84b4b', [
        [14, 8, 36, 2],
        [11, 10, 42, 9],
      ]),
      rects('#9e2f2f', [
        [10, 18, 44, 3],
        [30, 6, 4, 2],
      ]),
      rects('#b83c3c', [[40, 19, 22, 3]]),
    ),
  },
  {
    id: 'helmet',
    label: 'Helmet',
    draw: all(
      rects('#3d7bd9', [
        [16, 5, 32, 3],
        [11, 8, 42, 8],
        [9, 14, 46, 7],
      ]),
      rects('#25509a', [
        [22, 7, 3, 7],
        [31, 6, 3, 8],
        [40, 7, 3, 7],
        [9, 20, 46, 2],
      ]),
      rects('#2d2d2d', [
        [10, 22, 2, 22],
        [52, 22, 2, 22],
      ]),
      rects('#9cc8f0', [[16, 9, 4, 2]]),
    ),
  },
  {
    id: 'crown',
    label: 'Crown',
    draw: all(
      rects('#e8c547', [
        [16, 12, 32, 6],
        [16, 7, 4, 5],
        [26, 5, 4, 7],
        [34, 5, 4, 7],
        [44, 7, 4, 5],
      ]),
      rects('#b8902a', [[16, 17, 32, 2]]),
      rects('#d84b4b', [[22, 13, 3, 3]]),
      rects('#5b8bd4', [[31, 13, 3, 3]]),
      rects('#6fb36a', [[40, 13, 3, 3]]),
    ),
  },
  {
    id: 'headphones',
    label: 'Headphones',
    draw: all(
      rects('#2d2d2d', [
        [16, 5, 32, 3],
        [11, 7, 5, 4],
        [48, 7, 5, 4],
        [8, 11, 4, 16],
        [52, 11, 4, 16],
      ]),
      rects('#2d2d2d', [
        [3, 25, 9, 15],
        [52, 25, 9, 15],
      ]),
      rects('#8e4fb3', [
        [4, 27, 7, 11],
        [53, 27, 7, 11],
      ]),
    ),
  },
  {
    id: 'spaceHelmet',
    label: 'Space helmet',
    draw: all(
      disc(32, 34, 0, 29, 'rgba(170, 220, 255, 0.22)'),
      disc(32, 34, 27, 30, '#e8f4ff'),
      disc(32, 34, 29, 30, '#a9b4c4'),
      rects('rgba(255,255,255,0.85)', [
        [14, 14, 6, 2],
        [11, 17, 3, 5],
      ]),
    ),
  },
];

export const FACE_ACCESSORIES: Accessory<FaceAccId>[] = [
  {
    id: 'sunglasses',
    label: 'Sunglasses',
    draw: all(
      rects('#111111', [
        [18, 29, 13, 6],
        [34, 29, 13, 6],
        [31, 30, 3, 2],
        [9, 30, 9, 2],
        [47, 30, 9, 2],
      ]),
      rects('#5c5c5c', [
        [20, 30, 3, 1],
        [36, 30, 3, 1],
      ]),
    ),
  },
  {
    id: 'mask',
    label: 'Hero mask',
    draw: all(
      rects('#d84b4b', [
        [10, 27, 44, 10],
        [2, 30, 8, 2],
        [3, 33, 6, 2],
      ]),
      rects('#9e2f2f', [[10, 35, 44, 2]]),
      clearRects([
        [20, 30, 9, 4],
        [36, 30, 9, 4],
      ]),
    ),
  },
  {
    id: 'moustache',
    label: 'Moustache',
    draw: rects('#3d2a1e', [
      [24, 40, 16, 3],
      [21, 42, 6, 2],
      [37, 42, 6, 2],
      [19, 43, 4, 2],
      [41, 43, 4, 2],
    ]),
  },
  {
    id: 'glasses3d',
    label: '3D glasses',
    draw: all(
      rects('#f2f2f2', [
        [17, 28, 30, 8],
        [9, 30, 8, 2],
        [47, 30, 8, 2],
      ]),
      rects('#e03b3b', [[19, 30, 11, 4]]),
      rects('#3bc6e0', [[34, 30, 11, 4]]),
    ),
  },
];

export function findHat(id: HatId | null) {
  return HATS.find((h) => h.id === id);
}

export function findFaceAcc(id: FaceAccId | null) {
  return FACE_ACCESSORIES.find((a) => a.id === id);
}
