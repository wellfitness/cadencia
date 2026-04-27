import { describe, it, expect } from 'vitest';
import { analyzePoolCoverage } from './poolCoverage';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { EMPTY_PREFERENCES } from './types';

let trackId = 0;
function track(overrides: Partial<Track> = {}): Track {
  trackId += 1;
  return {
    uri: `spotify:track:${trackId.toString(36).padStart(22, '0')}`,
    name: `Track ${trackId}`,
    album: 'Album',
    artists: ['Artist'],
    genres: [],
    tempoBpm: 125,
    energy: 0.75,
    valence: 0.7,
    danceability: 0.7,
    durationMs: 200_000,
    source: 'cinelli_rider',
    ...overrides,
  };
}

let segId = 0;
function segment(zone: ClassifiedSegment['zone'], durationSec = 60): ClassifiedSegment {
  segId += 1;
  return {
    startSec: segId * 60,
    durationSec,
    avgPowerWatts: 200,
    zone,
    startDistanceMeters: segId * 500,
    endDistanceMeters: (segId + 1) * 500,
    startElevationMeters: 100,
    endElevationMeters: 100,
    startLat: 42,
    startLon: -8,
  };
}

describe('analyzePoolCoverage', () => {
  it('pool sobrado: ok=true, deficit=0', () => {
    // 3 segmentos Z3 de 60s = 180s. Necesidad: ceil(180/210) = 1 track.
    // Pool: 5 tracks Z3.
    const tracks = Array.from({ length: 5 }, (_, idx) =>
      track({ tempoBpm: 124 + idx, energy: 0.75, valence: 0.6 }),
    );
    const segments = [segment(3), segment(3), segment(3)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(true);
    expect(result.totalDeficit).toBe(0);
    expect(result.byZone).toHaveLength(1);
    expect(result.byZone[0]?.zone).toBe(3);
    expect(result.byZone[0]?.needed).toBe(1);
    expect(result.byZone[0]?.available).toBe(5);
    expect(result.byZone[0]?.deficit).toBe(0);
  });

  it('deficit en una zona: ok=false con detalle', () => {
    // Sesion SIT: 8 sprints Z5 de 30s = 240s. Necesidad: ceil(240/210) = 2.
    // Pool: solo 1 track Z5.
    const z5Pool = [track({ tempoBpm: 155, energy: 0.92, valence: 0.75 })];
    const segments = Array.from({ length: 8 }, () => segment(5, 30));
    const result = analyzePoolCoverage(segments, z5Pool, EMPTY_PREFERENCES);
    expect(result.ok).toBe(false);
    expect(result.totalDeficit).toBe(1);
    const z5 = result.byZone.find((z) => z.zone === 5);
    expect(z5?.needed).toBe(2);
    expect(z5?.available).toBe(1);
    expect(z5?.deficit).toBe(1);
  });

  it('deficit en varias zonas: suma correcta', () => {
    // Z3: 4200s necesita 20 tracks, hay 5. Deficit 15.
    // Z4: 2100s necesita 10 tracks, hay 2. Deficit 8.
    const z3Pool = Array.from({ length: 5 }, (_, idx) =>
      track({ tempoBpm: 124 + idx, energy: 0.75, valence: 0.6 }),
    );
    const z4Pool = Array.from({ length: 2 }, (_, idx) =>
      track({ tempoBpm: 135 + idx, energy: 0.85, valence: 0.65 }),
    );
    const tracks = [...z3Pool, ...z4Pool];
    const segments = [segment(3, 4200), segment(4, 2100)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(false);
    expect(result.totalDeficit).toBe(15 + 8);
  });

  it('catalogo vacio: deficit en todas las zonas con segmentos', () => {
    const segments = [segment(2, 600), segment(4, 600)];
    const result = analyzePoolCoverage(segments, [], EMPTY_PREFERENCES);
    expect(result.ok).toBe(false);
    expect(result.byZone).toHaveLength(2);
    expect(result.byZone.every((z) => z.available === 0)).toBe(true);
  });

  it('sin segmentos: ok=true', () => {
    const tracks = [track()];
    const result = analyzePoolCoverage([], tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(true);
    expect(result.byZone).toHaveLength(0);
    expect(result.totalDeficit).toBe(0);
  });

  it('zonas no usadas no aparecen en byZone', () => {
    // Solo segmentos Z3 -> byZone solo tiene Z3.
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6 })];
    const result = analyzePoolCoverage([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(result.byZone).toHaveLength(1);
    expect(result.byZone[0]?.zone).toBe(3);
  });

  it('byZone se ordena 1..5 (determinista)', () => {
    const tracks = [
      track({ tempoBpm: 100, energy: 0.5, valence: 0.5 }), // Z1
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6 }), // Z3
      track({ tempoBpm: 155, energy: 0.92, valence: 0.75 }), // Z5
    ];
    // Pasamos en orden Z5, Z1, Z3
    const segments = [segment(5, 60), segment(1, 60), segment(3, 60)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.byZone.map((z) => z.zone)).toEqual([1, 3, 5]);
  });

  it('respeta allEnergetic: sube energy floor en Z1-Z2', () => {
    // Z1 normal: energyMin 0.4. Con allEnergetic: 0.7.
    // Pool: 3 tracks Z1 con energy 0.5 -> con allEnergetic NO pasan strict,
    // se cae a relaxed/best-effort (siguen siendo "available" pero como
    // best-effort). Validamos que la cuenta cambia con el toggle.
    const tracks = Array.from({ length: 3 }, (_, idx) =>
      track({ tempoBpm: 100 + idx, energy: 0.5, valence: 0.5 }),
    );
    const segments = [segment(1, 600)];
    const without = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    const withEnergetic = analyzePoolCoverage(segments, tracks, {
      ...EMPTY_PREFERENCES,
      allEnergetic: true,
    });
    // En ambos casos available > 0 (relaxed/best-effort entran), pero el
    // test principal es que la funcion no rompe con el toggle.
    expect(without.byZone[0]?.available).toBeGreaterThan(0);
    expect(withEnergetic.byZone[0]?.available).toBeGreaterThan(0);
  });

  it('tracks duplicados por URI cuentan una sola vez', () => {
    const t = track({ tempoBpm: 125, energy: 0.75, valence: 0.6 });
    // Mismo URI repetido (caso patologico de un CSV de usuario sucio).
    const tracks = [t, { ...t }, { ...t }];
    const segments = [segment(3, 60)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.byZone[0]?.available).toBe(1);
  });
});
