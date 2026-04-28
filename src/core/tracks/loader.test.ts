import { describe, it, expect } from 'vitest';
import { dedupeByUri, loadNativeTracks } from './loader';
import type { Track } from './types';

function fakeTrack(uri: string, source: Track['source'] = 'cinelli_rider'): Track {
  return {
    uri,
    name: 'Track',
    album: 'Album',
    artists: ['Artist'],
    genres: [],
    tempoBpm: 120,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source,
  };
}

describe('dedupeByUri', () => {
  it('mantiene la primera ocurrencia (first-wins)', () => {
    const a = fakeTrack('spotify:track:abc', 'cinelli_rider');
    const b = { ...fakeTrack('spotify:track:abc', 'mix_alegre'), name: 'Different' };
    const c = fakeTrack('spotify:track:def', 'mix_alegre');
    const result = dedupeByUri([a, b, c]);
    expect(result).toHaveLength(2);
    expect(result[0]!.source).toBe('cinelli_rider');
    expect(result[0]!.name).toBe('Track');
    expect(result[1]!.uri).toBe('spotify:track:def');
  });

  it('array vacio devuelve vacio', () => {
    expect(dedupeByUri([])).toEqual([]);
  });
});

describe('loadNativeTracks (catalogo unificado bundled)', () => {
  it('carga al menos 500 tracks unicos', () => {
    // El catalogo unificado (src/data/tracks/all.csv) se construye con
    // scripts/build-tracks.mjs a partir de las listas en sources/. Con las
    // listas actuales son ~800 tracks tras dedup y descarte de huerfanos.
    const tracks = loadNativeTracks();
    expect(tracks.length).toBeGreaterThan(500);
  });

  it('todas las URIs son unicas (dedup correcto)', () => {
    const tracks = loadNativeTracks();
    const uris = tracks.map((t) => t.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('los tracks tienen tempo > 0 y energy en [0,1]', () => {
    const tracks = loadNativeTracks();
    for (const t of tracks) {
      expect(t.tempoBpm).toBeGreaterThan(0);
      expect(t.energy).toBeGreaterThanOrEqual(0);
      expect(t.energy).toBeLessThanOrEqual(1);
    }
  });

  it('todos los tracks tienen durationMs > 0 (regresion: bug del compilador que dejaba la columna vacia)', () => {
    // Si un track tiene durationMs=0, el motor de matching crea un slot nuevo
    // por segundo y la playlist explota a miles de entradas. Un par de tracks
    // del catalogo real deberian estar entre 60s y 15min.
    const tracks = loadNativeTracks();
    for (const t of tracks) {
      expect(t.durationMs, `${t.name} tiene durationMs invalido`).toBeGreaterThan(0);
    }
    // Sanity: media de duracion entre 1 y 10 minutos.
    const avgMs = tracks.reduce((sum, t) => sum + t.durationMs, 0) / tracks.length;
    expect(avgMs).toBeGreaterThan(60_000); // > 1 min
    expect(avgMs).toBeLessThan(600_000);   // < 10 min
  });

  it('source de cada track refleja su CSV de origen (no vacio)', () => {
    const tracks = loadNativeTracks();
    const sources = new Set(tracks.map((t) => t.source));
    expect(sources.size).toBeGreaterThan(1);
    for (const t of tracks) {
      expect(t.source).not.toBe('');
    }
  });

  it('todos los tracks encajan en al menos una cadencia (huerfanos descartados)', () => {
    // El script build-tracks.mjs filtra los tracks fuera de los rangos:
    //  60-80 ∪ 70-90 ∪ 90-115 ∪ 110-160 ∪ 140-180 ∪ 180-230 BPM.
    const tracks = loadNativeTracks();
    const ranges: [number, number][] = [
      [60, 80],
      [70, 90],
      [90, 115],
      [110, 160],
      [140, 180],
      [180, 230],
    ];
    for (const t of tracks) {
      const fits = ranges.some(([lo, hi]) => t.tempoBpm >= lo && t.tempoBpm <= hi);
      expect(fits, `${t.name} (${t.tempoBpm} BPM) deberia encajar`).toBe(true);
    }
  });
});
