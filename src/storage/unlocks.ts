/** Which accessories need to be earned first. Everything else is free. */
import type { Stats } from './local';

interface Rule {
  text: string;
  ok: (s: Stats) => boolean;
}

export const UNLOCK_RULES: Record<string, Rule> = {
  crown: { text: 'Run 1,500 m in one go', ok: (s) => s.best >= 1500 },
  spaceHelmet: { text: 'Reach the space zone (1,500 m)', ok: (s) => s.best >= 1500 },
  glasses3d: { text: 'Save 150 GB of RAM in total', ok: (s) => s.totalGears >= 150 },
  spacesuit: { text: 'Run 5,000 m in total', ok: (s) => s.totalDistance >= 5000 },
  labcoat: { text: 'Play 10 runs', ok: (s) => s.runs >= 10 },
};

export function isUnlocked(id: string, stats: Stats): boolean {
  const rule = UNLOCK_RULES[id];
  return !rule || rule.ok(stats);
}

export function unlockHint(id: string): string | undefined {
  return UNLOCK_RULES[id]?.text;
}
