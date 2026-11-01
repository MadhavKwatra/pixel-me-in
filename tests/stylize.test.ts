import { describe, expect, it } from 'vitest';
import { GAME_PALETTE, RETRO_PALETTE } from '../src/face/palettes';
import {
  createPixels,
  downsample,
  nearestColour,
  outline,
  ovalMask,
  quantize,
  stylizeFace,
  upscaleNearest,
  type Pixels,
} from '../src/face/stylize';

function solid(w: number, h: number, rgba: [number, number, number, number]): Pixels {
  const p = createPixels(w, h);
  for (let i = 0; i < p.data.length; i += 4) p.data.set(rgba, i);
  return p;
}

const px = (img: Pixels, x: number, y: number) =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('downsample / upscale', () => {
  it('averages a 2x2 block', () => {
    const img = createPixels(2, 2);
    img.data.set([0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255]);
    expect(px(downsample(img, 1), 0, 0)).toEqual([100, 100, 100, 255]);
  });

  it('upscales with crisp pixels', () => {
    const img = solid(2, 2, [10, 20, 30, 255]);
    const big = upscaleNearest(img, 3);
    expect(big.width).toBe(6);
    expect(px(big, 5, 5)).toEqual([10, 20, 30, 255]);
  });
});

describe('quantize', () => {
  it('maps colours into the palette', () => {
    const out = quantize(solid(1, 1, [140, 180, 20, 255]), RETRO_PALETTE);
    expect(RETRO_PALETTE.map((c) => c.join())).toContain(px(out, 0, 0).slice(0, 3).join());
  });

  it('keeps distinct skin tones apart in the game palette', () => {
    const light = nearestColour(250, 215, 180, GAME_PALETTE);
    const deep = nearestColour(90, 60, 40, GAME_PALETTE);
    expect(light).not.toEqual(deep);
  });
});

describe('mask + outline', () => {
  it('clears the corners and outlines the edge', () => {
    const masked = ovalMask(solid(12, 12, [255, 0, 0, 255]), 1);
    expect(px(masked, 0, 0)[3]).toBe(0);
    expect(px(masked, 6, 6)[3]).toBe(255);
    const lined = outline(masked, 1);
    // the pixel just outside the oval at the middle-left becomes outline
    expect(px(lined, 0, 6)[3]).toBe(255);
    expect(px(lined, 0, 0)[3]).toBe(0);
  });
});

describe('stylizeFace', () => {
  const base = solid(256, 256, [220, 170, 130, 255]);

  it('returns the requested size for every pixel size', () => {
    for (const pixelSize of [12, 16, 24, 48] as const) {
      const out = stylizeFace(
        base,
        { style: 'pixel', pixelSize, palette: 'game', outline: true },
        48,
      );
      expect(out.width).toBe(48);
      expect(out.height).toBe(48);
    }
  });

  it('renders the original style at Photo Booth size', () => {
    const out = stylizeFace(
      base,
      { style: 'original', pixelSize: 24, palette: 'full', outline: true },
      240,
    );
    expect(out.width).toBe(240);
    expect(px(out, 120, 120)[3]).toBe(255);
    expect(px(out, 0, 0)[3]).toBe(0);
  });
});
