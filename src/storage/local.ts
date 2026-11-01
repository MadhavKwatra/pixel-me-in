/**
 * Settings and scores in localStorage. All keys start with "pmi:" so
 * "Delete my data" (faceStore.clearAllData) can find and remove them.
 */

export interface Settings {
  muted: boolean;
  music: boolean;
  reducedMotion: boolean;
  slowMode: boolean;
  vibration: boolean;
  tutorialDone: boolean;
  /** On-screen Jump/Slide buttons: auto = upright phones only. */
  touchButtons: 'auto' | 'always' | 'never';
  portraitTipShown: boolean;
}

export interface Stats {
  best: number;
  totalGears: number;
  totalDistance: number;
  runs: number;
}

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the game still works, it just forgets.
  }
}

export function getSettings(): Settings {
  return read<Settings>('pmi:settings', {
    muted: false,
    music: true,
    reducedMotion: prefersReducedMotion(),
    slowMode: false,
    vibration: true,
    tutorialDone: false,
    touchButtons: 'auto',
    portraitTipShown: false,
  });
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  write('pmi:settings', next);
  return next;
}

export function getStats(): Stats {
  return read<Stats>('pmi:stats', { best: 0, totalGears: 0, totalDistance: 0, runs: 0 });
}

/** Record a finished run. Returns the new stats and whether it was a new best. */
export function recordRun(distance: number, gears: number): { stats: Stats; newBest: boolean } {
  const s = getStats();
  const newBest = distance > s.best;
  const stats: Stats = {
    best: Math.max(s.best, distance),
    totalGears: s.totalGears + gears,
    totalDistance: s.totalDistance + distance,
    runs: s.runs + 1,
  };
  write('pmi:stats', stats);
  return { stats, newBest };
}
