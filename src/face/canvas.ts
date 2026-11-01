/** Small browser-only helpers that move pixels between canvases and Pixels buffers. */
import type { Pixels } from './stylize';

export function makeCanvas(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
  return ctx;
}

export function canvasToPixels(c: HTMLCanvasElement): Pixels {
  const img = ctx2d(c).getImageData(0, 0, c.width, c.height);
  return { width: img.width, height: img.height, data: img.data };
}

export function pixelsToCanvas(p: Pixels): HTMLCanvasElement {
  const c = makeCanvas(p.width, p.height);
  const img = new ImageData(p.width, p.height);
  img.data.set(p.data);
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))), type),
  );
}
