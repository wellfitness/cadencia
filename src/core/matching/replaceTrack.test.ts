import { describe, it, expect } from 'vitest';
import { replaceTrackInSegment } from './replaceTrack';
import { matchTracksToSegments } from './match';
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
function segment(zone: ClassifiedSegment['zone']): ClassifiedSegment {
  segId += 1;
  return {
    startSec: segId * 60,
    durationSec: 60,
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

describe('replaceTrackInSegment', () => {
  it('cambia el track actual por otro distinto cuando hay candidato libre', () => {
    // Tracks de 200s, 1 segmento de 60s -> overlap usa solo 1 track. Hay 2
    // mas libres en pool, asi que el reemplazo encuentra alternativa.
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 91, energy: 0.78, valence: 0.65 }),
      track({ tempoBpm: 84, energy: 0.72, valence: 0.6 }),
    ];
    const segments = [segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const originalUri = matched[0]!.track!.uri;

    const result = replaceTrackInSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(result.replaced).toBe(true);
    expect(result.matched[0]!.track!.uri).not.toBe(originalUri);
  });

  it('no rompe los segmentos vecinos', () => {
    // Tracks de 60 s para que cada uno ocupe 1 segmento -> N entradas.
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 91, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 84, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 90, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const originalSecond = matched[1]!.track!.uri;
    const originalThird = matched[2]!.track!.uri;

    const result = replaceTrackInSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(result.matched[1]!.track!.uri).toBe(originalSecond);
    expect(result.matched[2]!.track!.uri).toBe(originalThird);
  });

  it('elige un track no presente en la playlist completa', () => {
    // 5 tracks de 60s, 4 segmentos -> 4 tracks asignados (uno libre).
    // Reemplazar el segmento 1 debe coger ese 5o, no repetir ninguno.
    const tracks = [
      // 5 tracks en cadencia Z3 flat (70-90 1:1), todos validos.
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.77, valence: 0.65, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const usedBefore = new Set(matched.map((m) => m.track!.uri));
    expect(usedBefore.size).toBe(4);
    const result = replaceTrackInSegment(matched, 1, tracks, EMPTY_PREFERENCES);
    expect(result.replaced).toBe(true);
    const newUri = result.matched[1]!.track!.uri;
    // Nuevo URI no debe estar entre los OTROS tracks de la playlist
    const otherUris = result.matched
      .filter((_, i) => i !== 1)
      .map((m) => m.track!.uri);
    expect(otherUris).not.toContain(newUri);
  });

  it('pool agotado: todos los tracks ya usados -> replaced=false', () => {
    // 4 tracks, 4 segmentos -> los 4 ocupados en la playlist. No queda
    // candidato libre, replaced=false. La UI debe avisar al usuario.
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 91, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 84, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 90, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const originalSecond = matched[1]!.track!.uri;
    const result = replaceTrackInSegment(matched, 1, tracks, EMPTY_PREFERENCES);
    expect(result.replaced).toBe(false);
    expect(result.matched[1]!.track!.uri).toBe(originalSecond);
  });

  it('catalogo de 1 track (mismo que ya tiene): no replaced', () => {
    const tracks = [track({ tempoBpm: 87, energy: 0.75, valence: 0.6 })];
    const segments = [segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const result = replaceTrackInSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(result.replaced).toBe(false);
  });

  it('determinista: misma entrada -> mismo resultado', () => {
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 91, energy: 0.78, valence: 0.65 }),
      track({ tempoBpm: 84, energy: 0.72, valence: 0.6 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const a = replaceTrackInSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    const b = replaceTrackInSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(a.matched[0]!.track!.uri).toBe(b.matched[0]!.track!.uri);
  });

  it('indice fuera de rango: no rompe', () => {
    const tracks = [track({ tempoBpm: 87, energy: 0.75, valence: 0.6 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const result = replaceTrackInSegment(matched, 99, tracks, EMPTY_PREFERENCES);
    expect(result.replaced).toBe(false);
    expect(result.matched).toEqual(matched);
  });
});
