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
  it('un track largo cubre varios segmentos consecutivos (overlap)', () => {
    // Track de 200 s, segmentos de 60 s -> 1 track tapa 4 segmentos (240 s).
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 200_000 })];
    const segments = Array.from({ length: 5 }, () => segment(3)); // 5*60 = 300 s
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    // 1er track cubre seg 1-4 (240 s >= 200 s), repite para seg 5 -> 2 entradas
    expect(matched).toHaveLength(2);
  });

  it('tracks cortos: una entrada por segmento si el track cabe en uno', () => {
    // Tracks de 50 s, segmentos de 60 s -> cada track ocupa solo su segmento.
    const tracks = Array.from({ length: 5 }, (_, idx) =>
      track({
        tempoBpm: 125 + idx,
        energy: 0.75,
        valence: 0.6,
        durationMs: 50_000,
      }),
    );
    const segments = Array.from({ length: 3 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched.every((m) => m.track !== null)).toBe(true);
  });

  it('cada zona recibe su track correspondiente', () => {
    const tracks = [
      track({ tempoBpm: 100, energy: 0.5, durationMs: 50_000 }), // Z1
      track({ tempoBpm: 115, energy: 0.6, valence: 0.5, durationMs: 50_000 }), // Z2
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 50_000 }), // Z3
    ];
    const segments = [segment(1), segment(2), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched[0]?.zone).toBe(1);
    expect(matched[1]?.zone).toBe(2);
    expect(matched[2]?.zone).toBe(3);
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

  it('no repite track en ventana de 5 entradas si hay alternativas', () => {
    // Tracks de 60 s para que cada uno ocupe exactamente 1 segmento -> 5 entradas.
    const tracks = [
      track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 124, energy: 0.78, valence: 0.62, durationMs: 60_000 }),
      track({ tempoBpm: 126, energy: 0.72, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 128, energy: 0.85, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 122, energy: 0.8, valence: 0.55, durationMs: 60_000 }),
      track({ tempoBpm: 127, energy: 0.79, valence: 0.6, durationMs: 60_000 }),
    ];
    const segments = Array.from({ length: 5 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(5);
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

  it('catalogo de 1 track repite cuando la ruta lo necesita', () => {
    // Track de 60 s + 3 segmentos de 60 s -> el unico track se repite 3 veces.
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 60_000 })];
    const segments = Array.from({ length: 3 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched.every((m) => m.track?.uri === tracks[0]!.uri)).toBe(true);
  });

  it('ruta de 4 h con tracks de 3 min produce ~80 entradas, no 240', () => {
    // Regresion guard del bug original: el matching emitia una entrada por
    // segmento de 60 s (240 entradas para 4 h) en vez de respetar la
    // duracion del track. Con tracks de ~3 min debe rondar 80.
    const tracks = Array.from({ length: 50 }, (_, idx) =>
      track({
        tempoBpm: 120 + (idx % 10),
        energy: 0.75 + (idx % 5) * 0.01,
        valence: 0.6 + (idx % 5) * 0.01,
        durationMs: 180_000, // 3 min
      }),
    );
    const segments = Array.from({ length: 240 }, () => segment(3)); // 4 h
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    // 240 segs * 60 s = 14400 s. Tracks de 180 s -> 80 entradas.
    expect(matched.length).toBeGreaterThanOrEqual(78);
    expect(matched.length).toBeLessThanOrEqual(82);
  });
});
