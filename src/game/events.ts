/** Messages between the Phaser game and the HTML UI (sent on game.events). */
export const EVENTS = {
  ready: 'pmi:ready',
  hud: 'pmi:hud',
  zone: 'pmi:zone',
  hint: 'pmi:hint',
  chase: 'pmi:chase',
  over: 'pmi:gameover',
  pause: 'pmi:pauseRequest',
  /** Big centre text: "Ready", "GO!". */
  announce: 'pmi:announce',
  /** Touch input from the HTML layer (see src/ui/gestures.ts). */
  input: 'pmi:input',
} as const;

export type HintKind =
  'jump' | 'slide' | 'double' | 'power' | 'nice' | 'again' | 'done' | 'laser' | 'bomb';

/** Robot state for the HUD: rush at the end of a zone, close behind after a stumble. */
export type ChaseKind = 'rush' | 'close' | null;

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
  /** Debug only: start the run at this many metres (e.g. just before a Robot Rush). */
  startAt?: number;
  /** Demo/video only: the game plays itself for this many ms, then stops dodging. */
  autopilotMs?: number;
}
