import { describe, it, expect } from 'vitest';
import { getAlternativesForSegment, replaceTrackInSegment } from './replaceTrack';
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

  it('targetUri: sustituye exactamente por ese URI cuando es valido', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
    ];
    const segments = [segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const usedUri = matched[0]!.track!.uri;
    // Pick a target distinto al actual.
    const targetTrack = tracks.find((t) => t.uri !== usedUri)!;
    const result = replaceTrackInSegment(
      matched,
      0,
      tracks,
      EMPTY_PREFERENCES,
      targetTrack.uri,
    );
    expect(result.replaced).toBe(true);
    expect(result.matched[0]!.track!.uri).toBe(targetTrack.uri);
  });

  it('targetUri: si el URI esta ya en uso devuelve replaced=false', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const otherSlotUri = matched[1]!.track!.uri;
    // Intentamos sustituir slot 0 por el URI del slot 1 (ya en uso).
    const result = replaceTrackInSegment(
      matched,
      0,
      tracks,
      EMPTY_PREFERENCES,
      otherSlotUri,
    );
    expect(result.replaced).toBe(false);
  });

  it('targetUri: si el URI no existe en el catalogo devuelve replaced=false', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const result = replaceTrackInSegment(
      matched,
      0,
      tracks,
      EMPTY_PREFERENCES,
      'spotify:track:does-not-exist',
    );
    expect(result.replaced).toBe(false);
  });
});

describe('getAlternativesForSegment', () => {
  it('devuelve todos los candidatos validos excluyendo los URIs en uso', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.77, valence: 0.65, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const usedUris = new Set(matched.map((m) => m.track!.uri));

    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    // 5 tracks - 3 en uso = 2 alternativas posibles
    expect(alts.length).toBe(2);
    for (const alt of alts) {
      expect(usedUris.has(alt.track.uri)).toBe(false);
    }
  });

  it('excluye explicitamente el track actual del segmento que se reemplaza', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const currentUri = matched[0]!.track!.uri;
    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    const altUris = alts.map((a) => a.track.uri);
    expect(altUris).not.toContain(currentUri);
  });

  it('orden por score descendente', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1]!.score).toBeGreaterThanOrEqual(alts[i]!.score);
    }
  });

  it('todas las alternativas en uso: lista vacia', () => {
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 91, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(alts).toEqual([]);
  });

  it('catalogo vacio: lista vacia', () => {
    const tracks: Track[] = [];
    // matched necesita un segmento con track null para emularlo. Lo
    // construimos a mano (matchTracksToSegments con catalogo vacio devuelve
    // insufficient -> track null).
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(alts).toEqual([]);
  });

  it('indice fuera de rango: lista vacia', () => {
    const tracks = [track({ tempoBpm: 87, energy: 0.75, valence: 0.6 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const alts = getAlternativesForSegment(matched, 99, tracks, EMPTY_PREFERENCES);
    expect(alts).toEqual([]);
  });

  it('prioriza strict: si hay tracks libres con cadencia OK, NO ofrece los que no encajan', () => {
    // 2 tracks strict para Z3+flat (75, 85) + 2 tracks fuera de cadencia
    // (100, 110). El segmento usa 1 strict; quedan 1 strict + 2 fuera libres.
    // El dropdown debe ofrecer SOLO el strict libre (75 u 85), no los 100/110.
    const tracks = [
      track({ tempoBpm: 75, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 100, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 110, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);

    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(alts.length).toBe(1);
    // El BPM del unico alternativo debe estar dentro del rango Z3+flat (70-90).
    expect(alts[0]!.track.tempoBpm).toBeGreaterThanOrEqual(70);
    expect(alts[0]!.track.tempoBpm).toBeLessThanOrEqual(90);
  });

  it('encaje libre por agotamiento: ofrece tracks de cadencia no ideal cuando los strict estan todos usados', () => {
    // 3 tracks strict para Z3+flat (cadencia 70-90), 2 tracks fuera de
    // cadencia (100, 110). En 4 segmentos Z3 el motor agota los 3 strict y
    // marca el 4o como 'best-effort' override (caso del bug Wonderwall):
    // hay strict en el catalogo pero ya estan en uso. El dropdown DEBE
    // ofrecer los tracks fuera de cadencia como alternativas; antes devolvia
    // [] porque solo miraba el subset strict y todos estaban en forbidden.
    const tracks = [
      track({ tempoBpm: 75, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 100, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 110, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);

    // Localizar el slot best-effort (el que el motor llenó con un track
    // fuera de cadencia tras agotar strict).
    const bestEffortIdx = matched.findIndex((m) => m.matchQuality === 'best-effort');
    expect(bestEffortIdx).toBeGreaterThanOrEqual(0);

    const alts = getAlternativesForSegment(
      matched,
      bestEffortIdx,
      tracks,
      EMPTY_PREFERENCES,
    );
    // Hay 1 track libre fuera de cadencia (el que no se asignó). Antes del
    // fix, alts era []. Ahora debe contener al menos 1 alternativa.
    expect(alts.length).toBeGreaterThan(0);
  });

  it('encaje libre: si el segmento es best-effort las alternativas tambien lo son', () => {
    // Z6 (sprint) requiere cadencia 90-110 (1:1) o 180-220 (2:1). Si TODOS
    // los tracks del catalogo caen fuera, el match es best-effort y las
    // alternativas tambien. Ningun track aqui pasa esos rangos.
    const tracks = [
      track({ tempoBpm: 70, energy: 0.95, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 75, energy: 0.95, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 80, energy: 0.95, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.95, valence: 0.7, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(6)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]!.matchQuality).toBe('best-effort');

    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    // Sustituir y comprobar que el nuevo match tambien es best-effort.
    expect(alts.length).toBeGreaterThan(0);
    const result = replaceTrackInSegment(
      matched,
      0,
      tracks,
      EMPTY_PREFERENCES,
      alts[0]!.track.uri,
    );
    expect(result.replaced).toBe(true);
    expect(result.matched[0]!.matchQuality).toBe('best-effort');
  });
});
