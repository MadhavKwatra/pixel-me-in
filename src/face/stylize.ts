/**
 * The on-device pixel filter. Pure functions on RGBA buffers (same shape as
 * the browser's ImageData), so they run in tests without a browser.
 * Nothing here touches the network.
 */
import { OUTLINE_COLOR, paletteFor, type PaletteId, type RGB } from './palettes';

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type FaceStyle = 'pixel' | 'original';

/** Cells across the head. Each must divide HEAD_SIZE (48). */
export const PIXEL_SIZES = [12, 16, 24, 48] as const;
export type PixelSize = (typeof PIXEL_SIZES)[number];

export interface StyleOptions {
  style: FaceStyle;
  pixelSize: PixelSize;
  palette: PaletteId;
  outline: boolean;
}

export function createPixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Area-average resize to any smaller (or equal) size. Alpha-weighted. */
export function downsample(src: Pixels, outW: number, outH = outW): Pixels {
  const out = createPixels(outW, outH);
  for (let oy = 0; oy < outH; oy++) {
    const y0 = Math.floor((oy * src.height) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * src.height) / outH));
    for (let ox = 0; ox < outW; ox++) {
      const x0 = Math.floor((ox * src.width) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * src.width) / outW));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * src.width + x) * 4;
          const al = src.data[i + 3];
          r += src.data[i] * al;
          g += src.data[i + 1] * al;
          b += src.data[i + 2] * al;
          a += al;
          n++;
        }
      }
      const o = (oy * outW + ox) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
      }
      out.data[o + 3] = a / n;
    }
  }
  return out;
}

/** Nearest-neighbour upscale by a whole number. Keeps pixels crisp. */
export function upscaleNearest(src: Pixels, factor: number): Pixels {
  const out = createPixels(src.width * factor, src.height * factor);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < out.width; x++) {
      const si = (sy * src.width + Math.floor(x / factor)) * 4;
      const o = (y * out.width + x) * 4;
      out.data[o] = src.data[si];
      out.data[o + 1] = src.data[si + 1];
      out.data[o + 2] = src.data[si + 2];
      out.data[o + 3] = src.data[si + 3];
    }
  }
  return out;
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Stretch brightness so dark or washed-out photos still read well.
 * Uses the 2nd-98th percentile so one bright spot does not ruin it.
 * Scales all channels the same way, so skin tone hue is kept.
 */
export function autoLevel(img: Pixels): Pixels {
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    hist[Math.round(luma(img.data[i], img.data[i + 1], img.data[i + 2]))]++;
    count++;
  }
  if (count === 0) return img;
  const pick = (p: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= count * p) return v;
    }
    return 255;
  };
  const lo = pick(0.02);
  const hi = pick(0.98);
  if (hi - lo < 24) return img;
  // Do not over-stretch photos that are already fine.
  const scale = Math.min(255 / (hi - lo), 1.8);
  const out = createPixels(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    out.data[i] = (img.data[i] - lo) * scale;
    out.data[i + 1] = (img.data[i + 1] - lo) * scale;
    out.data[i + 2] = (img.data[i + 2] - lo) * scale;
    out.data[i + 3] = img.data[i + 3];
  }
  return out;
}

/** Perceptual-ish colour distance ("redmean"), cheap and good enough for skin tones. */
function colourDistance(r: number, g: number, b: number, c: RGB): number {
  const rm = (r + c[0]) / 2;
  const dr = r - c[0];
  const dg = g - c[1];
  const db = b - c[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function nearestColour(r: number, g: number, b: number, palette: readonly RGB[]): RGB {
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const d = colourDistance(r, g, b, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Map every pixel to the nearest palette colour (no dithering: cleaner pixel art). */
export function quantize(img: Pixels, palette: readonly RGB[]): Pixels {
  const out = createPixels(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const c = nearestColour(img.data[i], img.data[i + 1], img.data[i + 2], palette);
    out.data[i] = c[0];
    out.data[i + 1] = c[1];
    out.data[i + 2] = c[2];
    out.data[i + 3] = img.data[i + 3];
  }
  return out;
}

/** Fewer shades per channel. Used for the "full colour" pixel style. */
export function posterize(img: Pixels, levels: number): Pixels {
  const out = createPixels(img.width, img.height);
  const step = 255 / (levels - 1);
  for (let i = 0; i < img.data.length; i += 4) {
    out.data[i] = Math.round(img.data[i] / step) * step;
    out.data[i + 1] = Math.round(img.data[i + 1] / step) * step;
    out.data[i + 2] = Math.round(img.data[i + 2] / step) * step;
    out.data[i + 3] = img.data[i + 3];
  }
  return out;
}

/**
 * Cut the square into the round "big head" shape.
 * `inset` leaves room at the edge for the outline. `soft` gives an
 * anti-aliased edge (used by the Original style).
 */
export function ovalMask(img: Pixels, inset = 0, soft = false): Pixels {
  const out = createPixels(img.width, img.height);
  out.data.set(img.data);
  const rx = img.width / 2 - inset;
  const ry = img.height / 2 - inset;
  const cx = img.width / 2;
  const cy = img.height / 2;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      let keep: number;
      if (soft) {
        // ~1 output pixel of fade at the edge
        keep = Math.min(1, Math.max(0, (1 - d) * Math.min(rx, ry)));
      } else {
        keep = d <= 1 ? 1 : 0;
      }
      const i = (y * img.width + x) * 4 + 3;
      out.data[i] = out.data[i] * keep;
    }
  }
  return out;
}

/** Grow a solid outline of `width` pixels around everything that is visible. */
export function outline(img: Pixels, width = 1, colour: RGB = OUTLINE_COLOR): Pixels {
  let cur = img;
  for (let pass = 0; pass < width; pass++) {
    const out = createPixels(cur.width, cur.height);
    out.data.set(cur.data);
    for (let y = 0; y < cur.height; y++) {
      for (let x = 0; x < cur.width; x++) {
        const i = (y * cur.width + x) * 4;
        if (cur.data[i + 3] >= 128) continue;
        const solid = (xx: number, yy: number) =>
          xx >= 0 &&
          yy >= 0 &&
          xx < cur.width &&
          yy < cur.height &&
          cur.data[(yy * cur.width + xx) * 4 + 3] >= 128;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          out.data[i] = colour[0];
          out.data[i + 1] = colour[1];
          out.data[i + 2] = colour[2];
          out.data[i + 3] = 255;
        }
      }
    }
    cur = out;
  }
  return cur;
}

/**
 * Full face pipeline: normalized face crop -> styled round head of `outSize` pixels.
 * `outSize` must be a multiple of 48 (in-game head = 48, Photo Booth = 240).
 */
export function stylizeFace(base: Pixels, opts: StyleOptions, outSize: number): Pixels {
  const palette = paletteFor(opts.palette);

  if (opts.style === 'pixel') {
    const cells = opts.pixelSize;
    let small = downsample(base, cells);
    small = autoLevel(small);
    small = palette ? quantize(small, palette) : posterize(small, 6);
    small = ovalMask(small, opts.outline ? 1 : 0);
    if (opts.outline) small = outline(small, 1);
    return upscaleNearest(small, outSize / cells);
  }

  // Original: keep the photo look, just shaped and (optionally) recoloured.
  const ring = Math.max(1, Math.round(outSize / 48));
  let img = downsample(base, outSize);
  if (palette && opts.palette !== 'game') img = quantize(img, palette);
  img = ovalMask(img, opts.outline ? ring : 0, true);
  if (opts.outline) img = outline(img, ring);
  return img;
}
