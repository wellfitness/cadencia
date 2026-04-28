import { describe, it, expect } from 'vitest';
import { computeSegments } from './segments';
import type { GpxTrack } from './types';

function makeTrack(
  points: Array<{ lat: number; lon: number; ele: number; time?: string }>,
): GpxTrack {
  const hasTimestamps = points.every((p) => p.time !== undefined);
  return {
    name: 'test',
    hasTimestamps,
    points: points.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      ele: p.ele,
      time: p.time !== undefined ? new Date(p.time) : null,
    })),
  };
}

describe('computeSegments', () => {
  it('produce N-1 segmentos para N puntos', () => {
    const track = makeTrack([
      { lat: 42.0, lon: -8.0, ele: 0 },
      { lat: 42.001, lon: -8.0, ele: 5 },
      { lat: 42.002, lon: -8.0, ele: 10 },
    ]);
    expect(computeSegments(track)).toHaveLength(2);
  });

  it('llano con timestamps: velocidad real coherente', () => {
    // 30 m en 6 s = 5 m/s = 18 km/h, llano
    const track = makeTrack([
      { lat: 42.0, lon: -8.0, ele: 100, time: '2026-01-01T00:00:00Z' },
      { lat: 42.00027, lon: -8.0, ele: 100, time: '2026-01-01T00:00:06Z' },
    ]);
    const [s] = computeSegments(track);
    expect(s).toBeDefined();
    expect(s!.distanceMeters).toBeGreaterThan(28);
    expect(s!.distanceMeters).toBeLessThan(32);
    expect(s!.durationSeconds).toBe(6);
    expect(s!.speedMps).toBeCloseTo(s!.distanceMeters / 6, 5);
    expect(s!.slopePercent).toBe(0);
  });

  it('cuesta arriba con timestamps: pendiente positiva, velocidad menor', () => {
    // 30 m horizontal, +3 m elevacion = ~10% pendiente
    const track = makeTrack([
      { lat: 42.0, lon: -8.0, ele: 100, time: '2026-01-01T00:00:00Z' },
      { lat: 42.00027, lon: -8.0, ele: 103, time: '2026-01-01T00:00:10Z' },
    ]);
    const [s] = computeSegments(track);
    expect(s).toBeDefined();
    expect(s!.slopePercent).toBeGreaterThan(8);
    expect(s!.slopePercent).toBeLessThanOrEqual(30); // clampada
    expect(s!.elevationDeltaMeters).toBe(3);
  });

  it('sin timestamps: usa velocidad estimada por pendiente (llano = 25 km/h)', () => {
    const track = makeTrack([
      { lat: 42.0, lon: -8.0, ele: 100 },
      { lat: 42.001, lon: -8.0, ele: 100 },
    ]);
    const [s] = computeSegments(track);
    expect(s!.speedMps).toBeCloseTo((25 * 1000) / 3600, 2); // 6.94 m/s
  });

  it('pendiente clampada al limite si la distancia es muy corta', () => {
    // Distancia muy pequena con elevacion grande -> pendiente >>30%
    const track = makeTrack([
      { lat: 42.0, lon: -8.0, ele: 100 },
      { lat: 42.000001, lon: -8.0, ele: 200 },
    ]);
    const [s] = computeSegments(track);
    expect(Math.abs(s!.slopePercent)).toBeLessThanOrEqual(30);
  });

  it('diente de sierra GPS: pendiente suavizada se mantiene cercana a 0%', () => {
    // Puntos cada ~11 m con elevación oscilando ±1 m sobre línea base llana.
    // Sin smoothing producirían pendientes ±9% alternantes; con smoothing,
    // < ±2%.
    const points = Array.from({ length: 21 }, (_, i) => ({
      lat: 42 + 0.0001 * i,
      lon: -8,
      ele: i % 2 === 0 ? 100 : 102,
    }));
    const track = makeTrack(points);
    const segments = computeSegments(track);
    // Ignorar primer y último segmento (efectos de borde de la ventana)
    const middle = segments.slice(2, segments.length - 2);
    for (const s of middle) {
      expect(Math.abs(s.slopePercent)).toBeLessThan(5);
    }
  });
});
