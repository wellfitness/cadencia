import { describe, it, expect } from 'vitest';
import { computeMatchSignature } from './signature';
import type { Track } from '../tracks/types';
import type { ClassifiedSegment } from '../segmentation/types';
import type { MatchPreferences } from './types';

function track(overrides: Partial<Track> = {}): Track {
  return {
    uri: 'spotify:track:abc',
    name: 'Track',
    album: 'Album',
    artists: ['Artist'],
    genres: ['rock'],
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
    avgPowerWatts: 200,
    zone: 3,
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

const PREFS: MatchPreferences = { preferredGenres: ['electronic'], allEnergetic: false, seed: 42 };

describe('computeMatchSignature', () => {
  it('misma entrada produce la misma firma', () => {
    const segs = [segment()];
    const pool = [track()];
    const a = computeMatchSignature(segs, pool, PREFS, 'overlap');
    const b = computeMatchSignature(segs, pool, PREFS, 'overlap');
    expect(a).toBe(b);
  });

  it('pool con referencia nueva pero contenido identico produce la misma firma', () => {
    // Este es el caso del bug: tras el reload del OAuth, loadCadenciaData()
    // devuelve objetos nuevos (parse JSON) con el mismo contenido. La firma
    // NO debe cambiar, para no recalcular ni machacar las ediciones.
    const segs = [segment()];
    const poolA: Track[] = [track({ uri: 'spotify:track:1' }), track({ uri: 'spotify:track:2' })];
    const poolB: Track[] = poolA.map((t) => ({ ...t, genres: [...t.genres] }));
    expect(poolA).not.toBe(poolB);
    expect(poolA[0]).not.toBe(poolB[0]);
    const a = computeMatchSignature(segs, poolA, PREFS, 'overlap');
    const b = computeMatchSignature(segs, poolB, PREFS, 'overlap');
    expect(a).toBe(b);
  });

  it('cambiar la seed produce una firma distinta', () => {
    const segs = [segment()];
    const pool = [track()];
    const a = computeMatchSignature(segs, pool, PREFS, 'overlap');
    const b = computeMatchSignature(segs, pool, { ...PREFS, seed: 99 }, 'overlap');
    expect(a).not.toBe(b);
  });

  it('cambiar los generos preferidos produce una firma distinta', () => {
    const segs = [segment()];
    const pool = [track()];
    const a = computeMatchSignature(segs, pool, PREFS, 'overlap');
    const b = computeMatchSignature(segs, pool, { ...PREFS, preferredGenres: ['rock'] }, 'overlap');
    expect(a).not.toBe(b);
  });

  it('añadir un track al pool produce una firma distinta', () => {
    const segs = [segment()];
    const a = computeMatchSignature(segs, [track({ uri: 'spotify:track:1' })], PREFS, 'overlap');
    const b = computeMatchSignature(
      segs,
      [track({ uri: 'spotify:track:1' }), track({ uri: 'spotify:track:2' })],
      PREFS,
      'overlap',
    );
    expect(a).not.toBe(b);
  });

  it('cambiar un atributo de matching de un track (mismo uri) produce una firma distinta', () => {
    // Editar el BPM de una cancion en el editor de catalogo cambia el resultado
    // del matching aunque el uri sea el mismo → la firma debe reflejarlo.
    const segs = [segment()];
    const a = computeMatchSignature(segs, [track({ tempoBpm: 80 })], PREFS, 'overlap');
    const b = computeMatchSignature(segs, [track({ tempoBpm: 160 })], PREFS, 'overlap');
    expect(a).not.toBe(b);
  });

  it('reordenar el pool produce una firma distinta (el orden afecta el desempate)', () => {
    const segs = [segment()];
    const t1 = track({ uri: 'spotify:track:1' });
    const t2 = track({ uri: 'spotify:track:2' });
    const a = computeMatchSignature(segs, [t1, t2], PREFS, 'overlap');
    const b = computeMatchSignature(segs, [t2, t1], PREFS, 'overlap');
    expect(a).not.toBe(b);
  });

  it('cambiar el crossZoneMode produce una firma distinta', () => {
    const segs = [segment()];
    const pool = [track()];
    const a = computeMatchSignature(segs, pool, PREFS, 'overlap');
    const b = computeMatchSignature(segs, pool, PREFS, 'discrete');
    expect(a).not.toBe(b);
  });

  it('cambiar la zonificacion de la ruta produce una firma distinta', () => {
    const pool = [track()];
    const a = computeMatchSignature([segment({ zone: 3 })], pool, PREFS, 'overlap');
    const b = computeMatchSignature([segment({ zone: 5 })], pool, PREFS, 'overlap');
    expect(a).not.toBe(b);
  });

  it('routeSegments null produce una firma estable y reproducible', () => {
    const pool = [track()];
    const a = computeMatchSignature(null, pool, PREFS, 'overlap');
    const b = computeMatchSignature(null, pool, PREFS, 'overlap');
    expect(a).toBe(b);
  });
});
