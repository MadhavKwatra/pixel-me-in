/**
 * Step 4: turn the saved face + avatar settings into images.
 * - renderHead():      the head texture used in the game (and bigger for Photo Booth)
 * - renderCharacter(): head + body, used for previews and share cards
 */
import { BODY_H, BODY_W, drawBodySheet, NECK, type BodyFrame, BODY_FRAMES } from '../art/body';
import { FACE_SIZE, HEAD_SIZE } from '../config';
import { findFaceAcc, findHat } from './accessories';
import { canvasToPixels, ctx2d, makeCanvas, pixelsToCanvas } from './canvas';
import { loadBaseFace, type AvatarConfig } from './faceStore';
import { GAME_PALETTE } from './palettes';
import { drawPreset, presetSkin } from './presets';
import { nearestColour, stylizeFace, type Pixels } from './stylize';

/** Head frame: 64x64, round head at (8,10) size 48. Extra room is for hats. */
export const HEAD_FRAME = 64;
export const HEAD_BOX = { x: 8, y: 10 };
/** Point in the head frame that sits on the neck (bottom centre of the head, a bit up). */
export const HEAD_PIVOT = { x: 32, y: 53 };

export async function loadBasePixels(cfg: AvatarConfig): Promise<Pixels> {
  if (cfg.source === 'photo') {
    const blob = await loadBaseFace();
    if (blob) {
      const bmp = await createImageBitmap(blob);
      const c = makeCanvas(FACE_SIZE);
      ctx2d(c).drawImage(bmp, 0, 0, FACE_SIZE, FACE_SIZE);
      bmp.close();
      return canvasToPixels(c);
    }
  }
  return canvasToPixels(drawPreset(cfg.presetId));
}

/** Average colour of the cheeks/nose area, snapped to a palette skin tone. Used for hands and legs. */
export function skinTone(base: Pixels, cfg: AvatarConfig): string {
  if (cfg.source === 'preset') return presetSkin(cfg.presetId);
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = Math.floor(base.height * 0.55); y < base.height * 0.68; y++) {
    for (let x = Math.floor(base.width * 0.38); x < base.width * 0.62; x++) {
      const i = (y * base.width + x) * 4;
      r += base.data[i];
      g += base.data[i + 1];
      b += base.data[i + 2];
      n++;
    }
  }
  if (!n) return '#e7aa74';
  const skinTones = GAME_PALETTE.slice(0, 11);
  const [cr, cg, cb] = nearestColour(r / n, g / n, b / n, skinTones);
  return `rgb(${cr}, ${cg}, ${cb})`;
}

/** The head with accessories. `scale` 1 = in-game size (64x64 frame). */
export function renderHead(base: Pixels, cfg: AvatarConfig, scale = 1): HTMLCanvasElement {
  const out = makeCanvas(HEAD_FRAME * scale);
  const ctx = ctx2d(out);
  ctx.imageSmoothingEnabled = false;

  const head = pixelsToCanvas(stylizeFace(base, cfg.style, HEAD_SIZE * scale));
  ctx.drawImage(head, HEAD_BOX.x * scale, HEAD_BOX.y * scale);

  // Accessories are drawn at 1x on their own layer (so "holes" in masks
  // do not erase the face), then scaled up with crisp pixels.
  const layer = makeCanvas(HEAD_FRAME);
  const lctx = ctx2d(layer);
  findFaceAcc(cfg.faceAcc)?.draw(lctx);
  findHat(cfg.hat)?.draw(lctx);
  ctx.drawImage(layer, 0, 0, HEAD_FRAME * scale, HEAD_FRAME * scale);
  return out;
}

/** Head + body in one picture, for menus, Photo Booth and share cards. */
export function renderCharacter(
  base: Pixels,
  cfg: AvatarConfig,
  scale: number,
  frame: BodyFrame = 'run1',
): HTMLCanvasElement {
  const head = renderHead(base, cfg, scale);
  const sheet = drawBodySheet(cfg.outfit, skinTone(base, cfg));
  const neck = NECK[frame];
  const fi = BODY_FRAMES.indexOf(frame);

  // Layout in 1x units: head frame on top, body below, aligned at the neck.
  const bodyX = HEAD_PIVOT.x - neck.x + 0;
  const bodyY = HEAD_PIVOT.y - neck.y;
  const w = Math.max(HEAD_FRAME, bodyX + BODY_W);
  const h = bodyY + BODY_H;

  const out = makeCanvas(w * scale, h * scale);
  const ctx = ctx2d(out);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet,
    fi * BODY_W,
    0,
    BODY_W,
    BODY_H,
    bodyX * scale,
    bodyY * scale,
    BODY_W * scale,
    BODY_H * scale,
  );
  ctx.drawImage(head, 0, 0);
  return out;
}
