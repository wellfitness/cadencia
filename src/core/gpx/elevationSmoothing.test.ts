import { describe, it, expect } from 'vitest';
import { smoothElevation } from './elevationSmoothing';
import type { GpxPoint } from './types';

function pt(lat: number, lon: number, ele: number): GpxPoint {
  return { lat, lon, ele, time: null };
}

describe('smoothElevation', () => {
  it('devuelve array de la misma longitud', () => {
    const points = [pt(42, -8, 100), pt(42.001, -8, 102), pt(42.002, -8, 101)];
    const smoothed = smoothElevation(points, 50);
    expect(smoothed).toHaveLength(points.length);
  });

  it('elevación constante: salida idéntica', () => {
    const points = Array.from({ length: 10 }, (_, i) => pt(42 + 0.0001 * i, -8, 100));
    const smoothed = smoothElevation(points, 50);
    for (const e of smoothed) expect(e).toBeCloseTo(100, 5);
  });

  it('diente de sierra ±2m sobre línea base llana: amplitud reducida', () => {
    // Puntos cada ~11.1 m (0.0001 grado lat) con elevación 100/102/100/102…
    const points = Array.from({ length: 21 }, (_, i) =>
      pt(42 + 0.0001 * i, -8, i % 2 === 0 ? 100 : 102),
    );
    const smoothed = smoothElevation(points, 50); // ~5 puntos por ventana
    // Los puntos centrales deben converger hacia la media (~101)
    const middle = smoothed.slice(5, 15);
    for (const e of middle) {
      expect(e).toBeGreaterThan(100.4);
      expect(e).toBeLessThan(101.6);
    }
  });

  it('escalón real (subida sostenida): se conserva la pendiente media', () => {
    // 20 puntos cada ~11 m, elevación que sube linealmente 0→38 m
    const points = Array.from({ length: 20 }, (_, i) => pt(42 + 0.0001 * i, -8, i * 2));
    const smoothed = smoothElevation(points, 50);
    // El primer y último punto suavizados conservan grosso modo el rango
    expect(smoothed[0]!).toBeLessThan(10);
    expect(smoothed[smoothed.length - 1]!).toBeGreaterThan(28);
  });

  it('window=0: pasa-through (sin suavizado)', () => {
    const points = [pt(42, -8, 100), pt(42.001, -8, 105)];
    const smoothed = smoothElevation(points, 0);
    expect(smoothed[0]!).toBe(100);
    expect(smoothed[1]!).toBe(105);
  });

  it('array vacío: devuelve array vacío', () => {
    expect(smoothElevation([], 50)).toEqual([]);
  });
});
