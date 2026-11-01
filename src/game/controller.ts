/**
 * The only door between the HTML UI and Phaser. The UI never touches scenes
 * directly; it calls these functions and listens to EVENTS.
 */
import Phaser from 'phaser';
import { BODY_FRAMES, BODY_H, BODY_W } from '../art/body';
import { VIEW_H, VIEW_W } from '../config';
import { EVENTS, type RunConfig } from './events';
import { BootScene } from './scenes/BootScene';
import { RunScene } from './scenes/RunScene';

let game: Phaser.Game | null = null;
let ready: Promise<void> | null = null;

export function ensureGame(parent: HTMLElement): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_W,
      height: VIEW_H,
      backgroundColor: '#1b1f3b',
      pixelArt: true,
      roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1900 }, debug: false } },
      input: { gamepad: true, activePointers: 3 },
      audio: { noAudio: true }, // sounds come from src/audio/sfx.ts
      banner: false,
      scene: [BootScene, RunScene],
    });
    game.events.once(EVENTS.ready, () => resolve());
  });
  return ready;
}

export function getGame(): Phaser.Game {
  if (!game) throw new Error('Game not created yet');
  return game;
}

/** Put the player's avatar into the game as textures 'head' and 'body'. */
export function setAvatarTextures(
  head: HTMLCanvasElement,
  bodySheet: HTMLCanvasElement,
  headPivot: { x: number; y: number },
) {
  const g = getGame();
  g.registry.set('headPivot', headPivot);
  if (g.scene.isActive('run') || g.scene.isPaused('run')) g.scene.stop('run');
  for (const key of ['head', 'body']) if (g.textures.exists(key)) g.textures.remove(key);
  g.textures.addCanvas('head', head);
  const body = g.textures.addCanvas('body', bodySheet);
  BODY_FRAMES.forEach((name, i) => body?.add(name, 0, i * BODY_W, 0, BODY_W, BODY_H));
}

export function startRun(cfg: RunConfig) {
  const g = getGame();
  if (g.scene.isActive('run') || g.scene.isPaused('run')) g.scene.stop('run');
  g.scene.start('run', cfg);
}

export function pauseRun() {
  const g = getGame();
  if (g.scene.isActive('run')) g.scene.pause('run');
}

export function resumeRun() {
  const g = getGame();
  if (g.scene.isPaused('run')) g.scene.resume('run');
}

export function stopRun() {
  const g = getGame();
  if (g.scene.isActive('run') || g.scene.isPaused('run')) g.scene.stop('run');
}

export function isRunning(): boolean {
  return !!game && game.scene.isActive('run');
}

export function onGame<T>(event: string, fn: (data: T) => void) {
  getGame().events.on(event, fn);
}
