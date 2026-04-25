import { describe, it, expect } from 'vitest';
import { estimatePowerWatts } from './equation';
import { DEFAULT_POWER_CONSTANTS } from './types';
import type { DistanceSegment } from '../gpx/types';

function seg(slopePercent: number, speedKmh: number, distance = 100): DistanceSegment {
  const speedMps = (speedKmh * 1000) / 3600;
  return {
    fromIndex: 0,
    toIndex: 1,
    distanceMeters: distance,
    elevationDeltaMeters: (slopePercent / 100) * distance,
    slopePercent,
    durationSeconds: distance / speedMps,
    speedMps,
  };
}

describe('estimatePowerWatts', () => {
  it('llano a 25 km/h con 70 kg ciclista da ~100-180 W (sanity check)', () => {
    const w = estimatePowerWatts(seg(0, 25), 70);
    expect(w).toBeGreaterThan(80);
    expect(w).toBeLessThan(200);
  });

  it('subida 5% a 15 km/h con 70 kg da ~150-280 W (esfuerzo Z3-Z4)', () => {
    const w = estimatePowerWatts(seg(5, 15), 70);
    expect(w).toBeGreaterThan(150);
    expect(w).toBeLessThan(280);
  });

  it('subida 10% a 10 km/h con 70 kg da ~180-320 W (esfuerzo Z4-Z5)', () => {
    const w = estimatePowerWatts(seg(10, 10), 70);
    expect(w).toBeGreaterThan(180);
    expect(w).toBeLessThan(320);
  });

  it('velocidad cero da 0 W', () => {
    expect(estimatePowerWatts(seg(0, 0), 70)).toBe(0);
  });

  it('bajada fuerte con velocidad alta puede dar 0 (clampa negativos)', () => {
    // Bajada -8% a 50 km/h: gravedad muy negativa, aero positivo pero menor
    const w = estimatePowerWatts(seg(-8, 50), 70);
    expect(w).toBeGreaterThanOrEqual(0);
  });

  it('mas peso = mas potencia en llano (gravedad+rodadura escalan)', () => {
    const w60 = estimatePowerWatts(seg(0, 25), 60);
    const w90 = estimatePowerWatts(seg(0, 25), 90);
    expect(w90).toBeGreaterThan(w60);
  });

  it('mas velocidad en llano = mas potencia (monotonia)', () => {
    const w20 = estimatePowerWatts(seg(0, 20), 70);
    const w30 = estimatePowerWatts(seg(0, 30), 70);
    const w40 = estimatePowerWatts(seg(0, 40), 70);
    expect(w30).toBeGreaterThan(w20);
    expect(w40).toBeGreaterThan(w30);
  });

  it('a velocidad muy alta domina la componente aerodinamica (cubica)', () => {
    // Si v=40 km/h vs v=20 km/h en llano, la diferencia debe ser bastante mas que 2x
    const w20 = estimatePowerWatts(seg(0, 20), 70);
    const w40 = estimatePowerWatts(seg(0, 40), 70);
    expect(w40 / w20).toBeGreaterThan(3);
  });

  it('respeta constantes custom (Crr y CdA mas bajos = menos potencia)', () => {
    const wDefault = estimatePowerWatts(seg(0, 30), 70);
    const wRoad = estimatePowerWatts(seg(0, 30), 70, {
      ...DEFAULT_POWER_CONSTANTS,
      crr: 0.003,
      cdaM2: 0.28,
    });
    expect(wRoad).toBeLessThan(wDefault);
  });
});

describe('BIKE_PRESETS via buildPowerConstants', () => {
  it('road requiere menos potencia que gravel en llano', async () => {
    const { buildPowerConstants } = await import('./types');
    const segment = seg(0, 25);
    const wRoad = estimatePowerWatts(segment, 70, buildPowerConstants(8, 'road'));
    const wGravel = estimatePowerWatts(segment, 70, buildPowerConstants(10, 'gravel'));
    const wMtb = estimatePowerWatts(segment, 70, buildPowerConstants(13, 'mtb'));
    expect(wRoad).toBeLessThan(wGravel);
    expect(wGravel).toBeLessThan(wMtb);
  });

  it('MTB requiere significativamente mas potencia que carretera (>30%)', async () => {
    const { buildPowerConstants } = await import('./types');
    const segment = seg(0, 25);
    const wRoad = estimatePowerWatts(segment, 70, buildPowerConstants(8, 'road'));
    const wMtb = estimatePowerWatts(segment, 70, buildPowerConstants(13, 'mtb'));
    expect(wMtb / wRoad).toBeGreaterThan(1.3);
  });
});
