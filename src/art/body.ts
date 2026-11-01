/**
 * The pixel body under the big head, drawn in code from a tiny skeleton.
 *
 * Each frame is a pose (joint angles). Limbs are drawn as thick pixel lines,
 * back limbs in a darker shade, then a dark outline goes around everything –
 * the classic 2D game sprite look. Angles: 0 = hanging straight down,
 * positive = swung forward (the runner faces right).
 */
import type { OutfitId } from '../face/faceStore';

export const BODY_W = 40;
export const BODY_H = 36;
const GROUND = BODY_H - 1;

export const BODY_FRAMES = [
  'run0',
  'run1',
  'run2',
  'run3',
  'run4',
  'run5',
  'run6',
  'run7',
  'idle',
  'jump',
  'fall',
  'land',
  'slide',
  'hurt',
] as const;
export type BodyFrame = (typeof BODY_FRAMES)[number];
export const RUN_FRAMES = BODY_FRAMES.slice(0, 8) as BodyFrame[];

interface Limb {
  /** Upper segment angle (thigh / upper arm). */
  a: number;
  /** Bend of the lower segment (knee bends back, elbow bends forward). */
  bend: number;
}

interface Pose {
  lean: number;
  legF: Limb;
  legB: Limb;
  armF: Limb;
  armB: Limb;
  /** Keep the feet on the ground (false for jump/fall). */
  grounded: boolean;
}

const THIGH = 7;
const SHIN = 7;
const TORSO = 12;
const UPPER_ARM = 6;
const FOREARM = 5;
const HIP_X = 17;

function runPose(i: number): Pose {
  const p = (i / 8) * Math.PI * 2;
  const s = Math.sin(p);
  const c = Math.cos(p);
  return {
    lean: 0.18,
    legF: { a: 0.65 * s, bend: 0.25 + 1.1 * Math.max(0, c) },
    legB: { a: -0.65 * s, bend: 0.25 + 1.1 * Math.max(0, -c) },
    armF: { a: -0.8 * s, bend: 1.3 },
    armB: { a: 0.8 * s, bend: 1.3 },
    grounded: true,
  };
}

const POSES: Record<BodyFrame, Pose> = {
  run0: runPose(0),
  run1: runPose(1),
  run2: runPose(2),
  run3: runPose(3),
  run4: runPose(4),
  run5: runPose(5),
  run6: runPose(6),
  run7: runPose(7),
  idle: {
    lean: 0,
    legF: { a: 0.08, bend: 0.1 },
    legB: { a: -0.08, bend: 0.1 },
    armF: { a: 0.15, bend: 0.4 },
    armB: { a: -0.15, bend: 0.4 },
    grounded: true,
  },
  jump: {
    lean: 0.12,
    legF: { a: 1.0, bend: 1.7 },
    legB: { a: 0.15, bend: 1.3 },
    armF: { a: 1.9, bend: 0.3 },
    armB: { a: -0.9, bend: 0.6 },
    grounded: false,
  },
  fall: {
    lean: 0,
    legF: { a: 0.45, bend: 0.5 },
    legB: { a: -0.35, bend: 0.7 },
    armF: { a: 2.0, bend: 0.2 },
    armB: { a: 2.2, bend: 0.2 },
    grounded: false,
  },
  land: {
    lean: 0.35,
    legF: { a: 0.75, bend: 1.5 },
    legB: { a: -0.15, bend: 1.2 },
    armF: { a: 0.7, bend: 1.0 },
    armB: { a: -0.5, bend: 0.8 },
    grounded: true,
  },
  slide: {
    lean: -1.15,
    legF: { a: 1.5, bend: 0.05 },
    legB: { a: 1.3, bend: 0.4 },
    armF: { a: 1.0, bend: 0.5 },
    armB: { a: -0.4, bend: 0.1 },
    grounded: true,
  },
  hurt: {
    lean: -0.25,
    legF: { a: 0.5, bend: 0.3 },
    legB: { a: -0.5, bend: 0.3 },
    armF: { a: 2.0, bend: 0.4 },
    armB: { a: -2.0, bend: 0.4 },
    grounded: false,
  },
};

interface P {
  x: number;
  y: number;
}

const along = (from: P, angle: number, len: number): P => ({
  x: from.x + Math.sin(angle) * len,
  y: from.y + Math.cos(angle) * len,
});

/** Joint positions for a frame (pure math, no drawing). */
export function layout(frame: BodyFrame) {
  const pose = POSES[frame];
  const leg = (l: Limb, hip: P) => {
    const knee = along(hip, l.a, THIGH);
    const ankle = along(knee, l.a - l.bend, SHIN);
    return { hip, knee, ankle, footAngle: (l.a - l.bend) * 0.4 };
  };
  const build = (hipY: number) => {
    const hip = { x: HIP_X, y: hipY };
    const neck = along(hip, Math.PI - pose.lean, TORSO);
    const shoulder = along(hip, Math.PI - pose.lean, TORSO - 2);
    const arm = (l: Limb) => {
      const elbow = along(shoulder, l.a, UPPER_ARM);
      const hand = along(elbow, l.a + l.bend, FOREARM);
      return { shoulder, elbow, hand };
    };
    return {
      hip,
      neck,
      legF: leg(pose.legF, hip),
      legB: leg(pose.legB, hip),
      armF: arm(pose.armF),
      armB: arm(pose.armB),
    };
  };
  // Stand straight: hip high enough for straight legs + feet.
  let j = build(GROUND - 3 - THIGH - SHIN);
  if (pose.grounded) {
    // Put the lowest point (a foot or, when sliding, the hip) on the ground.
    const low = Math.max(j.legF.ankle.y, j.legB.ankle.y) + 2;
    const lowest = Math.max(low, j.hip.y + 4);
    j = build(j.hip.y + (GROUND - lowest));
  }
  return { ...j, lean: pose.lean };
}

/** Where the head attaches in each frame, and how much the body leans. */
export const NECK: Record<BodyFrame, P> = Object.fromEntries(
  BODY_FRAMES.map((f) => {
    const n = layout(f).neck;
    return [f, { x: Math.round(n.x), y: Math.round(n.y) }];
  }),
) as Record<BodyFrame, P>;

export const LEAN: Record<BodyFrame, number> = Object.fromEntries(
  BODY_FRAMES.map((f) => [f, POSES[f].lean]),
) as Record<BodyFrame, number>;

// ------------------------------------------------------------------ drawing

interface Colours {
  top: string;
  topDark: string;
  bottom: string;
  bottomDark: string;
  shoe: string;
  shoeDark: string;
  longLegs: boolean;
  longArms: boolean;
  hands?: string;
  /** Extra details on the torso (stripe, pocket, ...). */
  extra?: (dot: (x: number, y: number, c: string) => void, hip: P, neck: P) => void;
}

const OUTFITS: Record<OutfitId, Colours> = {
  tee: {
    top: '#2bb3a3',
    topDark: '#1d7f74',
    bottom: '#c9a46a',
    bottomDark: '#9c7c48',
    shoe: '#f2f2f2',
    shoeDark: '#b8b8b8',
    longLegs: false,
    longArms: false,
    extra: (dot, hip, neck) => stripe(dot, hip, neck, 0.5, '#f2f2f2'),
  },
  hoodie: {
    top: '#8e4fb3',
    topDark: '#62307f',
    bottom: '#2e4a7d',
    bottomDark: '#1f3357',
    shoe: '#2d2d2d',
    shoeDark: '#111111',
    longLegs: true,
    longArms: true,
    extra: (dot, hip, neck) => stripe(dot, hip, neck, 0.25, '#62307f'),
  },
  skater: {
    top: '#d84b4b',
    topDark: '#9e2f2f',
    bottom: '#2d2d2d',
    bottomDark: '#111111',
    shoe: '#f2f2f2',
    shoeDark: '#b8b8b8',
    longLegs: false,
    longArms: false,
    extra: (dot, hip, neck) => stripe(dot, hip, neck, 0.7, '#e8c547'),
  },
  spacesuit: {
    top: '#e8ecf2',
    topDark: '#a9b4c4',
    bottom: '#e8ecf2',
    bottomDark: '#a9b4c4',
    shoe: '#5c5c5c',
    shoeDark: '#2d2d2d',
    longLegs: true,
    longArms: true,
    hands: '#5c5c5c',
    extra: (dot, hip, neck) => stripe(dot, hip, neck, 0.55, '#f08a24'),
  },
  labcoat: {
    top: '#f2f2f2',
    topDark: '#c4c4c4',
    bottom: '#3a3a3a',
    bottomDark: '#222222',
    shoe: '#5f4130',
    shoeDark: '#3d2a1e',
    longLegs: true,
    longArms: true,
    extra: (dot, hip, neck) => {
      // open coat: a green shirt shows in the middle
      for (let t = 0.15; t <= 0.85; t += 0.08) {
        const p = lerp(hip, neck, t);
        dot(Math.round(p.x + 1), Math.round(p.y), '#6fb36a');
      }
    },
  },
};

export const OUTFIT_LABELS: Record<OutfitId, string> = {
  tee: 'T-shirt',
  hoodie: 'Hoodie',
  skater: 'Skater',
  spacesuit: 'Space suit',
  labcoat: 'Lab coat',
};

const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** A horizontal band across the torso at height t (0 = hip, 1 = neck). */
function stripe(
  dot: (x: number, y: number, c: string) => void,
  hip: P,
  neck: P,
  t: number,
  c: string,
) {
  const p = lerp(hip, neck, t);
  for (let dx = -4; dx <= 4; dx++) dot(Math.round(p.x + dx), Math.round(p.y), c);
}

const OUTLINE = '#14121c';

function drawFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  frame: BodyFrame,
  o: Colours,
  skin: string,
  skinDark: string,
) {
  const j = layout(frame);
  const W = BODY_W;
  // Draw into a small pixel grid first, so we can outline it afterwards.
  const grid: (string | null)[] = new Array(W * BODY_H).fill(null);
  const dot = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < BODY_H) grid[y * W + x] = c;
  };
  const disc = (cx: number, cy: number, r: number, c: string) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) dot(x, y, c);
      }
    }
  };
  const line = (a: P, b: P, r: number, c: string) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let i = 0; i <= steps; i++) {
      const p = lerp(a, b, i / steps);
      disc(p.x, p.y, r, c);
    }
  };
  const foot = (ankle: P, angle: number, c: string, sole: string) => {
    const toe = { x: ankle.x + Math.cos(angle) * 4, y: ankle.y + 1 + Math.sin(angle) * 4 };
    line({ x: ankle.x - 0.5, y: ankle.y + 1 }, toe, 1.6, c);
    line({ x: ankle.x - 0.5, y: ankle.y + 2.4 }, { x: toe.x, y: toe.y + 1.4 }, 0.6, sole);
  };
  const legColours = (back: boolean) => ({
    thigh: back ? o.bottomDark : o.bottom,
    shin: o.longLegs ? (back ? o.bottomDark : o.bottom) : back ? skinDark : skin,
    shoe: back ? o.shoeDark : o.shoe,
  });
  const armColours = (back: boolean) => ({
    upper: back ? o.topDark : o.top,
    fore: o.longArms ? (back ? o.topDark : o.top) : back ? skinDark : skin,
    hand: o.hands ?? (back ? skinDark : skin),
  });

  // back arm + back leg
  const ab = armColours(true);
  line(j.armB.shoulder, j.armB.elbow, 1.6, ab.upper);
  line(j.armB.elbow, j.armB.hand, 1.3, ab.fore);
  disc(j.armB.hand.x, j.armB.hand.y, 1.6, ab.hand);
  const lb = legColours(true);
  line(j.legB.hip, j.legB.knee, 2, lb.thigh);
  line(j.legB.knee, j.legB.ankle, 1.6, lb.shin);
  foot(j.legB.ankle, j.legB.footAngle, lb.shoe, OUTLINE);

  // torso, with a shaded back edge and a neck
  line(j.hip, j.neck, 4.6, o.top);
  const back = { x: -Math.cos(j.lean) * 3, y: -Math.sin(j.lean) * 3 };
  line(
    { x: j.hip.x + back.x, y: j.hip.y + back.y },
    { x: j.neck.x + back.x, y: j.neck.y + back.y },
    1.4,
    o.topDark,
  );
  disc(j.hip.x, j.hip.y, 4.4, o.bottom);
  o.extra?.(dot, j.hip, j.neck);
  disc(j.neck.x, j.neck.y - 1, 1.6, skin);

  // front leg + front arm
  const lf = legColours(false);
  line(j.legF.hip, j.legF.knee, 2, lf.thigh);
  line(j.legF.knee, j.legF.ankle, 1.6, lf.shin);
  foot(j.legF.ankle, j.legF.footAngle, lf.shoe, OUTLINE);
  const af = armColours(false);
  line(j.armF.shoulder, j.armF.elbow, 1.6, af.upper);
  line(j.armF.elbow, j.armF.hand, 1.3, af.fore);
  disc(j.armF.hand.x, j.armF.hand.y, 1.6, af.hand);

  // outline: any empty pixel next to a filled one
  const outlined = grid.slice();
  for (let y = 0; y < BODY_H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y * W + x]) continue;
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([xx, yy]) => xx >= 0 && yy >= 0 && xx < W && yy < BODY_H && grid[yy * W + xx]);
      if (near) outlined[y * W + x] = OUTLINE;
    }
  }
  for (let y = 0; y < BODY_H; y++) {
    for (let x = 0; x < W; x++) {
      const c = outlined[y * W + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, y, 1, 1);
    }
  }
}

/** Darker version of a CSS colour (for the back limbs). */
function shade(css: string, k = 0.72): string {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = css;
  const hex = ctx.fillStyle; // normalized to #rrggbb
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

export function drawBodySheet(outfit: OutfitId, skin: string): HTMLCanvasElement {
  const o = OUTFITS[outfit];
  const c = document.createElement('canvas');
  c.width = BODY_W * BODY_FRAMES.length;
  c.height = BODY_H;
  const ctx = c.getContext('2d')!;
  const skinDark = shade(skin);
  BODY_FRAMES.forEach((frame, i) => drawFrame(ctx, i * BODY_W, frame, o, skin, skinDark));
  return c;
}
