import { describe, it, expect } from 'vitest';
import { calculateMaxHeartRate } from './maxHeartRate';

describe('calculateMaxHeartRate', () => {
  describe('mujer (Gulati 2010): 206 - 0.88*edad', () => {
    it('30 anos -> ~179.6 bpm', () => {
      expect(calculateMaxHeartRate(30, 'female')).toBeCloseTo(179.6, 1);
    });

    it('50 anos -> 162 bpm', () => {
      expect(calculateMaxHeartRate(50, 'female')).toBeCloseTo(162, 1);
    });
  });

  describe('hombre (Tanaka 2001): 208 - 0.7*edad', () => {
    it('30 anos -> 187 bpm', () => {
      expect(calculateMaxHeartRate(30, 'male')).toBeCloseTo(187, 1);
    });

    it('50 anos -> 173 bpm', () => {
      expect(calculateMaxHeartRate(50, 'male')).toBeCloseTo(173, 1);
    });
  });

  it('mismo edad: hombre da FC max mayor que mujer (literatura)', () => {
    for (const age of [25, 35, 45, 55, 65]) {
      expect(calculateMaxHeartRate(age, 'male')).toBeGreaterThan(
        calculateMaxHeartRate(age, 'female'),
      );
    }
  });

  it('decrece monotonamente con la edad para ambos sexos', () => {
    for (const sex of ['female', 'male'] as const) {
      const at25 = calculateMaxHeartRate(25, sex);
      const at40 = calculateMaxHeartRate(40, sex);
      const at60 = calculateMaxHeartRate(60, sex);
      expect(at25).toBeGreaterThan(at40);
      expect(at40).toBeGreaterThan(at60);
    }
  });

  it.each([0, -10, NaN, Infinity, 200])('throws on invalid age %p', (age) => {
    expect(() => calculateMaxHeartRate(age, 'female')).toThrow(RangeError);
    expect(() => calculateMaxHeartRate(age, 'male')).toThrow(RangeError);
  });
});
