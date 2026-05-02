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

/**
 * Genera un track sintetico de subida sostenida con velocidad realista de
 * gravel/MTB (10 km/h) y pendiente parametrizable. Reproduce el caso del bug
 * original: la potencia mecanica calculada cae a niveles bajos por la
 * velocidad reducida y el modelo Coggan puro mete los bloques en Z2/Z3, lo
 * que activaba el sintoma "todo Z1/Z2 en gravel" hasta que llego el floor.
 */
function syntheticClimbingTrack(slopeFraction: number): GpxTrack {
  const numPoints = 60; // 5 min a 5s entre puntos
  const speedMps = (10 * 1000) / 3600; // ~2.78 m/s
  const secondsBetween = 5;
  const distancePerStep = speedMps * secondsBetween; // ~13.9 m
  const elevPerStep = distancePerStep * slopeFraction;
  // 1 grado lat ~111111 m. Avanza solo en latitud, lon constante.
  const dLat = distancePerStep / 111111;
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  return {
    name: `subida ${(slopeFraction * 100).toFixed(0)}% sintetica`,
    hasTimestamps: true,
    points: Array.from({ length: numPoints }, (_, i) => ({
      lat: 42 + dLat * i,
      lon: -8,
      ele: 100 + elevPerStep * i,
      time: new Date(start + i * secondsBetween * 1000),
    })),
  };
}

describe('segmentInto60SecondBlocks: la zonificacion bike+gpx depende del tipo de bici', () => {
  // Bug regresion: antes del floor por pendiente, los tres bicis producian la
  // misma distribucion porque la potencia mecanica subestimaba el esfuerzo en
  // gravel/MTB. Tras el floor, MTB > gravel >= road para la misma subida.
  // Trabajamos con pendientes alejadas de los bordes exactos de la tabla
  // (8/10/11/12 %) para que jitter de haversine no nos ponga en frontera.

  it('rampa 10,3% en MTB: la mayoria del tiempo en Z6 (floor MTB Z6 desde 10%)', () => {
    // 10.3 % esta dentro del rango Z6 mtb (10-13) y Z5 road/gravel (9-12, 8-11).
    const climbing = syntheticClimbingTrack(0.103);
    const mtb = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'mtb' });
    expect(mtb.meta.zoneDurationsSec[6]).toBeGreaterThan(mtb.meta.totalDurationSec / 2);
  });

  it('rampa 10,3% en road y gravel: la mayoria del tiempo en Z5 (floor road/gravel Z5)', () => {
    const climbing = syntheticClimbingTrack(0.103);
    const road = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'road' });
    const gravel = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'gravel' });
    expect(road.meta.zoneDurationsSec[5]).toBeGreaterThan(road.meta.totalDurationSec / 2);
    expect(gravel.meta.zoneDurationsSec[5]).toBeGreaterThan(gravel.meta.totalDurationSec / 2);
    // Z6 NO se activa en estas dos tablas con 10.3 %.
    expect(road.meta.zoneDurationsSec[6]).toBe(0);
    expect(gravel.meta.zoneDurationsSec[6]).toBe(0);
  });

  it('rampa 10,3% road/gravel vs MTB: distribuciones DISTINTAS (regresion del bug "todo igual")', () => {
    const climbing = syntheticClimbingTrack(0.103);
    const road = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'road' });
    const gravel = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'gravel' });
    const mtb = segmentInto60SecondBlocks(climbing, { ...validatedRider, bikeType: 'mtb' });
    // MTB esta mayoritariamente en Z6; road/gravel mayoritariamente en Z5.
    expect(mtb.meta.zoneDurationsSec[6]).toBeGreaterThan(road.meta.zoneDurationsSec[6]);
    expect(mtb.meta.zoneDurationsSec[6]).toBeGreaterThan(gravel.meta.zoneDurationsSec[6]);
    expect(road.meta.zoneDurationsSec[5]).toBeGreaterThan(mtb.meta.zoneDurationsSec[5]);
    expect(gravel.meta.zoneDurationsSec[5]).toBeGreaterThan(mtb.meta.zoneDurationsSec[5]);
  });

  it('rampa intermedia 4,5%: road queda mas bajo que gravel/MTB (separacion road vs no-road)', () => {
    // 4.5 % cae en road->Z2 [3,5), gravel->Z3 [4,6), mtb->Z3 [3,5).
    const gentle = syntheticClimbingTrack(0.045);
    const road = segmentInto60SecondBlocks(gentle, { ...validatedRider, bikeType: 'road' });
    const gravel = segmentInto60SecondBlocks(gentle, { ...validatedRider, bikeType: 'gravel' });
    const mtb = segmentInto60SecondBlocks(gentle, { ...validatedRider, bikeType: 'mtb' });
    // Road tiene MAS tiempo en Z1-Z2 que gravel/mtb (que estan empujados al
    // floor mas alto). Validar la asimetria sin depender de boundaries
    // exactos.
    const roadLow = road.meta.zoneDurationsSec[1] + road.meta.zoneDurationsSec[2];
    const gravelLow = gravel.meta.zoneDurationsSec[1] + gravel.meta.zoneDurationsSec[2];
    const mtbLow = mtb.meta.zoneDurationsSec[1] + mtb.meta.zoneDurationsSec[2];
    expect(roadLow).toBeGreaterThan(gravelLow);
    expect(roadLow).toBeGreaterThan(mtbLow);
  });
});
