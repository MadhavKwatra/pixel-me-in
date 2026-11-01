import { describe, expect, it } from 'vitest';
import { computeView, playerX } from '../src/game/view';
import { GestureTracker } from '../src/ui/gestures';

describe('gestures', () => {
  it('a quick tap jumps', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(1, 102, 101, 120)).toEqual(['jumpTap']);
  });

  it('a long press is not a tap', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(1, 100, 100, 800)).toEqual([]);
  });

  it('swipe down slides while held, releases on lift', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.move(1, 100, 110)).toEqual([]);
    expect(g.move(1, 100, 140)).toEqual(['slideDown']);
    expect(g.move(1, 100, 200)).toEqual([]);
    expect(g.up(1, 100, 200, 400)).toEqual(['slideUp']);
  });

  it('swipe up jumps once, right away', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.move(1, 100, 60)).toEqual(['jumpTap']);
    expect(g.up(1, 100, 40, 90)).toEqual([]);
  });

  it('two fingers are tracked separately', () => {
    const g = new GestureTracker();
    g.down(1, 50, 100, 0);
    g.down(2, 300, 100, 10);
    expect(g.move(1, 50, 150)).toEqual(['slideDown']);
    expect(g.up(2, 300, 100, 60)).toEqual(['jumpTap']);
    expect(g.cancel(1)).toEqual(['slideUp']);
  });
});

describe('camera view', () => {
  it('landscape 16:9 shows exactly the 640×360 world', () => {
    const v = computeView(1280, 720);
    expect(v.width).toBeCloseTo(640);
    expect(v.height).toBeCloseTo(360);
    expect(v.top).toBeCloseTo(0);
  });

  it('wide phones see further ahead', () => {
    expect(computeView(915, 412).width).toBeGreaterThan(700);
  });

  it('16:10 desktop keeps 640 wide and adds sky on top', () => {
    const v = computeView(1280, 800);
    expect(v.width).toBeCloseTo(640);
    expect(v.top).toBeLessThan(0);
  });

  it('portrait fills the screen with the ground ~64% down', () => {
    const v = computeView(390, 844);
    expect(v.portrait).toBe(true);
    expect(v.width).toBe(420);
    expect((300 - v.top) / v.height).toBeCloseTo(0.64);
    expect(playerX(v)).toBeLessThanOrEqual(150);
  });
});
