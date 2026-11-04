import { describe, expect, it } from 'vitest';
import { bucket, GB_STEPS, METRE_STEPS, statsAllowed } from '../src/analytics';

describe('anonymous stats', () => {
  it('sends rough buckets, never exact numbers', () => {
    expect(bucket(0, METRE_STEPS)).toBe('0');
    expect(bucket(42, METRE_STEPS)).toBe('1-99');
    expect(bucket(480, METRE_STEPS)).toBe('250-499');
    expect(bucket(9000, METRE_STEPS)).toBe('5000+');
    expect(bucket(16, GB_STEPS)).toBe('16-31');
  });

  it('is off in dev and test builds', () => {
    expect(statsAllowed()).toBe(false);
  });
});
