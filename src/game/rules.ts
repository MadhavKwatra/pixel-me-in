/**
 * Pure game rules (no Phaser), so balance changes can be unit-tested.
 * Distances are in metres unless the name says Px.
 */
import { ZONE_LENGTH_M } from '../config';

/** Seeded random numbers (mulberry32). Same seed = same run (for a future Daily Run). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const START_SPEED = 230;
export const MAX_SPEED = 520;

/** World speed in px/s. Slow mode is an accessibility option. */
export function speedAt(distance: number, slowMode = false): number {
  const s = Math.min(MAX_SPEED, START_SPEED + distance * 0.12);
  return slowMode ? s * 0.75 : s;
}

/** 0 at the start, 1 at top speed. */
export function difficulty(distance: number): number {
  return Math.min(1, (speedAt(distance) - START_SPEED) / (MAX_SPEED - START_SPEED));
}

export function zoneIndexAt(distance: number): number {
  return Math.floor(distance / ZONE_LENGTH_M);
}

export const BOSS_CHASE_M = 90;

/** The robot chases you during the last stretch of every zone. */
export function isBossChase(distance: number): boolean {
  return distance % ZONE_LENGTH_M >= ZONE_LENGTH_M - BOSS_CHASE_M;
}

/**
 * Pixels until the next pattern. Based on time, so it stays fair as speed rises:
 * the player always gets at least ~0.8 s between patterns.
 */
export function nextGapPx(
  rng: () => number,
  distance: number,
  chase: boolean,
  slowMode = false,
): number {
  const d = difficulty(distance);
  let seconds = 1.7 - 0.75 * d; // 1.7 s -> 0.95 s
  seconds *= 0.85 + rng() * 0.45;
  if (chase) seconds *= 0.8;
  seconds = Math.max(0.8, seconds);
  return seconds * speedAt(distance, slowMode);
}

export type Pattern =
  'low' | 'crate' | 'high' | 'lowLow' | 'lowGears' | 'highGears' | 'gearsLine' | 'power';

/** The first power-up comes early (and is part of the tutorial)… */
export const FIRST_POWER_M = 120;
/** …and after that, never more than this many metres without one. */
export const POWER_PITY_M = 250;
const POWER_CHANCE = 0.1;

/**
 * Pick the next pattern. `lastPowerM` is where the last power-up spawned
 * (start a run with FIRST_POWER_M - POWER_PITY_M so the first one lands at FIRST_POWER_M).
 */
export function pickPattern(
  rng: () => number,
  distance: number,
  powerActive: boolean,
  lastPowerM = -Infinity,
): Pattern {
  if (!powerActive) {
    if (distance - lastPowerM >= POWER_PITY_M) return 'power';
    if (distance > FIRST_POWER_M && rng() < POWER_CHANCE) return 'power';
  }
  const d = difficulty(distance);
  const table: [Pattern, number][] = [
    ['low', 3],
    ['crate', 2],
    ['high', 1 + 2 * Math.min(1, distance / 200)],
    ['lowGears', 2],
    ['highGears', 1.5 * Math.min(1, distance / 200)],
    ['gearsLine', 1.5],
    ['lowLow', 2 * d],
  ];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [p, w] of table) {
    roll -= w;
    if (roll <= 0) return p;
  }
  return 'low';
}

/** What the player must do in each tutorial lesson. */
export type LessonAction = 'jump' | 'slide' | 'double' | 'power';

export interface Lesson {
  pattern: Pattern | 'doubleGears' | 'tutorialPower';
  action: LessonAction;
}

/** First-run tutorial: one lesson per move. Time slows down until the player does it. */
export const TUTORIAL: Lesson[] = [
  { pattern: 'low', action: 'jump' },
  { pattern: 'high', action: 'slide' },
  { pattern: 'doubleGears', action: 'double' },
  { pattern: 'tutorialPower', action: 'power' },
];

export type PowerId = 'shield' | 'magnet' | 'jetpack';
export const POWERS: PowerId[] = ['shield', 'magnet', 'jetpack'];
export const POWER_SECONDS: Record<PowerId, number> = { shield: Infinity, magnet: 8, jetpack: 5 };

// ---------------------------------------------------------------- RAM

/** Pickups are RAM sticks: 1 GB each, and a rare RGB stick worth 8 GB. */
export type RamKind = 'ram' | 'ramRgb';
export const RAM_RGB_CHANCE = 0.04;
export const RAM_GB: Record<RamKind, number> = { ram: 1, ramRgb: 8 };

export function pickRam(rng: () => number): RamKind {
  return rng() < RAM_RGB_CHANCE ? 'ramRgb' : 'ram';
}

/** GB for one pickup. "Download More RAM" doubles it. */
export function ramValue(kind: RamKind, doubled: boolean): number {
  return RAM_GB[kind] * (doubled ? 2 : 1);
}

/** On a stumble the villain grabs a quarter of the RAM you saved this run. */
export function ramLost(current: number): number {
  return Math.floor(Math.max(0, current) * 0.25);
}

/** Real PC sizes make the best jokes. */
export const RAM_MILESTONES: [number, string][] = [
  [8, '8 GB – enough for one Chrome tab'],
  [16, '16 GB – Chrome can open 3 tabs'],
  [32, '32 GB – gamer status!'],
  [64, '64 GB – the data center is jealous'],
  [128, '128 GB – you ARE the data center'],
  [256, "256 GB – hands off, it's mine!"],
];

/** The milestone crossed when going from `before` to `after` GB (the highest one), if any. */
export function ramMilestone(before: number, after: number): string | null {
  let hit: string | null = null;
  for (const [gb, text] of RAM_MILESTONES) if (before < gb && after >= gb) hit = text;
  return hit;
}

/** 12 → "12 GB", 1536 → "1.5 TB". */
export function formatGB(gb: number): string {
  return gb < 1024 ? `${gb} GB` : `${(gb / 1024).toFixed(1)} TB`;
}

export function metres(px: number, pxPerMetre: number): number {
  return Math.floor(px / pxPerMetre);
}

// ---------------------------------------------------------------- robot

/**
 * Stumble + catch-up (Temple Run / Subway Surfers style, owner's pick 2026-11-02):
 * a crash trips you and the robot runs up right behind you for a while;
 * crash again while it is close = caught.
 */
/** How long the robot stays right behind you after a stumble. */
export const DANGER_MS = 6000;

export function crashOutcome(now: number, dangerUntil: number): 'stumble' | 'caught' {
  return now < dangerUntil ? 'caught' : 'stumble';
}

/** Robot Rush attacks (end of each zone). Warnings are long enough to react. */
export const RUSH_ATTACK_EVERY_MS = 1800;
export const LASER_WARN_MS = 800;
export const LASER_FIRE_MS = 350;
export const BOMB_FLIGHT_MS = 900;

/**
 * Where a thrown bomb is at progress `p` (0 → 1): a straight line from `from`
 * to `to` plus an arc `height` px tall. At p = 1 it is exactly on `to`.
 */
export function bombArc(
  p: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  height: number,
): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, p));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - 4 * height * t * (1 - t),
  };
}

export type RobotAttack = 'laser' | 'bomb';

export function pickAttack(rng: () => number, last: RobotAttack | null): RobotAttack {
  // Never the same attack three times in a row feels fairer; simple: lean towards switching.
  if (last && rng() < 0.65) return last === 'laser' ? 'bomb' : 'laser';
  return rng() < 0.5 ? 'laser' : 'bomb';
}
