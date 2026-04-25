import { describe, it, expect } from 'vitest';
import { calculateMaxHeartRateGulati } from './maxHeartRate';

describe('calculateMaxHeartRateGulati', () => {
  it('returns ~192 bpm for a 30-year-old', () => {
    expect(calculateMaxHeartRateGulati(30)).toBeCloseTo(191.8, 1);
  });

  it('returns ~179 bpm for a 50-year-old', () => {
    expect(calculateMaxHeartRateGulati(50)).toBeCloseTo(179, 1);
  });

  it('decreases monotonically with age', () => {
    const at25 = calculateMaxHeartRateGulati(25);
    const at40 = calculateMaxHeartRateGulati(40);
    const at60 = calculateMaxHeartRateGulati(60);
    expect(at25).toBeGreaterThan(at40);
    expect(at40).toBeGreaterThan(at60);
  });

  it.each([0, -10, NaN, Infinity, 200])('throws on invalid age %p', (age) => {
    expect(() => calculateMaxHeartRateGulati(age)).toThrow(RangeError);
  });
});
