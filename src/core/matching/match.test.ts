import { describe, it, expect } from 'vitest';
import { matchTracksToSegments } from './match';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { EMPTY_PREFERENCES, type MatchPreferences } from './types';

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
function segment(zone: ClassifiedSegment['zone']): ClassifiedSegment {
  segId += 1;
  return {
    startSec: segId * 60,
    durationSec: 60,
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

describe('matchTracksToSegments', () => {
  it('asigna un track a cada segmento', () => {
    const tracks = [
      track({ tempoBpm: 100, energy: 0.5 }), // Z1
      track({ tempoBpm: 115, energy: 0.6, valence: 0.5 }), // Z2
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6 }), // Z3
    ];
    const segments = [segment(1), segment(2), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched.every((m) => m.track !== null)).toBe(true);
  });

  it('marca matchQuality strict cuando hay candidato exacto', () => {
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]?.matchQuality).toBe('strict');
  });

  it('relaja energy cuando ningun track la cumple', () => {
    // Z3 pide energy >= 0.7. Ofrecemos solo tracks con energy 0.65
    const tracks = [
      track({ tempoBpm: 125, energy: 0.65, valence: 0.6 }),
      track({ tempoBpm: 122, energy: 0.6, valence: 0.55 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]?.matchQuality).toBe('relaxed');
    expect(matched[0]?.track).not.toBeNull();
  });

  it('best-effort cuando ningun track tiene BPM en el rango', () => {
    // Z3 pide 120-130 BPM. Ofrecemos tracks de 80 BPM
    const tracks = [track({ tempoBpm: 80, energy: 0.5 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]?.matchQuality).toBe('best-effort');
    expect(matched[0]?.track).not.toBeNull();
  });

  it('catalogo vacio -> track null', () => {
    const matched = matchTracksToSegments([segment(3)], [], EMPTY_PREFERENCES);
    expect(matched[0]?.track).toBeNull();
  });

  it('no repite track en ventana de 5 segmentos si hay alternativas', () => {
    const tracks = [
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 124, energy: 0.78, valence: 0.62 }),
      track({ tempoBpm: 126, energy: 0.72, valence: 0.65 }),
      track({ tempoBpm: 128, energy: 0.85, valence: 0.7 }),
      track({ tempoBpm: 122, energy: 0.8, valence: 0.55 }),
      track({ tempoBpm: 127, energy: 0.79, valence: 0.6 }),
    ];
    const segments = Array.from({ length: 5 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const uris = matched.map((m) => m.track?.uri);
    expect(new Set(uris).size).toBe(5);
  });

  it('preferencia de genero sube el score de tracks que matchean', () => {
    const trance = track({ tempoBpm: 125, energy: 0.75, valence: 0.6, genres: ['trance'] });
    const techno = track({ tempoBpm: 125, energy: 0.75, valence: 0.6, genres: ['techno'] });
    const prefs: MatchPreferences = { preferredGenres: ['trance'], allEnergetic: false };
    const matched = matchTracksToSegments([segment(3)], [techno, trance], prefs);
    expect(matched[0]?.track?.uri).toBe(trance.uri);
  });

  it('determinista: misma entrada -> misma salida', () => {
    const tracks = [
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 124, energy: 0.78, valence: 0.62 }),
    ];
    const segs = [segment(3), segment(3)];
    const a = matchTracksToSegments(segs, tracks, EMPTY_PREFERENCES);
    const b = matchTracksToSegments(segs, tracks, EMPTY_PREFERENCES);
    expect(a.map((m) => m.track?.uri)).toEqual(b.map((m) => m.track?.uri));
  });

  it('ruta vacia -> array vacio', () => {
    const tracks = [track()];
    expect(matchTracksToSegments([], tracks, EMPTY_PREFERENCES)).toEqual([]);
  });

  it('catalogo de 1 track repite (ventana cede)', () => {
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6 })];
    const segments = Array.from({ length: 3 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched.every((m) => m.track?.uri === tracks[0]!.uri)).toBe(true);
  });
});
