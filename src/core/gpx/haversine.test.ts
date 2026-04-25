import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters } from './haversine';

describe('haversineDistanceMeters', () => {
  it('mismo punto = 0', () => {
    expect(haversineDistanceMeters(40.4168, -3.7038, 40.4168, -3.7038)).toBe(0);
  });

  it('Paris -> Londres ~ 343 km (referencia conocida)', () => {
    // Paris (Notre Dame): 48.8530, 2.3499
    // London (St Paul's): 51.5138, -0.0984
    const d = haversineDistanceMeters(48.853, 2.3499, 51.5138, -0.0984);
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(346_000);
  });

  it('Madrid -> Barcelona ~ 504 km', () => {
    // Madrid: 40.4168, -3.7038
    // Barcelona: 41.3851, 2.1734
    const d = haversineDistanceMeters(40.4168, -3.7038, 41.3851, 2.1734);
    expect(d).toBeGreaterThan(500_000);
    expect(d).toBeLessThan(508_000);
  });

  it('puntos antipodales ~ pi * R (~20015 km)', () => {
    const d = haversineDistanceMeters(0, 0, 0, 180);
    const expected = Math.PI * 6_371_000;
    expect(d).toBeCloseTo(expected, -2); // tolerancia 100m
  });

  it('distancia corta entre puntos consecutivos de GPX (<100m) es coherente', () => {
    // Dos puntos separados ~30m a 42 grados lat
    // 1 grado lat ~ 111111 m, asi que delta=0.00027 grados ~= 30m
    const d = haversineDistanceMeters(42.0, -8.0, 42.00027, -8.0);
    expect(d).toBeGreaterThan(28);
    expect(d).toBeLessThan(32);
  });
});
