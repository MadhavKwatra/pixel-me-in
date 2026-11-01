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

/** Run-cycle frames for a character (the head filter runs once). */
export function characterFrames(face: FaceData, cfg: AvatarConfig): HTMLCanvasElement[] {
  return renderFrames(face, cfg, 1, RUN_FRAMES);
}

/** Cut a horizontal sprite sheet (equal frames) into frames. */
export function sliceSheet(
  img: CanvasImageSource & { width: number; height: number },
  count: number,
) {
  const w = img.width / count;
  return Array.from({ length: count }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = img.height;
    c.getContext('2d')!.drawImage(img, i * w, 0, w, img.height, 0, 0, w, img.height);
    return c;
  });
}

/** Start the scene in `canvas` with these run frames. Returns a stop function. */
export function startMiniScene(
  canvas: HTMLCanvasElement,
  frames: HTMLCanvasElement[],
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
