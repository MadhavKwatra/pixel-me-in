import { describe, expect, it } from 'vitest';
import { isUnlocked } from '../src/storage/unlocks';

const fresh = { best: 0, totalGears: 0, totalDistance: 0, runs: 0 };

describe('unlocks', () => {
  it('free items are always unlocked', () => {
    expect(isUnlocked('cap', fresh)).toBe(true);
  });

  it('locked items open when the rule is met', () => {
    expect(isUnlocked('crown', fresh)).toBe(false);
    expect(isUnlocked('crown', { ...fresh, best: 1500 })).toBe(true);
    expect(isUnlocked('glasses3d', { ...fresh, totalGears: 150 })).toBe(true);
  });
});
