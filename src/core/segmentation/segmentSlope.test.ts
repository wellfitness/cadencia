import { describe, expect, it } from 'vitest';
import {
  computeSegmentSlopePct,
  FLAT_SLOPE_DISPLAY_THRESHOLD_PCT,
  isSlopeVisuallyFlat,
} from './segmentSlope';

describe('computeSegmentSlopePct', () => {
  const base = {
    startDistanceMeters: 0,
    endDistanceMeters: 1000,
    startElevationMeters: 0,
    endElevationMeters: 0,
  };

  it('devuelve 0 en terreno totalmente llano', () => {
    expect(computeSegmentSlopePct(base)).toBe(0);
  });

  it('calcula subida positiva', () => {
    // 50 m de desnivel en 1000 m horizontales = 5%
    expect(
      computeSegmentSlopePct({ ...base, endElevationMeters: 50 }),
    ).toBeCloseTo(5, 5);
  });

  it('calcula bajada como negativa', () => {
    // -30 m en 1000 m = -3%
    expect(
      computeSegmentSlopePct({ ...base, endElevationMeters: -30 }),
    ).toBeCloseTo(-3, 5);
  });

  it('respeta el offset en startDistanceMeters', () => {
    expect(
      computeSegmentSlopePct({
        startDistanceMeters: 5000,
        endDistanceMeters: 6000,
        startElevationMeters: 100,
        endElevationMeters: 140,
      }),
    ).toBeCloseTo(4, 5);
  });

  it('devuelve 0 si la distancia horizontal es 0 (segmento degenerado o sesión indoor)', () => {
    expect(
      computeSegmentSlopePct({
        startDistanceMeters: 0,
        endDistanceMeters: 0,
        startElevationMeters: 0,
        endElevationMeters: 50,
      }),
    ).toBe(0);
  });

  it('no diverge cuando la distancia es negativa (defensa contra datos corruptos)', () => {
    expect(
      computeSegmentSlopePct({
        startDistanceMeters: 1000,
        endDistanceMeters: 500,
        startElevationMeters: 0,
        endElevationMeters: 100,
      }),
    ).toBe(0);
  });
});

describe('isSlopeVisuallyFlat', () => {
  it('considera llano valores estrictamente por debajo del umbral', () => {
    expect(isSlopeVisuallyFlat(0)).toBe(true);
    expect(isSlopeVisuallyFlat(0.5)).toBe(true);
    expect(isSlopeVisuallyFlat(-0.9)).toBe(true);
  });

  it('NO considera llano valores en o por encima del umbral', () => {
    expect(isSlopeVisuallyFlat(FLAT_SLOPE_DISPLAY_THRESHOLD_PCT)).toBe(false);
    expect(isSlopeVisuallyFlat(2)).toBe(false);
    expect(isSlopeVisuallyFlat(-1.5)).toBe(false);
  });
});
