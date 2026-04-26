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

describe('loadNativeTracks (CSVs reales bundled)', () => {
  it('carga al menos 100 tracks unicos tras dedupe', () => {
    // En el catalogo real, trainingpeaks_virtual es subconjunto de cinelli_rider
    // y mix_alegre es independiente. Total esperado tras dedup ~140 tracks.
    const tracks = loadNativeTracks();
    expect(tracks.length).toBeGreaterThan(100);
  });

  it('todas las URIs son unicas (dedup correcto)', () => {
    const tracks = loadNativeTracks();
    const uris = tracks.map((t) => t.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('hay tracks de al menos cinelli_rider y mix_alegre', () => {
    const tracks = loadNativeTracks();
    const sources = new Set(tracks.map((t) => t.source));
    expect(sources.has('cinelli_rider')).toBe(true);
    expect(sources.has('mix_alegre')).toBe(true);
  });

  it('los tracks tienen tempo > 0 y energy en [0,1]', () => {
    const tracks = loadNativeTracks();
    for (const t of tracks) {
      expect(t.tempoBpm).toBeGreaterThan(0);
      expect(t.energy).toBeGreaterThanOrEqual(0);
      expect(t.energy).toBeLessThanOrEqual(1);
    }
  });
});
