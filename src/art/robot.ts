/**
 * The chasing robot, drawn in code from a small skeleton (like the player's
 * body): heavy 8-frame stomp, swinging arms, a scanning red eye, a blinking
 * antenna and a pulsing chest light. Extra poses: laser (arm cannon forward),
 * throw (arm up) and zapped (teleported away).
 */
import { along, PixelGrid, type P } from './pixelGrid';

export const ROBOT_W = 96;
export const ROBOT_H = 112;
export const ROBOT_FRAMES = [
  'walk0',
  'walk1',
  'walk2',
  'walk3',
  'walk4',
  'walk5',
  'walk6',
  'walk7',
  'laser',
  'throw',
  'zapped',
] as const;
export type RobotFrame = (typeof ROBOT_FRAMES)[number];
export const ROBOT_WALK = ROBOT_FRAMES.slice(0, 8) as RobotFrame[];

const C = {
  steel: '#9a9fbb',
  steelDark: '#6f7494',
  steelDeep: '#4a4e6e',
  light: '#c8cce0',
  red: '#d84b4b',
  glow: '#ff5a5a',
  glowHot: '#ffd0d0',
  yellow: '#e8c547',
  visor: '#14121c',
};

interface Pose {
  bob: number;
  legF: number;
  legB: number;
  kneeF: number;
  kneeB: number;
  armF: number;
  armB: number;
  elbowF: number;
  eyeX: number;
  antenna: boolean;
  chest: boolean;
  cannon?: boolean;
}

function walkPose(i: number): Pose {
  const p = (i / 8) * Math.PI * 2;
  const s = Math.sin(p);
  return {
    bob: Math.round(Math.abs(Math.cos(p)) * 3),
    legF: 0.5 * s,
    legB: -0.5 * s,
    kneeF: 0.2 + 0.7 * Math.max(0, Math.cos(p)),
    kneeB: 0.2 + 0.7 * Math.max(0, -Math.cos(p)),
    armF: -0.45 * s,
    armB: 0.45 * s,
    elbowF: 0.6,
    eyeX: Math.round(Math.sin(p) * 4),
    antenna: i % 4 < 2,
    chest: i % 2 === 0,
  };
}

function pose(f: RobotFrame): Pose {
  if (f.startsWith('walk')) return walkPose(Number(f.slice(4)));
  if (f === 'laser')
    return {
      ...walkPose(0),
      armF: 1.6,
      elbowF: 0,
      eyeX: 5,
      cannon: true,
      antenna: true,
      chest: true,
    };
  if (f === 'throw')
    return { ...walkPose(2), armF: 2.7, elbowF: 0.3, eyeX: 3, antenna: true, chest: true };
  return { ...walkPose(0), armF: 2.4, armB: -2.4, eyeX: 0, antenna: true, chest: true };
}

function drawFrame(ctx: CanvasRenderingContext2D, ox: number, f: RobotFrame) {
  const g = new PixelGrid(ROBOT_W, ROBOT_H);
  const ps = pose(f);
  const ground = ROBOT_H - 2;
  const hip: P = { x: 46, y: 80 - ps.bob };

  const leg = (a: number, knee: number, back: boolean) => {
    const k = along(hip, a, 14);
    const ankle = along(k, a - knee, 14);
    const shade = back ? C.steelDeep : C.steelDark;
    g.line(hip, k, 5, back ? C.steelDark : C.steel);
    g.disc(k.x, k.y, 4.5, shade);
    g.line(k, { x: ankle.x, y: Math.min(ankle.y, ground - 6) }, 4, back ? C.steelDark : C.steel);
    const fy = Math.min(ankle.y, ground - 6);
    g.rect(ankle.x - 8, fy, 18, 7, shade);
    g.rect(ankle.x - 8, fy + 5, 18, 2, C.visor);
  };
  const shoulderB: P = { x: 25, y: hip.y - 36 };
  const shoulderF: P = { x: 68, y: hip.y - 36 };
  const arm = (s: P, a: number, elbow: number, back: boolean, cannon = false) => {
    const e = along(s, a, 16);
    const h = along(e, a + elbow, cannon ? 20 : 15);
    g.line(s, e, 4.5, back ? C.steelDark : C.steel);
    g.disc(e.x, e.y, 4, back ? C.steelDeep : C.steelDark);
    g.line(e, h, 4, back ? C.steelDark : C.steel);
    if (cannon) {
      g.line(h, along(h, a, 6), 5, C.steelDeep);
      g.disc(along(h, a, 8).x, along(h, a, 8).y, 3, C.glow);
    } else {
      g.disc(h.x, h.y, 5, back ? C.steelDeep : C.steelDark); // claw
      g.dot(h.x + 3, h.y + 4, C.visor);
    }
  };

  // back limbs
  arm(shoulderB, ps.armB, 0.6, true);
  leg(ps.legB, ps.kneeB, true);

  // torso: boxy, rounded, shaded, with a chest light
  const top = hip.y - 42;
  g.rect(24, top, 46, 44, C.steel);
  g.rect(24, top, 46, 4, C.light);
  g.rect(24, top + 38, 46, 6, C.steelDark);
  g.rect(24, top, 5, 44, C.steelDark);
  g.disc(47, top + 20, 7, C.steelDeep);
  g.disc(47, top + 20, 4.5, ps.chest ? C.glow : C.red);
  if (ps.chest) g.dot(46, top + 18, C.glowHot);
  for (const x of [31, 59]) g.rect(x, top + 8, 4, 4, C.yellow); // rivets
  // hazard stripe
  for (let x = 24; x < 70; x += 8) {
    g.rect(x, top + 33, 4, 5, C.yellow);
    g.rect(x + 4, top + 33, 4, 5, C.visor);
  }
  // shoulder pads
  g.disc(shoulderB.x, shoulderB.y, 7, C.steelDark);
  g.disc(shoulderF.x, shoulderF.y, 7, C.steel);
  g.disc(shoulderF.x - 1, shoulderF.y - 2, 3, C.light);

  // head: visor with one scanning eye, antenna
  const headTop = top - 26;
  g.rect(30, headTop, 36, 26, C.steel);
  g.rect(30, headTop, 36, 3, C.light);
  g.rect(30, headTop, 4, 26, C.steelDark);
  g.rect(35, headTop + 8, 27, 10, C.visor);
  const ex = 48 + ps.eyeX;
  g.rect(ex - 4, headTop + 10, 9, 6, f === 'zapped' ? C.yellow : C.glow);
  g.rect(ex - 2, headTop + 11, 3, 2, C.glowHot);
  for (let x = 39; x < 58; x += 4) g.rect(x, headTop + 20, 2, 4, C.steelDeep); // mouth grill
  g.rect(46, headTop - 9, 3, 9, C.steelDark);
  g.disc(47.5, headTop - 11, 3, ps.antenna ? C.glow : C.red);

  // front limbs
  leg(ps.legF, ps.kneeF, false);
  arm(shoulderF, ps.armF, ps.elbowF, false, ps.cannon);

  g.outline();
  if (f === 'zapped') {
    // teleport: horizontal glitch bands
    for (let y = 0; y < ROBOT_H; y += 6) {
      for (let x = 0; x < ROBOT_W; x++)
        if (g.cells[y * ROBOT_W + x]) g.cells[y * ROBOT_W + x] = '#9cf3ff';
    }
  }
  g.drawTo(ctx, ox);
}

export function drawRobotSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = ROBOT_W * ROBOT_FRAMES.length;
  c.height = ROBOT_H;
  const ctx = c.getContext('2d')!;
  ROBOT_FRAMES.forEach((f, i) => drawFrame(ctx, i * ROBOT_W, f));
  return c;
}
