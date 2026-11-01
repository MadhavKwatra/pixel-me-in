/**
 * Step 3: cut the head out of the photo (hair + face; no background, no neck).
 * Uses the person mask + face mesh (see headMask.ts for the rule).
 */
import { ctx2d, makeCanvas } from './canvas';
import { segmentPerson } from './detectFace';
import type { Box, FaceDetection } from './geometry';
import { buildHeadAlpha } from './headMask';

export interface HeadCutout {
  /** Same size as the source photo; transparent outside the head. */
  canvas: HTMLCanvasElement;
  /** The visible head, in source pixels. */
  bbox: Box;
}

export async function cutOutHead(
  source: HTMLCanvasElement,
  face: FaceDetection,
): Promise<HeadCutout | null> {
  if (!face.landmarks) return null;
  const W = source.width;
  const H = source.height;
  // A square around the face with room for big hair.
  const side = Math.max(face.box.w, face.box.h) * 2.4;
  const cx = face.box.x + face.box.w / 2;
  const cy = face.box.y + face.box.h * 0.4;
  const region = {
    x: Math.max(0, cx - side / 2),
    y: Math.max(0, cy - side / 2),
    w: Math.min(W, cx + side / 2) - Math.max(0, cx - side / 2),
    h: Math.min(H, cy + side / 2) - Math.max(0, cy - side / 2),
  };
  const mask = await segmentPerson(source, region);
  const { alpha, bbox } = buildHeadAlpha(W, H, mask, face.landmarks);
  if (!bbox) return null;

  const canvas = makeCanvas(W, H);
  const ctx = ctx2d(canvas);
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
  ctx.putImageData(img, 0, 0);
  return { canvas, bbox };
}
