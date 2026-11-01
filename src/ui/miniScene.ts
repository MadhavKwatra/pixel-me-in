/**
 * A tiny animated scene (no game engine): the character runs on a scrolling
 * backyard. Used on the landing page, the menu and the loading screens.
 * With reduced motion it shows one still frame.
 */
import { RUN_FRAMES } from '../art/body';
import { GROUND_TILE, LAYER_SIZE, paint, ZONES } from '../art/world';
import { DEFAULT_AVATAR, type AvatarConfig } from '../face/faceStore';
import { canvasToPixels } from '../face/canvas';
import { drawPreset, presetMeta } from '../face/presets';
import { renderFrames, type FaceData } from '../face/renderAvatar';

const W = 320;
const H = 180;
const GROUND = 150;

export function defaultCharacter(): { face: FaceData; cfg: AvatarConfig } {
  return {
    face: { pixels: canvasToPixels(drawPreset(1)), meta: presetMeta() },
    cfg: { ...DEFAULT_AVATAR, presetId: 1, hat: 'cap' },
  };
}

/** Start the scene in `canvas`. Returns a stop function. */
export function startMiniScene(
  canvas: HTMLCanvasElement,
  face: FaceData,
  cfg: AvatarConfig,
  reducedMotion: boolean,
  zone = 0,
): () => void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const z = ZONES[zone % ZONES.length];
  const sky = paint(W, H, z.sky);
  const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.far);
  const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.mid);
  const ground = paint(GROUND_TILE.w, GROUND_TILE.h, z.ground);
  const frames = renderFrames(face, cfg, 1, RUN_FRAMES);

  let t = 0;
  let last = performance.now();
  let raf = 0;
  const draw = () => {
    ctx.drawImage(sky, 0, 0);
    const tile = (img: HTMLCanvasElement, speed: number, y: number) => {
      const off = -((t * speed) % img.width);
      for (let x = off; x < W; x += img.width) ctx.drawImage(img, Math.round(x), y);
    };
    tile(far, 8, GROUND - LAYER_SIZE.h - 10);
    tile(mid, 24, GROUND - LAYER_SIZE.h + 10);
    tile(ground, 70, GROUND);
    const f = frames[Math.floor(t * 12) % frames.length];
    ctx.drawImage(f, 70, GROUND - f.height + 1);
  };
  const loop = (now: number) => {
    // rAF time can be slightly before performance.now() on the first frame.
    t += Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    draw();
    raf = requestAnimationFrame(loop);
  };
  if (reducedMotion) draw();
  else raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
