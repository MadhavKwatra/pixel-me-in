/**
 * Step 1 of the photo pipeline: get the picture into a canvas.
 * The file is read locally by the browser. It is never uploaded.
 */
import { ctx2d, makeCanvas } from './canvas';

/** Big photos are shrunk first: faster detection, less memory. */
const MAX_SIDE = 1024;

function fit(w: number, h: number): [number, number] {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)];
}

export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  let bmp: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation, so phone photos are not sideways.
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await createImageBitmap(file);
  }
  const [w, h] = fit(bmp.width, bmp.height);
  const c = makeCanvas(w, h);
  // Re-drawing to a canvas also drops all EXIF metadata (GPS, camera, date).
  ctx2d(c).drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return c;
}

/** Grab one frame from the camera preview. Mirrored, to match what the player saw. */
export function videoToCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const [w, h] = fit(video.videoWidth, video.videoHeight);
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  return c;
}
