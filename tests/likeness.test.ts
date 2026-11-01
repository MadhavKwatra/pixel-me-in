import { describe, expect, it } from 'vitest';
import { defaultMeta, outputToSource, sourceToOutput } from '../src/face/geometry';
import { kmeansPalette, labToRgb, rgbToLab } from '../src/face/kmeans';
import {
  boostFeatures,
  cleanSpeckles,
  createPixels,
  stylizeFace,
  type Pixels,
} from '../src/face/stylize';

function solid(w: number, h: number, rgba: [number, number, number, number]): Pixels {
  const p = createPixels(w, h);
  for (let i = 0; i < p.data.length; i += 4) p.data.set(rgba, i);
  return p;
}
const px = (img: Pixels, x: number, y: number) =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const luma = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

describe('geometry round trip', () => {
  it('sourceToOutput undoes outputToSource', () => {
    const t = { cx: 300, cy: 200, side: 180, angle: 0.3 };
    const p = { x: 40, y: 200 };
    const back = sourceToOutput(t, 256, outputToSource(t, 256, p));
    expect(back.x).toBeCloseTo(40, 6);
    expect(back.y).toBeCloseTo(200, 6);
  });
});

describe('adaptive palette', () => {
  it('Lab conversion round-trips', () => {
    expect(labToRgb(rgbToLab([200, 150, 100]))).toEqual([200, 150, 100]);
  });

  it('finds the real colours of the image', () => {
    const colours = [
      ...Array.from({ length: 50 }, () => [230, 180, 140] as const),
      ...Array.from({ length: 50 }, () => [30, 20, 15] as const),
    ];
    const pal = kmeansPalette(colours, 2).sort((a, b) => a[0] - b[0]);
    expect(pal).toEqual([
      [30, 20, 15],
      [230, 180, 140],
    ]);
  });

  it('is deterministic', () => {
    const colours = Array.from(
      { length: 200 },
      (_, i) => [i % 255, (i * 7) % 255, (i * 13) % 255] as const,
    );
    expect(kmeansPalette(colours, 6)).toEqual(kmeansPalette(colours, 6));
  });
});

describe('cleanSpeckles', () => {
  it('removes a lone pixel', () => {
    const img = solid(3, 3, [200, 200, 200, 255]);
    img.data.set([10, 10, 10, 255], (1 * 3 + 1) * 4);
    expect(px(cleanSpeckles(img), 1, 1)).toEqual([200, 200, 200, 255]);
  });
});

describe('feature boost', () => {
  it('draws dark pupils where the eyes are, even on a flat face', () => {
    const skin: [number, number, number, number] = [220, 170, 130, 255];
    const base = solid(256, 256, skin);
    const small = solid(16, 16, skin);
    const pal = [
      [220, 170, 130],
      [40, 25, 20],
    ] as const;
    const meta = defaultMeta();
    const out = boostFeatures(small, base, meta, pal, 0);
    const eye = { x: Math.floor(meta.eyeL.x * 16), y: Math.floor(meta.eyeL.y * 16) };
    expect(luma(px(out, eye.x, eye.y))).toBeLessThan(60);
    // the cheek stays skin
    expect(px(out, 1, 8)).toEqual(skin);
  });

  it('keeps a cut-out head transparent outside the head', () => {
    const base = createPixels(256, 256); // fully transparent
    for (let y = 64; y < 192; y++)
      for (let x = 64; x < 192; x++) base.data.set([220, 170, 130, 255], (y * 256 + x) * 4);
    const out = stylizeFace(
      base,
      { style: 'pixel', pixelSize: 16, palette: 'natural', outline: true },
      48,
      { ...defaultMeta(), cut: true },
    );
    expect(px(out, 2, 2)[3]).toBe(0);
    expect(px(out, 24, 24)[3]).toBe(255);
  });
});
