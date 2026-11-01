/**
 * The on-device pixel filter. Pure functions on RGBA buffers (same shape as
 * the browser's ImageData), so they run in tests without a browser.
 * Nothing here touches the network.
 */
import { defaultMeta, type FaceMeta, type Point } from './geometry';
import { kmeansPalette } from './kmeans';
import { GAME_PALETTE, OUTLINE_COLOR, paletteFor, type PaletteId, type RGB } from './palettes';

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type FaceStyle = 'pixel' | 'original';

/** Cells across the head. Each must divide HEAD_SIZE (48). */
export const PIXEL_SIZES = [16, 24, 48] as const;
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
  const scale = Math.min(255 / (hi - lo), 1.35);
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

/** Copy `img` into a bigger transparent square, leaving `inset` pixels free (room for the outline). */
function placeInside(img: Pixels, size: number, inset: number): Pixels {
  const out = createPixels(size, size);
  for (let y = 0; y < img.height; y++) {
    out.data.set(
      img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4),
      ((y + inset) * size + inset) * 4,
    );
  }
  return out;
}

/** Pixel art has no half-transparent pixels. */
function hardAlpha(img: Pixels): Pixels {
  const out = createPixels(img.width, img.height);
  out.data.set(img.data);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = out.data[i] >= 128 ? 255 : 0;
  return out;
}

function opaqueColours(img: Pixels): RGB[] {
  const list: RGB[] = [];
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] >= 128) list.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
  }
  return list;
}

/** Remove single stray pixels: a pixel whose 4 neighbours all share one other colour takes that colour. */
export function cleanSpeckles(img: Pixels): Pixels {
  const out = createPixels(img.width, img.height);
  out.data.set(img.data);
  const W = img.width;
  const key = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return img.data[i + 3] < 128
      ? -1
      : (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
  };
  for (let y = 1; y < img.height - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const me = key(x, y);
      if (me < 0) continue;
      const n = key(x - 1, y);
      if (n >= 0 && n !== me && n === key(x + 1, y) && n === key(x, y - 1) && n === key(x, y + 1)) {
        const o = (y * W + x) * 4;
        out.data[o] = (n >> 16) & 255;
        out.data[o + 1] = (n >> 8) & 255;
        out.data[o + 2] = n & 255;
      }
    }
  }
  return out;
}

/** Recolour by brightness into a fixed ramp (Grey, Retro green) – keeps contrast. */
export function mapByLuma(img: Pixels, ramp: readonly RGB[]): Pixels {
  const sorted = [...ramp].sort((a, b) => lumaOf(a) - lumaOf(b));
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    const l = luma(img.data[i], img.data[i + 1], img.data[i + 2]);
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  const out = createPixels(img.width, img.height);
  out.data.set(img.data);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue;
    const l = luma(out.data[i], out.data[i + 1], out.data[i + 2]);
    const t = hi > lo ? (l - lo) / (hi - lo) : 0.5;
    const c = sorted[Math.min(sorted.length - 1, Math.round(t * (sorted.length - 1)))];
    out.data[i] = c[0];
    out.data[i + 1] = c[1];
    out.data[i + 2] = c[2];
  }
  return out;
}

/** Average colour of the (visible) source pixels around a normalized point. */
function sampleAround(base: Pixels, p: Point, radius: number): RGB | null {
  const r = Math.max(1, Math.round(radius * base.width));
  const cx = Math.round(p.x * base.width);
  const cy = Math.round(p.y * base.height);
  let R = 0;
  let G = 0;
  let B = 0;
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= base.width || y >= base.height) continue;
      const i = (y * base.width + x) * 4;
      if (base.data[i + 3] < 128) continue;
      R += base.data[i];
      G += base.data[i + 1];
      B += base.data[i + 2];
      n++;
    }
  }
  return n ? [R / n, G / n, B / n] : null;
}

const lumaOf = (c: RGB) => luma(c[0], c[1], c[2]);

/** Palette colour nearest to `target`, but at least `minDrop` darker than `than`. */
function darkerColour(pal: readonly RGB[], target: RGB, than: RGB, minDrop: number): RGB | null {
  const ok = pal.filter((c) => lumaOf(c) <= lumaOf(than) - minDrop);
  return ok.length ? nearestColour(target[0], target[1], target[2], ok) : null;
}

/**
 * Feature boost for small pixel sizes: at 16–24 pixels across, eyes and mouth
 * vanish when averaged. We know where they are (face mesh), so we draw them
 * back in with palette colours: pupils, brows, mouth line, nose shadow.
 */
export function boostFeatures(
  small: Pixels,
  base: Pixels,
  meta: FaceMeta,
  pal: readonly RGB[],
  inset: number,
): Pixels {
  const out = createPixels(small.width, small.height);
  out.data.set(small.data);
  const cells = small.width;
  const inner = cells - 2 * inset;
  const cell = (p: Point) => ({
    x: Math.min(cells - 1, Math.max(0, Math.floor(inset + p.x * inner))),
    y: Math.min(cells - 1, Math.max(0, Math.floor(inset + p.y * inner))),
  });
  const get = (x: number, y: number): RGB | null => {
    const i = (y * cells + x) * 4;
    return out.data[i + 3] < 128 ? null : [out.data[i], out.data[i + 1], out.data[i + 2]];
  };
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= cells || y >= cells) return;
    const i = (y * cells + x) * 4;
    if (out.data[i + 3] < 128) return;
    out.data[i] = c[0];
    out.data[i + 1] = c[1];
    out.data[i + 2] = c[2];
  };

  const cheekL = { x: meta.eyeL.x, y: (meta.eyeL.y + meta.mouthL.y) / 2 };
  const cheekR = { x: meta.eyeR.x, y: (meta.eyeR.y + meta.mouthR.y) / 2 };
  const s1 = sampleAround(base, cheekL, 0.03);
  const s2 = sampleAround(base, cheekR, 0.03);
  const skinRaw = s1 && s2 ? mix(s1, s2) : (s1 ?? s2);
  if (!skinRaw) return out;
  const skin = nearestColour(skinRaw[0], skinRaw[1], skinRaw[2], pal);
  const darkest = [...pal].sort((a, b) => lumaOf(a) - lumaOf(b))[0];

  // Eyes: one dark pupil each.
  const eL = cell(meta.eyeL);
  const eR = cell(meta.eyeR);
  for (const e of [eL, eR]) {
    const cur = get(e.x, e.y);
    if (cur && lumaOf(cur) > lumaOf(darkest)) put(e.x, e.y, darkest);
  }

  // Brows: only if they are really darker than the skin in the photo.
  const brows: [Point, { x: number; y: number }, number][] = [
    [meta.browL, eL, -1],
    [meta.browR, eR, 1],
  ];
  for (const [brow, eye, outward] of brows) {
    const sample = sampleAround(base, brow, 0.015);
    if (!sample || lumaOf(sample) > lumaOf(skinRaw) - 25) continue;
    const c = darkerColour(pal, sample, skin, 20) ?? darkest;
    const b = cell(brow);
    const y = Math.min(b.y, eye.y - 1);
    put(b.x, y, c);
    put(b.x + outward, y, c);
    if (cells >= 24) put(b.x - outward, y, c);
  }

  // Mouth: a line between the corners, a little curve when smiling.
  const mL = cell(meta.mouthL);
  const mR = cell(meta.mouthR);
  const my = Math.max(Math.max(eL.y, eR.y) + 2, Math.round((mL.y + mR.y) / 2));
  const lip = sampleAround(base, mix(meta.mouthL, meta.mouthR), 0.012);
  const mouthTarget: RGB = lip ? [lip[0] * 0.55, lip[1] * 0.45, lip[2] * 0.45] : darkest;
  const mouthColour = darkerColour(pal, mouthTarget, skin, 30) ?? darkest;
  const x0 = Math.min(mL.x, mR.x);
  const x1 = Math.max(Math.max(mL.x, mR.x), x0 + 1);
  const smiling = meta.mouthOpen > 0.02 && x1 - x0 >= 3;
  for (let x = x0; x <= x1; x++) {
    const corner = x === x0 || x === x1;
    put(x, smiling && corner ? my - 1 : my, mouthColour);
  }

  // Nose: a small shadow, only when there is room.
  if (cells >= 24) {
    const n = cell(meta.nose);
    const shade = darkerColour(
      pal,
      [skinRaw[0] * 0.75, skinRaw[1] * 0.7, skinRaw[2] * 0.7],
      skin,
      12,
    );
    if (shade && get(n.x, n.y + 1) && n.y + 1 < my) put(n.x, n.y + 1, shade);
  }
  return out;
}

function mix(a: RGB, b: RGB): RGB;
function mix(a: Point, b: Point): Point;
function mix(a: RGB | Point, b: RGB | Point): RGB | Point {
  if (Array.isArray(a) && Array.isArray(b)) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }
  const p = a as Point;
  const q = b as Point;
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/** How many colours each pixel size gets. Fewer colours = cleaner pixel art. */
const COLOURS_FOR: Record<PixelSize, number> = { 16: 8, 24: 10, 48: 14 };

/**
 * Full face pipeline: normalized head crop -> styled head of `outSize` pixels.
 * `outSize` must be a multiple of 48 (in-game head = 48, Photo Booth = 240).
 * With `meta.cut` the crop is already a transparent cut-out of the head;
 * otherwise (old saves, ready-made faces) a round mask is used.
 */
export function stylizeFace(
  base: Pixels,
  opts: StyleOptions,
  outSize: number,
  meta: FaceMeta = defaultMeta(),
): Pixels {
  const ramp =
    opts.palette === 'grey' || opts.palette === 'retro' ? paletteFor(opts.palette) : null;

  if (opts.style === 'pixel') {
    const cells: PixelSize = PIXEL_SIZES.includes(opts.pixelSize) ? opts.pixelSize : 48;
    const inset = opts.outline ? 1 : 0;
    let small = placeInside(downsample(base, cells - 2 * inset), cells, inset);
    small = hardAlpha(small);
    if (!meta.cut) small = ovalMask(small, inset);
    small = autoLevel(small);
    let pal = kmeansPalette(opaqueColours(small), COLOURS_FOR[cells]);
    if (opts.palette === 'game')
      pal = pal.map((c) => nearestColour(c[0], c[1], c[2], GAME_PALETTE));
    small = quantize(small, pal);
    small = cleanSpeckles(small);
    if (cells <= 24) small = boostFeatures(small, base, meta, pal, inset);
    if (ramp) small = mapByLuma(small, ramp);
    if (opts.outline) small = outline(small, 1);
    return upscaleNearest(small, outSize / cells);
  }

  // Photo look: keep the real photo, just cut out and outlined.
  const ring = Math.max(1, Math.round(outSize / 48));
  const inset = opts.outline ? ring : 0;
  let img = placeInside(downsample(base, outSize - 2 * inset), outSize, inset);
  if (!meta.cut) img = ovalMask(img, inset, true);
  if (ramp) img = mapByLuma(img, ramp);
  if (opts.outline) img = outline(img, ring);
  return img;
}
