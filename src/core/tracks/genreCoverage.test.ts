import { describe, it, expect } from 'vitest';
import { computeGenreCoverage, deriveSessionCombos } from './genreCoverage';
import type { Track } from './types';
import type { ClassifiedSegment } from '../segmentation/types';

function track(overrides: Partial<Track> = {}): Track {
  return {
    uri: 'spotify:track:abc',
    name: 'Track',
    album: 'Album',
    artists: ['Artist'],
    genres: [],
    tempoBpm: 80,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source: 'cinelli_rider',
    ...overrides,
  };
}

function segment(overrides: Partial<ClassifiedSegment> = {}): ClassifiedSegment {
  return {
    sport: 'bike',
    startSec: 0,
    durationSec: 60,
    avgPowerWatts: 150,
    zone: 2,
    cadenceProfile: 'flat',
    startDistanceMeters: 0,
    endDistanceMeters: 100,
    startElevationMeters: 0,
    endElevationMeters: 0,
    startLat: 0,
    startLon: 0,
    ...overrides,
  };
}

describe('computeGenreCoverage', () => {
  it('pool vacio devuelve cobertura vacia', () => {
    const result = computeGenreCoverage([], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toEqual([]);
  });

  it('combos vacio devuelve cobertura vacia', () => {
    const t = track({ uri: 'spotify:track:1', genres: ['rock'], tempoBpm: 80 });
    const result = computeGenreCoverage([t], [], 'bike');
    expect(result).toEqual([]);
  });

  it('tracks sin genero devuelve cobertura vacia', () => {
    const t = track({ uri: 'spotify:track:1', genres: [], tempoBpm: 80 });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toEqual([]);
  });

  it('tracks con tags solo de macros desconocidos devuelve cobertura vacia', () => {
    const t = track({ uri: 'spotify:track:1', genres: ['jazz'], tempoBpm: 80 });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toEqual([]);
  });

  it('un track 80 BPM con tag rock cubre Z2 flat (1:1) bajo macro rock', () => {
    const t = track({ uri: 'spotify:track:1', genres: ['rock'], tempoBpm: 80 });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toHaveLength(1);
    expect(result[0]?.genre).toBe('rock');
    expect(result[0]?.label).toBe('Rock');
    expect(result[0]?.totalTracks).toBe(1);
    expect(result[0]?.cells[0]?.candidateCount).toBe(1);
  });

  it('track 160 BPM con tag edm cubre Z2 flat via 2:1 half-time bajo macro electronic', () => {
    const t = track({ uri: 'spotify:track:1', genres: ['edm'], tempoBpm: 160 });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result[0]?.genre).toBe('electronic');
    expect(result[0]?.cells[0]?.candidateCount).toBe(1);
  });

  it('track 100 BPM NO cubre Z2 flat (fuera de 70-90 y 140-180)', () => {
    const t = track({ uri: 'spotify:track:1', genres: ['rock'], tempoBpm: 100 });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result[0]?.cells[0]?.candidateCount).toBe(0);
  });

  it('un track con varios tags del mismo macro cuenta UNA sola vez', () => {
    // Ambos tags caen en el macro rock — debe contar 1, no 2.
    const t = track({
      uri: 'spotify:track:1',
      genres: ['rock', 'rock clásico'],
      tempoBpm: 80,
    });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toHaveLength(1);
    expect(result[0]?.genre).toBe('rock');
    expect(result[0]?.totalTracks).toBe(1);
    expect(result[0]?.cells[0]?.candidateCount).toBe(1);
  });

  it('un track con tags de macros distintos cuenta una vez en cada macro', () => {
    // 'edm' → electronic, 'rock' → rock — el track aparece en ambos.
    const t = track({
      uri: 'spotify:track:1',
      genres: ['edm', 'rock'],
      tempoBpm: 80,
    });
    const result = computeGenreCoverage([t], [{ zone: 2, cadenceProfile: 'flat' }], 'bike');
    expect(result).toHaveLength(2);
    for (const cov of result) {
      expect(cov.totalTracks).toBe(1);
      expect(cov.cells[0]?.candidateCount).toBe(1);
    }
  });
});

describe('deriveSessionCombos', () => {
  it('sin segments + sport=bike devuelve la rejilla canonica de 8 combos', () => {
    const result = deriveSessionCombos(undefined, 'bike');
    expect(result).toHaveLength(8);
    // Z3 y Z4 deben aparecer con flat Y climb.
    expect(result.filter((c) => c.zone === 3)).toHaveLength(2);
    expect(result.filter((c) => c.zone === 4)).toHaveLength(2);
    // Z6 solo sprint.
    expect(result.find((c) => c.zone === 6)?.cadenceProfile).toBe('sprint');
  });

  it('sin segments + sport=run devuelve 6 combos todas con profile=flat', () => {
    const result = deriveSessionCombos(undefined, 'run');
    expect(result).toHaveLength(6);
    for (const c of result) {
      expect(c.cadenceProfile).toBe('flat');
    }
  });

  it('extrae combos unicos de los segmentos en orden zone asc, profile flat<climb<sprint', () => {
    const segs = [
      segment({ zone: 4, cadenceProfile: 'climb' }),
      segment({ zone: 2, cadenceProfile: 'flat' }),
      segment({ zone: 4, cadenceProfile: 'flat' }),
      segment({ zone: 2, cadenceProfile: 'flat' }), // duplicado
      segment({ zone: 6, cadenceProfile: 'sprint' }),
    ];
    const result = deriveSessionCombos(segs, 'bike');
    expect(result).toEqual([
      { zone: 2, cadenceProfile: 'flat' },
      { zone: 4, cadenceProfile: 'flat' },
      { zone: 4, cadenceProfile: 'climb' },
      { zone: 6, cadenceProfile: 'sprint' },
    ]);
  });

  it('en run el profile se normaliza a flat aunque el segment traiga otro', () => {
    const segs = [
      segment({ sport: 'run', zone: 3, cadenceProfile: 'climb' }),
      segment({ sport: 'run', zone: 5, cadenceProfile: 'flat' }),
    ];
    const result = deriveSessionCombos(segs, 'run');
    expect(result).toEqual([
      { zone: 3, cadenceProfile: 'flat' },
      { zone: 5, cadenceProfile: 'flat' },
    ]);
  });
});
