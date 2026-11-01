import { describe, expect, it } from 'vitest';
import { MESH, type Point } from '../src/face/geometry';
import { buildHeadAlpha, jawLine } from '../src/face/headMask';

/** A round fake face (radius 40) centred at (100, 100) in a 200×260 image. */
function fakeLandmarks(): Point[] {
  const lm: Point[] = Array.from({ length: 478 }, () => ({ x: 100, y: 100 }));
  MESH.oval.forEach((idx, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / MESH.oval.length;
    lm[idx] = { x: 100 + Math.cos(a) * 40, y: 100 + Math.sin(a) * 40 };
  });
  return lm;
}

const W = 200;
const H = 260;
const everyoneIsPerson = {
  conf: new Float32Array(10 * 10).fill(1),
  width: 10,
  height: 10,
  region: { x: 0, y: 0, w: W, h: H },
};

describe('jawLine', () => {
  it('follows the bottom of the oval', () => {
    const oval = MESH.oval.map((i) => fakeLandmarks()[i]);
    const { jawY } = jawLine(oval);
    expect(jawY(100)).toBeCloseTo(140, 0);
  });
});

describe('buildHeadAlpha', () => {
  const { alpha, bbox } = buildHeadAlpha(W, H, everyoneIsPerson, fakeLandmarks());
  const at = (x: number, y: number) => alpha[y * W + x];

  it('keeps the face and the hair above it', () => {
    expect(at(100, 100)).toBe(255);
    expect(at(100, 50)).toBe(255); // hair zone above the forehead
  });

  it('cuts the neck and shoulders below the jaw', () => {
    expect(at(100, 150)).toBe(0); // neck
    expect(at(100, 220)).toBe(0); // shoulders
    expect(at(30, 200)).toBe(0); // shoulder beside the face
  });

  it('drops the background when the segmenter says "not a person"', () => {
    const nobody = { ...everyoneIsPerson, conf: new Float32Array(100) };
    const r = buildHeadAlpha(W, H, nobody, fakeLandmarks());
    expect(r.alpha[50 * W + 100]).toBe(0); // above the face: background
    expect(r.alpha[100 * W + 100]).toBe(255); // the face itself always stays
  });

  it('reports the head box', () => {
    expect(bbox).not.toBeNull();
    expect(bbox!.y + bbox!.h).toBeLessThanOrEqual(143);
  });
});
