/**
 * The small pixel body under the big head. Drawn in code (no image files),
 * one sprite sheet per outfit: 4 run frames, 1 jump frame, 1 slide frame.
 */
import type { OutfitId } from '../face/faceStore';

export const BODY_W = 40;
export const BODY_H = 32;
export const BODY_FRAMES = ['run0', 'run1', 'run2', 'run3', 'jump', 'slide'] as const;
export type BodyFrame = (typeof BODY_FRAMES)[number];

/** Where the neck is in each frame (the head is attached here). */
export const NECK: Record<BodyFrame, { x: number; y: number }> = {
  run0: { x: 20, y: 1 },
  run1: { x: 20, y: 0 },
  run2: { x: 20, y: 1 },
  run3: { x: 20, y: 0 },
  jump: { x: 21, y: 1 },
  slide: { x: 8, y: 23 },
};

interface Colours {
  top: string;
  topDark: string;
  bottom: string;
  bottomDark: string;
  shoe: string;
  sole: string;
  /** Long pants / sleeves / gloves cover the skin. */
  longLegs: boolean;
  longArms: boolean;
  hands?: string;
  extra?: (r: Rect, frame: BodyFrame) => void;
}

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

const OUTFITS: Record<OutfitId, Colours> = {
  tee: {
    top: '#2bb3a3',
    topDark: '#1d7f74',
    bottom: '#c9a46a',
    bottomDark: '#9c7c48',
    shoe: '#f2f2f2',
    sole: '#2d2d2d',
    longLegs: false,
    longArms: false,
  },
  hoodie: {
    top: '#8e4fb3',
    topDark: '#62307f',
    bottom: '#2e4a7d',
    bottomDark: '#1f3357',
    shoe: '#2d2d2d',
    sole: '#111111',
    longLegs: true,
    longArms: true,
    extra: (r, f) => f !== 'slide' && r(17, 11, 8, 4, '#62307f'),
  },
  skater: {
    top: '#d84b4b',
    topDark: '#9e2f2f',
    bottom: '#2d2d2d',
    bottomDark: '#111111',
    shoe: '#f2f2f2',
    sole: '#111111',
    longLegs: false,
    longArms: false,
    extra: (r, f) => f !== 'slide' && r(16, 7, 8, 2, '#f2f2f2'),
  },
  spacesuit: {
    top: '#e8ecf2',
    topDark: '#a9b4c4',
    bottom: '#e8ecf2',
    bottomDark: '#a9b4c4',
    shoe: '#5c5c5c',
    sole: '#2d2d2d',
    longLegs: true,
    longArms: true,
    hands: '#5c5c5c',
    extra: (r, f) => (f === 'slide' ? r(8, 24, 12, 2, '#f08a24') : r(14, 9, 12, 2, '#f08a24')),
  },
  labcoat: {
    top: '#f2f2f2',
    topDark: '#c4c4c4',
    bottom: '#3a3a3a',
    bottomDark: '#222222',
    shoe: '#5f4130',
    sole: '#231914',
    longLegs: true,
    longArms: true,
    extra: (r, f) => f !== 'slide' && r(19, 2, 3, 12, '#6fb36a'),
  },
};

export const OUTFIT_LABELS: Record<OutfitId, string> = {
  tee: 'T-shirt',
  hoodie: 'Hoodie',
  skater: 'Skater',
  spacesuit: 'Space suit',
  labcoat: 'Lab coat',
};

/** Run cycle: forward offset of the front leg (back leg mirrors it). */
const STRIDE = [5, 1, -4, 1];

export function drawBodySheet(outfit: OutfitId, skin: string): HTMLCanvasElement {
  const o = OUTFITS[outfit];
  const c = document.createElement('canvas');
  c.width = BODY_W * BODY_FRAMES.length;
  c.height = BODY_H;
  const ctx = c.getContext('2d')!;
  const legSkin = o.longLegs ? o.bottom : skin;
  const armSkin = o.longArms ? o.top : skin;
  const hand = o.hands ?? skin;

  BODY_FRAMES.forEach((frame, i) => {
    const ox = i * BODY_W;
    const r: Rect = (x, y, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, y, w, h);
    };

    if (frame === 'slide') {
      // Leaning back, feet first.
      r(1, 27, 8, 3, o.longArms ? o.topDark : skin); // back arm on the ground
      r(0, 28, 3, 3, hand);
      r(6, 22, 16, 8, o.top);
      r(6, 28, 16, 2, o.topDark);
      r(6, 21, 4, 3, skin); // neck
      r(21, 23, 9, 6, o.bottom);
      r(29, 25, 6, 4, legSkin);
      r(34, 26, 6, 4, o.shoe);
      r(34, 30, 6, 2, o.sole);
      o.extra?.(r, frame);
      return;
    }

    const isJump = frame === 'jump';
    const stride = isJump ? 0 : STRIDE[i];
    const lift = (i === 1 || i === 3) && !isJump;

    // back arm
    const ba = isJump ? 4 : Math.round(stride * 0.6);
    r(15 + ba / 2, 4, 4, 5, o.topDark);
    r(15 + ba, 9, 3, 4, o.longArms ? o.topDark : skin);
    r(15 + ba, 13, 3, 2, hand);

    // back leg
    if (isJump) {
      r(15, 20, 5, 4, o.bottomDark);
      r(17, 23, 4, 4, legSkin);
      r(17, 27, 6, 3, o.shoe);
    } else {
      const bx = 16 - stride;
      r(16 - stride / 2, 20, 4, 5, o.bottomDark);
      r(bx, 24, 4, lift ? 3 : 5, o.longLegs ? o.bottomDark : legSkin);
      r(bx, lift ? 27 : 29, 6, 3, o.shoe);
      if (!lift) r(bx, 31, 6, 1, o.sole);
    }

    // torso + neck
    r(18, 0, 4, 3, skin);
    r(14, 2, 12, 15, o.top);
    r(14, 2, 2, 15, o.topDark);
    r(14, 16, 12, 5, o.bottom);
    r(14, 16, 2, 5, o.bottomDark);

    // front leg
    if (isJump) {
      r(19, 20, 6, 4, o.bottom);
      r(23, 23, 4, 4, legSkin);
      r(24, 26, 6, 3, o.shoe);
      r(24, 29, 6, 1, o.sole);
    } else {
      const fx = 19 + stride;
      r(19 + stride / 2, 20, 4, 5, o.bottom);
      r(fx, 24, 4, 5, legSkin);
      r(fx, 29, 6, 2, o.shoe);
      r(fx, 31, 6, 1, o.sole);
    }

    // front arm
    if (isJump) {
      r(22, 5, 8, 3, o.top);
      r(30, 5, 3, 3, hand);
    } else {
      const fa = -Math.round(stride * 0.6);
      r(21 + fa / 2, 4, 4, 5, o.top);
      r(22 + fa, 9, 3, 4, armSkin);
      r(22 + fa, 13, 3, 2, hand);
    }
    o.extra?.(r, frame);
  });
  return c;
}
