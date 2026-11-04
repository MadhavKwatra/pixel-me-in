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

describe('robot', () => {
  it('first crash stumbles, a second one while the robot is close is caught', async () => {
    const { crashOutcome, DANGER_MS } = await import('../src/game/rules');
    expect(crashOutcome(1000, 0)).toBe('stumble');
    expect(crashOutcome(2000, 1000 + DANGER_MS)).toBe('caught');
    expect(crashOutcome(1000 + DANGER_MS + 1, 1000 + DANGER_MS)).toBe('stumble');
  });

  it('attack warnings give time to react', async () => {
    const { LASER_WARN_MS, BOMB_FLIGHT_MS, RUSH_ATTACK_EVERY_MS } =
      await import('../src/game/rules');
    expect(LASER_WARN_MS).toBeGreaterThanOrEqual(700);
    expect(BOMB_FLIGHT_MS).toBeGreaterThanOrEqual(700);
    expect(RUSH_ATTACK_EVERY_MS).toBeGreaterThan(LASER_WARN_MS + 500);
  });

  it('a thrown bomb lands exactly on its mark, after an arc', async () => {
    const { bombArc } = await import('../src/game/rules');
    const from = { x: 100, y: 220 };
    const to = { x: 430, y: 292 };
    expect(bombArc(0, from, to, 110)).toEqual(from);
    expect(bombArc(1, from, to, 110)).toEqual(to);
    expect(bombArc(1.4, from, to, 110)).toEqual(to); // late frames stay on the mark
    expect(bombArc(0.5, from, to, 110).y).toBeLessThan(from.y - 50); // high in the middle
  });

  it('RAM: 1 GB sticks, rare 8 GB RGB sticks, Download More RAM doubles', async () => {
    const { pickRam, ramValue, RAM_RGB_CHANCE } = await import('../src/game/rules');
    expect(ramValue('ram', false)).toBe(1);
    expect(ramValue('ramRgb', false)).toBe(8);
    expect(ramValue('ram', true)).toBe(2);
    const rng = makeRng(7);
    let rgb = 0;
    for (let i = 0; i < 10_000; i++) if (pickRam(rng) === 'ramRgb') rgb++;
    expect(rgb / 10_000).toBeGreaterThan(RAM_RGB_CHANCE * 0.7);
    expect(rgb / 10_000).toBeLessThan(RAM_RGB_CHANCE * 1.3);
  });

  it('a stumble costs a quarter of your RAM (never negative)', async () => {
    const { ramLost } = await import('../src/game/rules');
    expect(ramLost(24)).toBe(6);
    expect(ramLost(3)).toBe(0);
    expect(ramLost(-5)).toBe(0);
  });

  it('RAM milestones fire once, at real PC sizes', async () => {
    const { ramMilestone } = await import('../src/game/rules');
    expect(ramMilestone(6, 7)).toBeNull();
    expect(ramMilestone(7, 8)).toContain('8 GB');
    expect(ramMilestone(8, 9)).toBeNull();
    expect(ramMilestone(14, 22)).toContain('16 GB'); // an RGB stick jumps past it
    expect(ramMilestone(60, 140)).toContain('128 GB'); // the highest one crossed
  });

  it('GB turns into TB', async () => {
    const { formatGB } = await import('../src/game/rules');
    expect(formatGB(12)).toBe('12 GB');
    expect(formatGB(1536)).toBe('1.5 TB');
  });
});
