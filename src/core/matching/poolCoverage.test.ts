import { describe, it, expect } from 'vitest';
import { analyzePoolCoverage } from './poolCoverage';
import { defaultCadenceProfile } from '../segmentation/sessionPlan';
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
    tempoBpm: 87,
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
    cadenceProfile: defaultCadenceProfile(zone),
    startDistanceMeters: segId * 500,
    endDistanceMeters: (segId + 1) * 500,
    startElevationMeters: 100,
    endElevationMeters: 100,
    startLat: 42,
    startLon: -8,
  };
}

describe('analyzePoolCoverage', () => {
  it('pool global suficiente -> ok=true aunque alguna combo este ajustada', () => {
    // 60 min total = ceil(3600/210) = 18 tracks unicos necesarios.
    // Pool de 25 tracks unicos -> ok=true.
    const tracks = Array.from({ length: 25 }, (_, idx) =>
      track({ tempoBpm: 80 + idx, energy: 0.75 }),
    );
    const segments = [segment(3, 1800), segment(4, 1800)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(true);
    expect(result.neededTotal).toBe(18);
    expect(result.availableTotal).toBe(25);
    expect(result.deficitTotal).toBe(0);
  });

  it('pool global insuficiente -> ok=false con detalle del deficit', () => {
    // 1h total = 18 tracks necesarios, solo hay 5 -> deficit 13.
    const tracks = Array.from({ length: 5 }, (_, idx) =>
      track({ tempoBpm: 80 + idx, energy: 0.75 }),
    );
    const segments = [segment(3, 3600)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(false);
    expect(result.neededTotal).toBe(18);
    expect(result.availableTotal).toBe(5);
    expect(result.deficitTotal).toBe(13);
  });

  it('catalogo vacio: deficit total = neededTotal', () => {
    const segments = [segment(2, 600), segment(4, 600)];
    const result = analyzePoolCoverage(segments, [], EMPTY_PREFERENCES);
    expect(result.ok).toBe(false);
    expect(result.availableTotal).toBe(0);
    expect(result.deficitTotal).toBe(result.neededTotal);
  });

  it('sin segmentos: ok=true, neededTotal=0', () => {
    const tracks = [track()];
    const result = analyzePoolCoverage([], tracks, EMPTY_PREFERENCES);
    expect(result.ok).toBe(true);
    expect(result.neededTotal).toBe(0);
    expect(result.byZone).toHaveLength(0);
  });

  it('byZone se ordena 1..6 (determinista)', () => {
    const tracks = [
      track({ tempoBpm: 78, energy: 0.5, valence: 0.5 }),
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 65, energy: 0.92, valence: 0.75 }),
    ];
    // Pasamos en orden Z5, Z1, Z3 (cualquier orden de entrada).
    const segments = [segment(5, 60), segment(1, 60), segment(3, 60)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.byZone.map((z) => z.zone)).toEqual([1, 3, 5]);
  });

  it('una combo con deficit local NO bloquea si el pool global cubre', () => {
    // Caso real: sesion mixta donde Z5 climb tiene pocas opciones
    // especificas en el catalogo, pero el TOTAL de tracks unicos sobra.
    // El sistema antiguo bloqueaba; el nuevo deja pasar (info, no bloqueo).
    const tracks = Array.from({ length: 30 }, (_, idx) =>
      track({ tempoBpm: 80 + (idx % 15), energy: 0.85 }),
    );
    const segments = [segment(3, 600), segment(5, 60)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    // Total: 660s -> 4 tracks necesarios, pool 30 -> ok=true.
    expect(result.ok).toBe(true);
    // Pero el desglose puede mostrar que Z5 tiene cobertura ajustada.
    expect(result.byZone.length).toBeGreaterThan(0);
  });

  it('tracks duplicados por URI cuentan una sola vez en availableTotal', () => {
    const t = track({ tempoBpm: 87, energy: 0.75, valence: 0.6 });
    const tracks = [t, { ...t }, { ...t }];
    const segments = [segment(3, 60)];
    const result = analyzePoolCoverage(segments, tracks, EMPTY_PREFERENCES);
    expect(result.availableTotal).toBe(1);
  });
});
