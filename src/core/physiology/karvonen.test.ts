import { describe, it, expect } from 'vitest';
import { calculateKarvonenZones } from './karvonen';

describe('calculateKarvonenZones', () => {
  it('returns 5 contiguous zones', () => {
    const zones = calculateKarvonenZones(190, 60);
    expect(zones).toHaveLength(5);
    for (let i = 0; i < zones.length - 1; i++) {
      expect(zones[i]!.maxBpm).toBeCloseTo(zones[i + 1]!.minBpm, 5);
    }
  });

  it('Z5 upper bound equals max HR', () => {
    const zones = calculateKarvonenZones(190, 60);
    expect(zones[4]!.maxBpm).toBe(190);
  });

  it('Z1 lower bound equals resting + 50% of reserve', () => {
    const zones = calculateKarvonenZones(200, 50);
    expect(zones[0]!.minBpm).toBe(50 + 0.5 * 150);
  });

  it.each([
    [180, 200],
    [180, 180],
    [0, 60],
    [180, 0],
    [NaN, 60],
  ])('throws on invalid inputs (max=%p, rest=%p)', (max, rest) => {
    expect(() => calculateKarvonenZones(max, rest)).toThrow(RangeError);
  });
});
