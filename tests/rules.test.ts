import { describe, expect, it } from 'vitest';
import { ZONE_LENGTH_M } from '../src/config';
import {
  isBossChase,
  makeRng,
  MAX_SPEED,
  nextGapPx,
  pickPattern,
  speedAt,
  START_SPEED,
  zoneIndexAt,
} from '../src/game/rules';

describe('rng', () => {
  it('is repeatable for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('speed', () => {
  it('starts slow, caps at max, slow mode is slower', () => {
    expect(speedAt(0)).toBe(START_SPEED);
    expect(speedAt(1e6)).toBe(MAX_SPEED);
    expect(speedAt(100, true)).toBeLessThan(speedAt(100));
  });
});

describe('zones and boss chase', () => {
  it('changes zone every ZONE_LENGTH_M', () => {
    expect(zoneIndexAt(0)).toBe(0);
    expect(zoneIndexAt(ZONE_LENGTH_M)).toBe(1);
  });
  it('chases only at the end of a zone', () => {
    expect(isBossChase(10)).toBe(false);
    expect(isBossChase(ZONE_LENGTH_M - 5)).toBe(true);
  });
});

describe('fairness', () => {
  it('always leaves at least 0.8 s between patterns', () => {
    const rng = makeRng(7);
    for (let d = 0; d < 5000; d += 50) {
      for (const chase of [false, true]) {
        expect(nextGapPx(rng, d, chase) / speedAt(d)).toBeGreaterThanOrEqual(0.8 - 1e-9);
      }
    }
  });

  it('never picks a power-up while one is active', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 2000; i++) expect(pickPattern(rng, 1000, true)).not.toBe('power');
  });
});

describe('power-up schedule', () => {
  it('gives the first power-up at FIRST_POWER_M and then at least every POWER_PITY_M', async () => {
    const { FIRST_POWER_M, POWER_PITY_M } = await import('../src/game/rules');
    const rng = makeRng(11);
    let last = FIRST_POWER_M - POWER_PITY_M;
    const spawns: number[] = [];
    for (let d = 0; d < 3000; d += 8) {
      if (pickPattern(rng, d, false, last) === 'power') {
        spawns.push(d);
        last = d;
      }
    }
    expect(spawns[0]).toBeLessThanOrEqual(FIRST_POWER_M + 8);
    for (let i = 1; i < spawns.length; i++) {
      expect(spawns[i] - spawns[i - 1]).toBeLessThanOrEqual(POWER_PITY_M + 8);
    }
  });
});
