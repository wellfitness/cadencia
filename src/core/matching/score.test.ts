import { describe, it, expect } from 'vitest';
import { scoreTrack } from './score';
import { ZONE_MUSIC_CRITERIA } from './zoneCriteria';
import type { Track } from '../tracks/types';

function track(overrides: Partial<Track> = {}): Track {
  return {
    uri: 'spotify:track:abc',
    name: 'Track',
    album: 'Album',
    artists: ['Artist'],
    genres: [],
    tempoBpm: 125,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source: 'cinelli_rider',
    ...overrides,
  };
}

describe('scoreTrack', () => {
  const z3 = ZONE_MUSIC_CRITERIA[3]; // BPM 120-130, midpoint=125, energy 0.7

  it('sin preferencias devuelve score neutro de genero (0.5 * 0.5 = 0.25)', () => {
    const t = track({ tempoBpm: 125, energy: 0 });
    // genre 0.5*0.5=0.25, bpm 0.3*1=0.3, energy 0.2*0=0 -> 0.55
    expect(scoreTrack(t, z3, [])).toBeCloseTo(0.55, 2);
  });

  it('genero matcheado suma 0.5 completos', () => {
    const matched = track({ genres: ['edm'], tempoBpm: 125, energy: 0 });
    const unmatched = track({ genres: ['classical'], tempoBpm: 125, energy: 0 });
    // matched: 0.5 + 0.3 + 0 = 0.8
    expect(scoreTrack(matched, z3, ['edm'])).toBeCloseTo(0.8, 2);
    // unmatched: 0 + 0.3 + 0 = 0.3
    expect(scoreTrack(unmatched, z3, ['edm'])).toBeCloseTo(0.3, 2);
  });

  it('BPM en el midpoint da bpmScore=1 (suma 0.3)', () => {
    const t = track({ tempoBpm: 125, energy: 0, genres: [] });
    // 0.25 + 0.3 + 0
    expect(scoreTrack(t, z3, [])).toBeCloseTo(0.55, 2);
  });

  it('BPM en el borde da bpmScore=0', () => {
    const t = track({ tempoBpm: 130, energy: 0, genres: [] });
    expect(scoreTrack(t, z3, [])).toBeCloseTo(0.25, 2);
  });

  it('energy aporta hasta 0.2', () => {
    const tLow = track({ tempoBpm: 125, energy: 0, genres: [] });
    const tHigh = track({ tempoBpm: 125, energy: 1, genres: [] });
    expect(scoreTrack(tHigh, z3, []) - scoreTrack(tLow, z3, [])).toBeCloseTo(0.2, 2);
  });

  it('siempre devuelve valor entre 0 y 1', () => {
    const t = track({ tempoBpm: 125, energy: 1, genres: ['edm'] });
    const score = scoreTrack(t, z3, ['edm']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('determinista: misma entrada da misma salida', () => {
    const t = track({ tempoBpm: 122, energy: 0.65, genres: ['trance'] });
    const a = scoreTrack(t, z3, ['trance']);
    const b = scoreTrack(t, z3, ['trance']);
    expect(a).toBe(b);
  });
});
