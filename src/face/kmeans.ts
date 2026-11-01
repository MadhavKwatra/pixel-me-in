/**
 * Adaptive palette: pick the k colours that best describe THIS face
 * (k-means in Lab colour space, which matches how eyes see differences).
 * Keeps real skin and hair tones instead of forcing a fixed palette.
 */
import type { RGB } from './palettes';

type Lab = [number, number, number];

function toLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
const fInv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const WHITE = [0.95047, 1, 1.08883];

export function rgbToLab([r, g, b]: RGB): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / WHITE[0];
  const y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / WHITE[1];
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / WHITE[2];
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function labToRgb([L, a, bb]: Lab): RGB {
  const fy = (L + 16) / 116;
  const x = fInv(fy + a / 500) * WHITE[0];
  const y = fInv(fy) * WHITE[1];
  const z = fInv(fy - bb / 200) * WHITE[2];
  const R = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const G = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const B = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [fromLinear(R), fromLinear(G), fromLinear(B)];
}

const dist2 = (p: Lab, q: Lab) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/**
 * k-means with a deterministic "farthest point" start, so the same photo
 * always gives the same palette.
 */
export function kmeansPalette(colours: RGB[], k: number, iterations = 12): RGB[] {
  if (colours.length === 0) return [[0, 0, 0]];
  const pts = colours.map(rgbToLab);
  const mean: Lab = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) mean[i] += p[i] / pts.length;

  // Start: the point closest to the mean, then repeatedly the point farthest from all centres.
  const centres: Lab[] = [pts.reduce((best, p) => (dist2(p, mean) < dist2(best, mean) ? p : best))];
  while (centres.length < Math.min(k, pts.length)) {
    let far = pts[0];
    let farD = -1;
    for (const p of pts) {
      const d = Math.min(...centres.map((c) => dist2(p, c)));
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    if (farD <= 0) break;
    centres.push([...far] as Lab);
  }

  const assign = new Int32Array(pts.length);
  for (let it = 0; it < iterations; it++) {
    pts.forEach((p, i) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, j) => {
        const d = dist2(p, c);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      assign[i] = best;
    });
    const sums = centres.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      const s = sums[assign[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    sums.forEach((s, j) => {
      if (s[3]) centres[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centres.map(labToRgb);
}
