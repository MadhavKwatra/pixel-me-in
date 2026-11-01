/**
 * Step 3: cut out a level, centred square of the face (FACE_SIZE x FACE_SIZE).
 * After this, the full photo is no longer needed and is dropped.
 */
import { FACE_SIZE } from '../config';
import { ctx2d, makeCanvas } from './canvas';
import type { CropTransform } from './geometry';

/** Inverse of geometry.outputToSource, done with canvas transforms. */
export function drawCrop(
  source: CanvasImageSource,
  t: CropTransform,
  size = FACE_SIZE,
): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / t.side, size / t.side);
  ctx.rotate(-t.angle);
  ctx.translate(-t.cx, -t.cy);
  ctx.drawImage(source, 0, 0);
  return c;
}
