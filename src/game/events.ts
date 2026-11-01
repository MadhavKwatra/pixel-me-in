/** Messages between the Phaser game and the HTML UI (sent on game.events). */
export const EVENTS = {
  ready: 'pmi:ready',
  hud: 'pmi:hud',
  zone: 'pmi:zone',
  hint: 'pmi:hint',
  chase: 'pmi:chase',
  over: 'pmi:gameover',
  pause: 'pmi:pauseRequest',
} as const;

export type HintKind = 'jump' | 'slide' | 'again' | 'done';

export interface HudData {
  metres: number;
  gears: number;
  power: 'shield' | 'magnet' | 'jetpack' | null;
  /** 0..1 time left for timed power-ups. */
  powerLeft: number;
  force: boolean;
}

export interface GameOverData {
  metres: number;
  gears: number;
}

export interface RunConfig {
  seed: number;
  slowMode: boolean;
  reducedMotion: boolean;
  vibration: boolean;
  tutorial: boolean;
  debug: boolean;
}
