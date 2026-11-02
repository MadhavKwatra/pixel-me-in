/**
 * The only door between the HTML UI and Phaser. The UI never touches scenes
 * directly; it calls these functions and listens to EVENTS.
 */
import Phaser from 'phaser';
import { BODY_FRAMES, BODY_H, BODY_W } from '../art/body';
import type { GameInput } from '../ui/gestures';
import { EVENTS, type RunConfig } from './events';
import { BootScene } from './scenes/BootScene';
import { RunScene } from './scenes/RunScene';

let game: Phaser.Game | null = null;
let ready: Promise<void> | null = null;

/**
 * Software WebGL (SwiftShader, llvmpipe – no usable GPU, and headless video
 * recording) sometimes samples the wrong texture in Phaser's multi-texture
 * batch: the face flickered away while running. One texture per batch avoids it.
 */
function softwareGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export function ensureGame(parent: HTMLElement): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      // Full-screen canvas at the device's pixel density (sharp pixel art);
      // RunScene picks the camera zoom for the screen shape (src/game/view.ts).
      width: parentSize(parent).w,
      height: parentSize(parent).h,
      backgroundColor: '#1b1f3b',
      pixelArt: true,
      roundPixels: true,
      maxTextures: softwareGL() ? 1 : -1,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr() },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1900 }, debug: false } },
      input: { gamepad: true, activePointers: 3 },
      audio: { noAudio: true }, // sounds come from src/audio/sfx.ts
      banner: false,
      scene: [BootScene, RunScene],
    });
    game.events.once(EVENTS.ready, () => resolve());
    // Follow the screen size (rotation, resize, browser bars).
    let timer = 0;
    new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const { w, h } = parentSize(parent);
        if (game && (w !== game.scale.width || h !== game.scale.height)) {
          game.scale.setZoom(1 / dpr());
          game.scale.resize(w, h);
        }
      }, 60);
    }).observe(parent);
  });
  return ready;
}

/** Device pixels per CSS pixel, capped for speed. */
function dpr() {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

function parentSize(parent: HTMLElement) {
  const r = parent.getBoundingClientRect();
  return {
    w: Math.max(1, Math.round((r.width || window.innerWidth) * dpr())),
    h: Math.max(1, Math.round((r.height || window.innerHeight) * dpr())),
  };
}

/** Touch gestures and on-screen buttons (handled in the HTML layer) reach the game here. */
export function sendInput(input: GameInput) {
  game?.events.emit(EVENTS.input, input);
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
