import { describe, expect, it } from 'vitest';
import { BODY_FRAMES, BODY_H, BODY_W, layout, NECK } from '../src/art/body';

describe('body skeleton', () => {
  it('keeps every neck point inside the frame', () => {
    for (const f of BODY_FRAMES) {
      expect(NECK[f].x).toBeGreaterThanOrEqual(0);
      expect(NECK[f].x).toBeLessThan(BODY_W);
      expect(NECK[f].y).toBeGreaterThanOrEqual(0);
      expect(NECK[f].y).toBeLessThan(BODY_H);
    }
  });

  it('puts a foot on the ground in every running frame', () => {
    for (const f of BODY_FRAMES.filter((n) => n.startsWith('run'))) {
      const j = layout(f);
      const lowest = Math.max(j.legF.ankle.y, j.legB.ankle.y) + 2;
      expect(lowest).toBeCloseTo(BODY_H - 1, 0);
    }
  });

  it('sliding is much lower than standing', () => {
    expect(NECK.slide.y - NECK.idle.y).toBeGreaterThan(12);
  });
});
