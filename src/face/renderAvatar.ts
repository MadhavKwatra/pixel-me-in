/**
 * Step 4: turn the saved face + avatar settings into images.
 * - renderHead():      the head texture used in the game (and bigger for Photo Booth)
 * - renderCharacter(): head + body, used for previews and share cards
 */
import { BODY_FRAMES, BODY_H, BODY_W, drawBodySheet, NECK, type BodyFrame } from '../art/body';
import { FACE_SIZE, HEAD_SIZE } from '../config';
import { findFaceAcc, findHat } from './accessories';
import { canvasToPixels, ctx2d, makeCanvas, pixelsToCanvas } from './canvas';
import { loadBaseFace, type AvatarConfig } from './faceStore';
import { defaultMeta, type FaceMeta, type Point } from './geometry';
import { GAME_PALETTE } from './palettes';
import { drawPreset, presetMeta, presetSkin } from './presets';
import { nearestColour, stylizeFace, type Pixels } from './stylize';

/** Head frame: 64x64, head drawn in the 48x48 box at (8,10). Extra room is for hats. */
export const HEAD_FRAME = 64;
export const HEAD_BOX = { x: 8, y: 10 };

/** A face ready to draw: the 256x256 crop + where its features are. */
export interface FaceData {
  pixels: Pixels;
  meta: FaceMeta;
}

export async function loadFace(cfg: AvatarConfig): Promise<FaceData> {
  if (cfg.source === 'photo') {
    const saved = await loadBaseFace();
    if (saved) {
      const bmp = await createImageBitmap(saved.png);
      const c = makeCanvas(FACE_SIZE);
      ctx2d(c).drawImage(bmp, 0, 0, FACE_SIZE, FACE_SIZE);
      bmp.close();
      return { pixels: canvasToPixels(c), meta: saved.meta ?? defaultMeta() };
    }
  }
  return { pixels: canvasToPixels(drawPreset(cfg.presetId)), meta: presetMeta() };
}

/** A face point (0..1 in the crop) in head-frame units. */
function toFrame(p: Point): Point {
  return { x: HEAD_BOX.x + p.x * HEAD_SIZE, y: HEAD_BOX.y + p.y * HEAD_SIZE };
}

/** Where the head sits on the neck: just above the chin (head-frame units). */
export function headPivot(meta: FaceMeta): Point {
  const chin = toFrame({ x: meta.chin.x, y: Math.max(meta.chin.y, meta.bottom) });
  return { x: Math.round(chin.x), y: Math.round(chin.y - 3) };
}

/** Average colour of the cheeks, snapped to a palette skin tone. Used for hands and legs. */
export function skinTone(face: FaceData, cfg: AvatarConfig): string {
  if (cfg.source === 'preset') return presetSkin(cfg.presetId);
  const { pixels: base, meta } = face;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const y0 = Math.floor(((meta.eyeL.y + meta.mouthL.y) / 2) * base.height);
  const y1 = Math.ceil(meta.mouthL.y * base.height);
  const x0 = Math.floor(meta.eyeL.x * base.width);
  const x1 = Math.ceil(meta.eyeR.x * base.width);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * base.width + x) * 4;
      if (base.data[i + 3] < 128) continue;
      r += base.data[i];
      g += base.data[i + 1];
      b += base.data[i + 2];
      n++;
    }
  }
  if (!n) return '#e7aa74';
  const [cr, cg, cb] = nearestColour(r / n, g / n, b / n, GAME_PALETTE.slice(0, 11));
  return `rgb(${cr}, ${cg}, ${cb})`;
}

/**
 * Accessories are designed for a "standard" head (eyes at 25/39, y 32; head
 * top at y 10, 48 wide). Here they are moved and scaled to fit THIS head.
 */
function drawAccessories(
  ctx: CanvasRenderingContext2D,
  cfg: AvatarConfig,
  meta: FaceMeta,
  scale: number,
) {
  const place = (
    draw: (c: CanvasRenderingContext2D) => void,
    s: number,
    dx: number,
    dy: number,
  ) => {
    // Drawn at 1x on its own layer (so holes in masks do not erase the face), then scaled crisply.
    const layer = makeCanvas(HEAD_FRAME);
    draw(ctx2d(layer));
    const k = Math.min(1.3, Math.max(0.75, s));
    ctx.drawImage(layer, dx * scale, dy * scale, HEAD_FRAME * k * scale, HEAD_FRAME * k * scale);
  };

  const faceAcc = findFaceAcc(cfg.faceAcc);
  if (faceAcc) {
    const eL = toFrame(meta.eyeL);
    const eR = toFrame(meta.eyeR);
    const s = Math.min(1.3, Math.max(0.75, Math.hypot(eR.x - eL.x, eR.y - eL.y) / 14));
    const mid = { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2 };
    place(faceAcc.draw, s, mid.x - 32 * s, mid.y - 32 * s);
  }
  const hat = findHat(cfg.hat);
  if (hat) {
    const s = Math.min(1.3, Math.max(0.75, ((meta.right - meta.left) * HEAD_SIZE) / HEAD_SIZE));
    const cx = HEAD_BOX.x + ((meta.left + meta.right) / 2) * HEAD_SIZE;
    const top = HEAD_BOX.y + meta.top * HEAD_SIZE;
    place(hat.draw, s, cx - 32 * s, top - 10 * s);
  }
}

/** The head with accessories. `scale` 1 = in-game size (64x64 frame). */
export function renderHead(face: FaceData, cfg: AvatarConfig, scale = 1): HTMLCanvasElement {
  const out = makeCanvas(HEAD_FRAME * scale);
  const ctx = ctx2d(out);
  ctx.imageSmoothingEnabled = false;
  const head = pixelsToCanvas(stylizeFace(face.pixels, cfg.style, HEAD_SIZE * scale, face.meta));
  ctx.drawImage(head, HEAD_BOX.x * scale, HEAD_BOX.y * scale);
  drawAccessories(ctx, cfg, face.meta, scale);
  return out;
}

/** Head + body in one picture, for menus, Photo Booth and share cards. */
export function renderCharacter(
  face: FaceData,
  cfg: AvatarConfig,
  scale: number,
  frame: BodyFrame = 'run1',
): HTMLCanvasElement {
  const head = renderHead(face, cfg, scale);
  const sheet = drawBodySheet(cfg.outfit, skinTone(face, cfg));
  const neck = NECK[frame];
  const pivot = headPivot(face.meta);
  const fi = BODY_FRAMES.indexOf(frame);

  // Layout in 1x units: head frame on top, body below, aligned at the neck.
  const bodyX = pivot.x - neck.x;
  const bodyY = pivot.y - neck.y;
  const left = Math.min(0, bodyX);
  const w = Math.max(HEAD_FRAME, bodyX + BODY_W) - left;
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
    (bodyX - left) * scale,
    bodyY * scale,
    BODY_W * scale,
    BODY_H * scale,
  );
  ctx.drawImage(head, -left * scale, 0);
  return out;
}

/**
 * Several body frames with the same head, drawn once (the head filter is the
 * slow part). All frames share one canvas size with the feet on the bottom
 * edge, so they can be played as an animation outside the game.
 */
export function renderFrames(
  face: FaceData,
  cfg: AvatarConfig,
  scale: number,
  frames: readonly BodyFrame[],
): HTMLCanvasElement[] {
  const head = renderHead(face, cfg, scale);
  const sheet = drawBodySheet(cfg.outfit, skinTone(face, cfg));
  const P = headPivot(face.meta);
  const necks = frames.map((f) => NECK[f]);
  const H = BODY_H + P.y - Math.min(...necks.map((n) => n.y));
  const hx = Math.max(0, ...necks.map((n) => n.x - P.x));
  const W = Math.max(hx + HEAD_FRAME, ...necks.map((n) => hx + P.x - n.x + BODY_W));
  return frames.map((frame) => {
    const n = NECK[frame];
    const bodyTop = H - BODY_H;
    const bodyLeft = hx + P.x - n.x;
    const hy = bodyTop + n.y - P.y;
    const out = makeCanvas(W * scale, H * scale);
    const ctx = ctx2d(out);
    ctx.imageSmoothingEnabled = false;
    const fi = BODY_FRAMES.indexOf(frame);
    ctx.drawImage(
      sheet,
      fi * BODY_W,
      0,
      BODY_W,
      BODY_H,
      bodyLeft * scale,
      bodyTop * scale,
      BODY_W * scale,
      BODY_H * scale,
    );
    ctx.drawImage(head, hx * scale, hy * scale);
    return out;
  });
}
