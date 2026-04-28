import { describe, it, expect } from 'vitest';
import { segmentInto60SecondBlocks } from './blocks';
import type { GpxTrack } from '../gpx/types';
import type { ValidatedUserInputs } from '../user/userInputs';

const validatedRider: ValidatedUserInputs = {
  weightKg: 70,
  ftpWatts: 200,
  effectiveMaxHr: null,
  restingHeartRate: null,
  birthYear: null,
  sex: null,
  bikeWeightKg: 10,
  bikeType: 'gravel',
  hasFtp: true,
  hasHeartRateZones: false,
};

/**
 * Genera una ruta sintetica de N puntos consecutivos llanos a 25 km/h
 * con timestamps reales. Usado para tests deterministicos.
 */
function syntheticFlatTrack(numPoints: number, secondsBetween = 5): GpxTrack {
  const speedMps = (25 * 1000) / 3600; // ~6.94
  const distancePerStep = speedMps * secondsBetween;
  // 1 grado lat ~111111 m
  const dLat = distancePerStep / 111111;
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  return {
    name: 'flat synthetic',
    hasTimestamps: true,
    points: Array.from({ length: numPoints }, (_, i) => ({
      lat: 42 + dLat * i,
      lon: -8,
      ele: 100,
      time: new Date(start + i * secondsBetween * 1000),
    })),
  };
}

describe('segmentInto60SecondBlocks', () => {
  it('ruta corta (< 60s) cabe en un solo bloque parcial', () => {
    const track = syntheticFlatTrack(5, 5); // 4 segments * 5s = 20s total
    const { segments, meta } = segmentInto60SecondBlocks(track, validatedRider);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.durationSec).toBeCloseTo(20, 1);
    expect(meta.totalDurationSec).toBeCloseTo(20, 1);
  });

  it('ruta de 5 minutos genera ~5 bloques de 60s', () => {
    // 5 min = 300s, 5s entre puntos = 60 puntos -> 59 segmentos -> 5 bloques de 60s
    const track = syntheticFlatTrack(60, 5);
    const { segments, meta } = segmentInto60SecondBlocks(track, validatedRider);
    expect(segments.length).toBeGreaterThanOrEqual(4);
    expect(segments.length).toBeLessThanOrEqual(6);
    // Cada bloque dura ~60s salvo posiblemente el ultimo
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i]?.durationSec).toBeGreaterThanOrEqual(60);
      expect(segments[i]?.durationSec).toBeLessThan(70);
    }
    expect(meta.totalDurationSec).toBeCloseTo(295, 0); // 59 * 5 = 295
  });

  it('meta.totalDistance es coherente con el track', () => {
    const track = syntheticFlatTrack(60, 5);
    const { meta } = segmentInto60SecondBlocks(track, validatedRider);
    // 59 segmentos * ~34.7m = ~2050m
    expect(meta.totalDistanceMeters).toBeGreaterThan(1900);
    expect(meta.totalDistanceMeters).toBeLessThan(2200);
  });

  it('NP >= averagePower (igualdad solo si potencia constante)', () => {
    const track = syntheticFlatTrack(60, 5);
    const { meta } = segmentInto60SecondBlocks(track, validatedRider);
    expect(meta.normalizedPowerWatts).toBeGreaterThanOrEqual(meta.averagePowerWatts - 0.001);
  });

  it('zoneDurationsSec suman aproximadamente totalDurationSec', () => {
    const track = syntheticFlatTrack(60, 5);
    const { meta } = segmentInto60SecondBlocks(track, validatedRider);
    const sumZones = Object.values(meta.zoneDurationsSec).reduce((a, b) => a + b, 0);
    expect(sumZones).toBeCloseTo(meta.totalDurationSec, 0);
  });

  it('hadRealTimestamps refleja el track', () => {
    const trackWithTime = syntheticFlatTrack(10, 5);
    const trackNoTime: GpxTrack = {
      ...trackWithTime,
      hasTimestamps: false,
      points: trackWithTime.points.map((p) => ({ ...p, time: null })),
    };
    expect(segmentInto60SecondBlocks(trackWithTime, validatedRider).meta.hadRealTimestamps).toBe(true);
    expect(segmentInto60SecondBlocks(trackNoTime, validatedRider).meta.hadRealTimestamps).toBe(false);
  });
});
