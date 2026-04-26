import { describe, it, expect } from 'vitest';
import { getTopGenres } from './topGenres';
import type { Track } from './types';

function track(genres: string[]): Track {
  return {
    uri: `spotify:track:${Math.random()}`,
    name: 't',
    album: 'a',
    artists: [],
    genres,
    tempoBpm: 120,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source: 'cinelli_rider',
  };
}

describe('getTopGenres', () => {
  it('cuenta apariciones por track', () => {
    const tracks = [
      track(['edm', 'trance']),
      track(['edm']),
      track(['edm', 'house']),
    ];
    const top = getTopGenres(tracks);
    expect(top[0]).toEqual({ genre: 'edm', count: 3 });
    const names = top.map((g) => g.genre);
    expect(names).toContain('trance');
    expect(names).toContain('house');
  });

  it('respeta limit', () => {
    const tracks = Array.from({ length: 20 }, (_, i) => track([`g${i}`]));
    expect(getTopGenres(tracks, 5)).toHaveLength(5);
  });

  it('orden alfabetico como tiebreaker', () => {
    const tracks = [
      track(['zeta']),
      track(['alfa']),
      track(['beta']),
    ];
    const top = getTopGenres(tracks, 3);
    expect(top.map((g) => g.genre)).toEqual(['alfa', 'beta', 'zeta']);
  });

  it('catalogo sin generos -> array vacio', () => {
    expect(getTopGenres([track([]), track([])], 5)).toEqual([]);
  });
});
