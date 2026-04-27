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

  it('no repite ningun track en toda la playlist (cero repeticiones)', () => {
    // 10 tracks de 60s cubriendo 10 segmentos: cada track aparece exactamente
    // una vez. La regla "cero repeticiones" garantiza URIs unicos por
    // ENTRADA, sin ventana deslizante.
    const tracks = Array.from({ length: 10 }, (_, idx) =>
      track({
        tempoBpm: 122 + idx,
        energy: 0.72 + (idx % 5) * 0.02,
        valence: 0.6 + (idx % 5) * 0.02,
        durationMs: 60_000,
      }),
    );
    const segments = Array.from({ length: 10 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(10);
    const uris = matched.map((m) => m.track?.uri);
    expect(new Set(uris).size).toBe(10);
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

  it('catalogo de 1 track + ruta de 3 segmentos: 1 con track + 2 con null insufficient', () => {
    // Cero repeticiones: el unico track ocupa el primer segmento, los otros
    // dos quedan como huecos con matchQuality 'insufficient'. La UI
    // (MusicStep + ResultStep) avisa al usuario para que suba mas listas.
    const tracks = [track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 60_000 })];
    const segments = Array.from({ length: 3 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched[0]?.track?.uri).toBe(tracks[0]!.uri);
    expect(matched[1]?.track).toBeNull();
    expect(matched[1]?.matchQuality).toBe('insufficient');
    expect(matched[2]?.track).toBeNull();
    expect(matched[2]?.matchQuality).toBe('insufficient');
  });

  it('ruta de 4 h con pool suficiente: ~80 entradas unicas, sin repetir', () => {
    // Regresion guard del bug original: el matching emitia una entrada por
    // segmento de 60 s (240 entradas para 4 h) en vez de respetar la
    // duracion del track. Con tracks de ~3 min debe rondar 80, todos unicos.
    const tracks = Array.from({ length: 100 }, (_, idx) =>
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
    // Todos los tracks asignados deben ser unicos (pool de 100, necesidad ~80).
    const uris = matched.map((m) => m.track?.uri).filter((u): u is string => u !== undefined);
    expect(new Set(uris).size).toBe(uris.length);
    // Y ninguno debe ser null (pool sobra).
    expect(matched.every((m) => m.track !== null)).toBe(true);
  });

  describe("modo 'discrete' (sesion indoor)", () => {
    function sessionSeg(zone: ClassifiedSegment['zone'], durationSec: number): ClassifiedSegment {
      segId += 1;
      return {
        startSec: segId * 1000,
        durationSec,
        avgPowerWatts: 200,
        zone,
        startDistanceMeters: 0,
        endDistanceMeters: 0,
        startElevationMeters: 0,
        endElevationMeters: 0,
        startLat: 0,
        startLon: 0,
      };
    }

    it('cada bloque arranca con un track de SU zona (no hereda el anterior)', () => {
      // Bloque corto Z5 (30 s) + bloque Z1 (180 s). Los tracks duran 200 s.
      // En overlap, el Z5 sonaria durante todo el Z1 (sin emitir track Z1).
      // En discrete, cada bloque tiene su propio track de su zona.
      const z5 = track({ tempoBpm: 155, energy: 0.92, valence: 0.75, durationMs: 200_000 });
      const z1 = track({ tempoBpm: 100, energy: 0.4, valence: 0.5, durationMs: 200_000 });
      const tracks = [z5, z1];
      const segments = [sessionSeg(5, 30), sessionSeg(1, 180)];
      const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      expect(matched).toHaveLength(2);
      expect(matched[0]?.zone).toBe(5);
      expect(matched[0]?.track?.uri).toBe(z5.uri);
      expect(matched[1]?.zone).toBe(1);
      expect(matched[1]?.track?.uri).toBe(z1.uri);
    });

    it('bloque largo con pool suficiente: 20 tracks unicos sin null', () => {
      // 60 min Z2 / 3 min por track = 20 tracks necesarios. Pool de 25 cubre
      // de sobra y todos los emitidos son unicos.
      const tracks = Array.from({ length: 25 }, (_, idx) =>
        track({
          tempoBpm: 115 + (idx % 6),
          energy: 0.65 + (idx % 5) * 0.01,
          valence: 0.5,
          durationMs: 180_000, // 3 min
        }),
      );
      const segments = [sessionSeg(2, 60 * 60)]; // 60 min Z2
      const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      expect(matched.length).toBeGreaterThanOrEqual(18);
      expect(matched.length).toBeLessThanOrEqual(22);
      // Todos los tracks deben ser distintos (pool sobrado).
      const uris = matched.map((m) => m.track?.uri).filter((u): u is string => u !== undefined);
      expect(new Set(uris).size).toBe(uris.length);
      expect(matched.every((m) => m.track !== null)).toBe(true);
    });

    it('bloque largo con pool insuficiente: tracks unicos + hueco insufficient final', () => {
      // 60 min Z2 / 3 min = 20 necesarios. Pool de 6 -> 6 tracks unicos +
      // 1 hueco null con duracion restante (60-18=42 min).
      const tracks = Array.from({ length: 6 }, (_, idx) =>
        track({
          tempoBpm: 115 + idx,
          energy: 0.65 + idx * 0.01,
          valence: 0.5,
          durationMs: 180_000,
        }),
      );
      const segments = [sessionSeg(2, 60 * 60)];
      const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      const withTrack = matched.filter((m) => m.track !== null);
      const withoutTrack = matched.filter((m) => m.track === null);
      expect(withTrack).toHaveLength(6);
      const uris = withTrack.map((m) => m.track!.uri);
      expect(new Set(uris).size).toBe(6); // todos unicos
      expect(withoutTrack).toHaveLength(1);
      expect(withoutTrack[0]?.matchQuality).toBe('insufficient');
    });

    it('Noruego 4x4: 4 bloques Z4 reciben 4 tracks distintos garantizado', () => {
      const z4Pool = Array.from({ length: 5 }, (_, idx) =>
        track({
          tempoBpm: 135 + idx,
          energy: 0.82 + idx * 0.01,
          valence: 0.65,
          durationMs: 240_000, // 4 min
        }),
      );
      // Plan: 4 × (4' Z4 + 3' Z2)
      const z2Pool = Array.from({ length: 4 }, (_, idx) =>
        track({
          tempoBpm: 115 + idx,
          energy: 0.6,
          valence: 0.5,
          durationMs: 180_000,
        }),
      );
      const tracks = [...z4Pool, ...z2Pool];
      const segments = [
        sessionSeg(4, 240),
        sessionSeg(2, 180),
        sessionSeg(4, 240),
        sessionSeg(2, 180),
        sessionSeg(4, 240),
        sessionSeg(2, 180),
        sessionSeg(4, 240),
        sessionSeg(2, 180),
      ];
      const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      const z4Tracks = matched.filter((m) => m.zone === 4).map((m) => m.track?.uri);
      // Los 4 tracks Z4 deben ser distintos (pool tiene 5, no hace falta repetir)
      expect(z4Tracks).toHaveLength(4);
      expect(new Set(z4Tracks).size).toBe(4);
    });

    it('SIT con catalogo Z5 insuficiente: 3 tracks unicos + 3 nulls insufficient', () => {
      // 6 sprints Z5 con solo 3 tracks Z5 en pool: cero repeticiones obliga
      // a emitir 3 tracks distintos + 3 huecos. La UI deberia haber
      // bloqueado este caso via analyzePoolCoverage en MusicStep.
      const z5Pool = Array.from({ length: 3 }, (_, idx) =>
        track({
          tempoBpm: 155 + idx,
          energy: 0.92,
          valence: 0.75,
          durationMs: 60_000,
        }),
      );
      const z1Pool = [
        track({ tempoBpm: 95, energy: 0.4, valence: 0.5, durationMs: 240_000 }),
      ];
      const segments = Array.from({ length: 6 }, () => sessionSeg(5, 30));
      const matched = matchTracksToSegments(
        segments,
        [...z5Pool, ...z1Pool],
        EMPTY_PREFERENCES,
        { crossZoneMode: 'discrete' },
      );
      expect(matched).toHaveLength(6);
      const withTrack = matched.filter((m) => m.track !== null);
      const withoutTrack = matched.filter((m) => m.track === null);
      expect(withTrack).toHaveLength(3);
      const uris = withTrack.map((m) => m.track!.uri);
      expect(new Set(uris).size).toBe(3); // los 3 son distintos
      expect(withoutTrack).toHaveLength(3);
      expect(withoutTrack.every((m) => m.matchQuality === 'insufficient')).toBe(true);
    });

    it('catalogo totalmente vacio -> matched con track null', () => {
      const segments = [sessionSeg(3, 180)];
      const matched = matchTracksToSegments(segments, [], EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      expect(matched).toHaveLength(1);
      expect(matched[0]?.track).toBeNull();
    });

    it('determinista en modo discrete: misma entrada -> misma salida', () => {
      const tracks = [
        track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
        track({ tempoBpm: 124, energy: 0.78, valence: 0.62, durationMs: 60_000 }),
      ];
      const segs = [sessionSeg(3, 120), sessionSeg(3, 120)];
      const a = matchTracksToSegments(segs, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      const b = matchTracksToSegments(segs, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      expect(a.map((m) => m.track?.uri)).toEqual(b.map((m) => m.track?.uri));
    });

    it('por defecto (sin options) sigue usando overlap (retrocompatible)', () => {
      const tracks = [
        track({ tempoBpm: 125, energy: 0.75, valence: 0.6, durationMs: 200_000 }),
      ];
      const segments = Array.from({ length: 5 }, () => segment(3));
      const withDefault = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
      const withOverlap = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'overlap',
      });
      expect(withDefault).toEqual(withOverlap);
    });
  });
});
