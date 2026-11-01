import { describe, expect, it } from 'vitest';
import {
  ANCHORS,
  cropFromDetection,
  outputToSource,
  pickMainFace,
  type FaceDetection,
} from '../src/face/geometry';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 4);

describe('cropFromDetection', () => {
  it('puts level eyes at the anchor points', () => {
    const face: FaceDetection = {
      box: { x: 0, y: 0, w: 100, h: 100 },
      leftEye: { x: 100, y: 200 },
      rightEye: { x: 160, y: 200 },
      score: 0.9,
    };
    const t = cropFromDetection(face);
    close(t.angle, 0);
    close(t.side, 60 / ANCHORS.eyeSpan);

    const size = 256;
    const left = outputToSource(t, size, {
      x: size * (0.5 - ANCHORS.eyeSpan / 2),
      y: size * ANCHORS.eyeY,
    });
    close(left.x, 100);
    close(left.y, 200);
  });

  it('levels tilted eyes', () => {
    const face: FaceDetection = {
      box: { x: 0, y: 0, w: 100, h: 100 },
      leftEye: { x: 100, y: 100 },
      rightEye: { x: 150, y: 150 },
      score: 0.9,
    };
    const t = cropFromDetection(face);
    close(t.angle, Math.PI / 4);
    const size = 100;
    const right = outputToSource(t, size, {
      x: size * (0.5 + ANCHORS.eyeSpan / 2),
      y: size * ANCHORS.eyeY,
    });
    close(right.x, 150);
    close(right.y, 150);
  });

  it('falls back to the box when eyes are missing', () => {
    const t = cropFromDetection({ box: { x: 10, y: 20, w: 100, h: 80 }, score: 0.5 });
    expect(t.angle).toBe(0);
    close(t.cx, 60);
    expect(t.side).toBeGreaterThan(100);
  });
});

describe('pickMainFace', () => {
  it('picks the biggest face', () => {
    const small = { box: { x: 0, y: 0, w: 10, h: 10 }, score: 1 };
    const big = { box: { x: 0, y: 0, w: 50, h: 50 }, score: 0.6 };
    expect(pickMainFace([small, big])).toBe(big);
    expect(pickMainFace([])).toBeUndefined();
  });
});
