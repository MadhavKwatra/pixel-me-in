/**
 * The head cut-out, as pure math (unit-tested in tests/headMask.test.ts).
 *
 * keep a pixel if:  it is inside the face oval
 *              or:  the segmenter says "person" AND it is not below the jawline
 * So hair stays, while the background, neck and shoulders go.
 */
import { MESH, type Box, type Point } from './geometry';

export interface PersonMask {
  /** Person confidence, 0..1, row by row. */
  conf: Float32Array;
  width: number;
  height: number;
  /** The part of the source image the mask covers (source pixels). */
  region: Box;
}

function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The lower half of the face oval (ear to chin to ear), as y = jaw(x). */
export function jawLine(oval: Point[]): {
  jawY: (x: number) => number;
  minX: number;
  maxX: number;
} {
  // In MESH.oval order: index 8 = point 454 (one side), 18 = chin, 28 = point 234 (other side).
  const path = oval
    .slice(8, 29)
    .slice()
    .sort((a, b) => a.x - b.x);
  const minX = path[0].x;
  const maxX = path[path.length - 1].x;
  const jawY = (x: number) => {
    if (x <= minX) return path[0].y;
    if (x >= maxX) return path[path.length - 1].y;
    let best = -Infinity;
    // Highest y (lowest on screen) among segments covering x.
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
        best = Math.max(best, a.y + (b.y - a.y) * t);
      }
    }
    return best === -Infinity ? path[0].y : best;
  };
  return { jawY, minX, maxX };
}

function sampleMask(m: PersonMask, x: number, y: number): number {
  const u = ((x - m.region.x) / m.region.w) * m.width - 0.5;
  const v = ((y - m.region.y) / m.region.h) * m.height - 0.5;
  if (u < -0.5 || v < -0.5 || u > m.width - 0.5 || v > m.height - 0.5) return 0;
  const x0 = Math.max(0, Math.min(m.width - 1, Math.floor(u)));
  const y0 = Math.max(0, Math.min(m.height - 1, Math.floor(v)));
  const x1 = Math.min(m.width - 1, x0 + 1);
  const y1 = Math.min(m.height - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, u - x0));
  const fy = Math.min(1, Math.max(0, v - y0));
  const c = (xx: number, yy: number) => m.conf[yy * m.width + xx];
  return (
    c(x0, y0) * (1 - fx) * (1 - fy) +
    c(x1, y0) * fx * (1 - fy) +
    c(x0, y1) * (1 - fx) * fy +
    c(x1, y1) * fx * fy
  );
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Build the head alpha (0..255) for a source image of size w × h.
 * `landmarks` are the 478 face-mesh points in source pixels.
 */
export function buildHeadAlpha(
  w: number,
  h: number,
  mask: PersonMask,
  landmarks: Point[],
): { alpha: Uint8ClampedArray; bbox: Box | null } {
  const oval = MESH.oval.map((i) => landmarks[i]);
  const { jawY, minX, maxX } = jawLine(oval);
  const chin = landmarks[MESH.chin];
  const faceH = chin.y - landmarks[MESH.oval[0]].y;
  const margin = faceH * 0.02;

  // Only look near the face: hair can be wide and tall, but not huge.
  const fx0 = Math.min(...oval.map((p) => p.x));
  const fx1 = Math.max(...oval.map((p) => p.x));
  const fy0 = Math.min(...oval.map((p) => p.y));
  const faceW = fx1 - fx0;
  const x0 = Math.max(0, Math.floor(fx0 - faceW * 0.9));
  const x1 = Math.min(w, Math.ceil(fx1 + faceW * 0.9));
  const y0 = Math.max(0, Math.floor(fy0 - faceH * 0.9));
  const y1 = Math.min(h, Math.ceil(chin.y + margin + 1));

  const alpha = new Uint8ClampedArray(w * h);
  let bx0 = Infinity,
    by0 = Infinity,
    bx1 = -Infinity,
    by1 = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let a: number;
      if (pointInPolygon(px, py, oval)) {
        a = 1;
      } else {
        let belowJaw: boolean;
        if (px >= minX && px <= maxX) {
          belowJaw = py > jawY(px) + margin;
        } else {
          // Beside the face: hair may hang a bit below the ears, but shoulders
          // and collars (further out and lower) must go.
          const edgeY = jawY(px < minX ? minX : maxX);
          const out = px < minX ? minX - px : px - maxX;
          belowJaw = py > edgeY + (chin.y - edgeY) * 0.35 || (py > edgeY && out > faceW * 0.2);
        }
        a = belowJaw ? 0 : smooth(0.35, 0.65, sampleMask(mask, px, py));
      }
      if (a <= 0) continue;
      const v = Math.round(a * 255);
      alpha[y * w + x] = v;
      if (v >= 128) {
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x);
        by1 = Math.max(by1, y);
      }
    }
  }
  const bbox = bx1 >= bx0 ? { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 } : null;
  return { alpha, bbox };
}
