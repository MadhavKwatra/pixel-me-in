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

export function pickPattern(rng: () => number, distance: number, powerActive: boolean): Pattern {
  if (distance > 150 && !powerActive && rng() < 0.06) return 'power';
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

/** First-run tutorial: fixed, gentle patterns. */
export const TUTORIAL_PATTERNS: Pattern[] = ['lowGears', 'highGears', 'low'];

export type PowerId = 'shield' | 'magnet' | 'jetpack';
export const POWERS: PowerId[] = ['shield', 'magnet', 'jetpack'];
export const POWER_SECONDS: Record<PowerId, number> = { shield: Infinity, magnet: 8, jetpack: 5 };

export function metres(px: number, pxPerMetre: number): number {
  return Math.floor(px / pxPerMetre);
}
