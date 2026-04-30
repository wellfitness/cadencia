import { describe, it, expect } from 'vitest';
import { matchTracksToSegments } from './match';
import { defaultCadenceProfile } from '../segmentation/sessionPlan';
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
    // Default BPM 87: cae en Z3 flat (cadencia 80-95). Tracks Z1-Z6 sobreescriben.
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
function segment(
  zone: ClassifiedSegment['zone'],
  sport: ClassifiedSegment['sport'] = 'bike',
): ClassifiedSegment {
  segId += 1;
  return {
    sport,
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

describe('matchTracksToSegments', () => {
  it('un track largo cubre varios segmentos consecutivos (overlap)', () => {
    // Track de 200 s, segmentos de 60 s -> 1 track tapa 4 segmentos (240 s).
    const tracks = [track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 200_000 })];
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
      track({ tempoBpm: 78, energy: 0.5, durationMs: 50_000 }), // Z1 (cadencia 70-85)
      track({ tempoBpm: 82, energy: 0.6, valence: 0.5, durationMs: 50_000 }), // Z2 (cadencia 75-90)
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 50_000 }), // Z3 (cadencia 80-95)
    ];
    const segments = [segment(1), segment(2), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched[0]?.zone).toBe(1);
    expect(matched[1]?.zone).toBe(2);
    expect(matched[2]?.zone).toBe(3);
  });

  it('marca matchQuality strict cuando hay candidato exacto', () => {
    const tracks = [track({ tempoBpm: 87, energy: 0.75, valence: 0.6 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]?.matchQuality).toBe('strict');
  });

  it('energy baja NO descarta tracks: sigue siendo strict si la cadencia encaja', () => {
    // Energy y valence ya no son filtros excluyentes — solo afectan al
    // score. Tracks con cadencia OK pasan strict aunque su energy/valence
    // sean lejos del ideal de la zona.
    const tracks = [
      track({ tempoBpm: 80, energy: 0.55, valence: 0.6 }),
      track({ tempoBpm: 82, energy: 0.5, valence: 0.55 }),
    ];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    expect(matched[0]?.matchQuality).toBe('strict');
    expect(matched[0]?.track).not.toBeNull();
  });

  it('best-effort cuando ningun track tiene BPM en el rango', () => {
    // Z3 flat acepta cadencia 60-130 (1:1) o 120-260 (2:1) → cubre 60-260.
    // Tempo 30 cae fuera (demasiado lento) → best-effort.
    const tracks = [track({ tempoBpm: 30, energy: 0.5 })];
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
        // Z3 flat (cadencia 80-95): primeros 5 en 1:1, siguientes 5 en 2:1.
        tempoBpm: idx < 5 ? 80 + idx : 160 + idx * 2,
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
    const trance = track({ tempoBpm: 87, energy: 0.75, valence: 0.6, genres: ['trance'] });
    const techno = track({ tempoBpm: 87, energy: 0.75, valence: 0.6, genres: ['techno'] });
    const prefs: MatchPreferences = { preferredGenres: ['trance'], allEnergetic: false };
    const matched = matchTracksToSegments([segment(3)], [techno, trance], prefs);
    expect(matched[0]?.track?.uri).toBe(trance.uri);
  });

  it('determinista: misma entrada -> misma salida', () => {
    const tracks = [
      track({ tempoBpm: 87, energy: 0.75, valence: 0.6 }),
      track({ tempoBpm: 85, energy: 0.78, valence: 0.62 }),
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

  it('catalogo de 1 track + ruta de 3 segmentos: 1 strict + 2 repeated (sin huecos)', () => {
    // Politica de repeticion permitida: el unico track ocupa los 3 segmentos.
    // El primero es strict, los siguientes se marcan 'repeated' para que la
    // UI sugiera al usuario subir mas listas.
    const tracks = [track({ tempoBpm: 80, energy: 0.75, valence: 0.6, durationMs: 60_000 })];
    const segments = Array.from({ length: 3 }, () => segment(3));
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    expect(matched).toHaveLength(3);
    expect(matched[0]?.track?.uri).toBe(tracks[0]!.uri);
    expect(matched[0]?.matchQuality).toBe('strict');
    expect(matched[1]?.track?.uri).toBe(tracks[0]!.uri);
    expect(matched[1]?.matchQuality).toBe('repeated');
    expect(matched[2]?.track?.uri).toBe(tracks[0]!.uri);
    expect(matched[2]?.matchQuality).toBe('repeated');
  });

  it('ruta de 4 h con pool suficiente: ~80 entradas unicas, sin repetir', () => {
    // Regresion guard del bug original: el matching emitia una entrada por
    // segmento de 60 s (240 entradas para 4 h) en vez de respetar la
    // duracion del track. Con tracks de ~3 min debe rondar 80, todos unicos.
    const tracks = Array.from({ length: 100 }, (_, idx) =>
      track({
        // Z3 flat (cadencia 80-95): mitad en 1:1, mitad en 2:1 (160-190 BPM).
        tempoBpm: idx % 2 === 0 ? 80 + (idx % 10) : 160 + (idx % 20),
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
    function sessionSeg(
      zone: ClassifiedSegment['zone'],
      durationSec: number,
      sport: ClassifiedSegment['sport'] = 'bike',
    ): ClassifiedSegment {
      segId += 1;
      return {
        sport,
        startSec: segId * 1000,
        durationSec,
        avgPowerWatts: 200,
        zone,
        cadenceProfile: defaultCadenceProfile(zone),
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
      // Z5 climb (cadencia 55-75): tempo 65 cae en 1:1.
      // Z1 flat (cadencia 70-85): tempo 78 cae en 1:1.
      const z5 = track({ tempoBpm: 65, energy: 0.92, valence: 0.75, durationMs: 200_000 });
      const z1 = track({ tempoBpm: 78, energy: 0.4, valence: 0.5, durationMs: 200_000 });
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
          // Z2 flat (cadencia 75-90): mitad 1:1 (75-90), mitad 2:1 (150-180).
          tempoBpm: idx < 13 ? 75 + idx : 150 + (idx - 13) * 2,
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

    it('bloque largo con pool insuficiente: 6 unicos + repeticiones hasta cubrir', () => {
      // 60 min Z2 / 3 min = 20 tracks necesarios. Pool de 6 -> 6 tracks
      // unicos + el resto repetidos (politica: nunca dejar huecos).
      const tracks = Array.from({ length: 6 }, (_, idx) =>
        track({
          tempoBpm: 75 + idx * 2,
          energy: 0.65 + idx * 0.01,
          valence: 0.5,
          durationMs: 180_000,
        }),
      );
      const segments = [sessionSeg(2, 60 * 60)];
      const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'discrete',
      });
      // Todos los segments deben tener track (sin huecos null).
      expect(matched.every((m) => m.track !== null)).toBe(true);
      const uniqueUris = new Set(matched.map((m) => m.track!.uri));
      expect(uniqueUris.size).toBe(6); // 6 tracks distintos en el pool
      const repeatedCount = matched.filter((m) => m.matchQuality === 'repeated').length;
      expect(repeatedCount).toBeGreaterThan(0); // algunos marcados 'repeated'
    });

    it('Noruego 4x4: cero repeticiones globales en toda la playlist', () => {
      // Con energy/valence como score (no filtro), un track puede asignarse
      // a la zona donde maximice su score combinado. Lo unico garantizado
      // por el motor es CERO REPETICIONES globales: ningun URI aparece dos
      // veces, ni siquiera entre zonas.
      const z4Pool = Array.from({ length: 5 }, (_, idx) =>
        track({
          // Cadencia Z4 flat 70-90: BPMs 70, 75, 80, 85, 90.
          tempoBpm: 70 + idx * 5,
          energy: 0.82 + idx * 0.01,
          valence: 0.65,
          durationMs: 240_000,
        }),
      );
      const z2Pool = Array.from({ length: 4 }, (_, idx) =>
        track({
          // Cadencia 2:1 Z2 flat: BPM 140-180. No solapan con Z4 1:1.
          tempoBpm: 140 + idx * 5,
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
      const allUris = matched
        .map((m) => m.track?.uri)
        .filter((u): u is string => u !== undefined);
      // Cero repeticiones global.
      expect(new Set(allUris).size).toBe(allUris.length);
    });

    it('SIT con pool Z5 limitado: agota strict, cae a best-effort, luego repeated', () => {
      // 6 sprints Z5. Pool: 3 tracks Z5 strict + 1 Z1 (cadencia no encaja Z5).
      // Politica: agota strict primero, luego usa Z1 como best-effort
      // (mejor que repetir), y solo repite cuando TODO esta usado.
      const z5Pool = Array.from({ length: 3 }, (_, idx) =>
        track({
          tempoBpm: 60 + idx * 5,
          energy: 0.92,
          valence: 0.75,
          durationMs: 60_000,
        }),
      );
      const z1Pool = [
        track({ tempoBpm: 85, energy: 0.4, valence: 0.5, durationMs: 240_000 }),
      ];
      const segments = Array.from({ length: 6 }, () => sessionSeg(5, 30));
      const matched = matchTracksToSegments(
        segments,
        [...z5Pool, ...z1Pool],
        EMPTY_PREFERENCES,
        { crossZoneMode: 'discrete' },
      );
      expect(matched).toHaveLength(6);
      expect(matched.every((m) => m.track !== null)).toBe(true);
      // 4 URIs distintos en total: 3 z5 + 1 z1 (best-effort cross-zone).
      const uniqueUris = new Set(matched.map((m) => m.track!.uri));
      expect(uniqueUris.size).toBe(4);
      // El motor prioriza no repetir: 3 strict + 1 best-effort + 2 repeated.
      const strictCount = matched.filter((m) => m.matchQuality === 'strict').length;
      const bestEffortCount = matched.filter((m) => m.matchQuality === 'best-effort').length;
      const repeatedCount = matched.filter((m) => m.matchQuality === 'repeated').length;
      expect(strictCount).toBe(3);
      expect(bestEffortCount).toBe(1);
      expect(repeatedCount).toBe(2);
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
        track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
        track({ tempoBpm: 85, energy: 0.78, valence: 0.62, durationMs: 60_000 }),
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
        track({ tempoBpm: 87, energy: 0.75, valence: 0.6, durationMs: 200_000 }),
      ];
      const segments = Array.from({ length: 5 }, () => segment(3));
      const withDefault = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
      const withOverlap = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES, {
        crossZoneMode: 'overlap',
      });
      expect(withDefault).toEqual(withOverlap);
    });
  });

  describe('seeded variety (preferences.seed)', () => {
    function uris(matched: ReturnType<typeof matchTracksToSegments>): string[] {
      return matched.map((m) => m.track?.uri ?? '<null>');
    }

    function manyZ3Tracks(n: number): Track[] {
      // Tracks de 30 s -> cada track ocupa un slot, sin overlap. BPM 80-95
      // (cadencia Z3 flat). Energy/valence variando para que los scores
      // difieran y el sampling tenga peso real.
      return Array.from({ length: n }, (_, i) =>
        track({
          tempoBpm: 80 + (i % 16),
          energy: 0.6 + (i % 10) * 0.03,
          valence: 0.5 + (i % 7) * 0.05,
          durationMs: 30_000,
        }),
      );
    }

    it('reproducible: misma seed + mismo input -> misma playlist', () => {
      const tracks = manyZ3Tracks(40);
      const segments = Array.from({ length: 12 }, () => segment(3));
      const prefs: MatchPreferences = { ...EMPTY_PREFERENCES, seed: 42 };
      const a = matchTracksToSegments(segments, tracks, prefs);
      const b = matchTracksToSegments(segments, tracks, prefs);
      expect(uris(a)).toEqual(uris(b));
    });

    it('seeds distintas -> al menos un slot distinto con catalogo abundante', () => {
      const tracks = manyZ3Tracks(40);
      const segments = Array.from({ length: 12 }, () => segment(3));
      const a = matchTracksToSegments(segments, tracks, {
        ...EMPTY_PREFERENCES,
        seed: 42,
      });
      const b = matchTracksToSegments(segments, tracks, {
        ...EMPTY_PREFERENCES,
        seed: 43,
      });
      expect(uris(a)).not.toEqual(uris(b));
    });

  });

  // === REGRESION C1: el sport del segmento debe llegar al matcher ===
  // Antes de fix, ClassifiedSegment no llevaba sport y getZoneCriteria caia
  // siempre al default 'bike'. Las sesiones de running terminaban filtrando
  // por rangos rpm en vez de spm. Estos tests vigilan que NO vuelva a pasar.
  describe('multisport: sport del segmento dirige el filtro de cadencia', () => {
    it('run + Z3 acepta tracks 165-178 BPM (rango spm 1:1) y rechaza 80 BPM (rango bike)', () => {
      // Track de bike (80 BPM, midpoint cadencia bike Z3 flat) y track de run
      // (170 BPM, midpoint cadencia run Z3) — ambos disponibles. En run, solo
      // el de 170 debe encajar como strict.
      const trackBike = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 70_000 });
      const trackRun = track({ tempoBpm: 170, energy: 0.7, valence: 0.55, durationMs: 70_000 });
      const segs: ClassifiedSegment[] = [
        { ...segment(3, 'run'), durationSec: 60 },
      ];
      const matched = matchTracksToSegments(segs, [trackBike, trackRun], EMPTY_PREFERENCES);
      expect(matched).toHaveLength(1);
      // El run-track gana: cae dentro del rango 165-178 spm 1:1.
      expect(matched[0]?.track?.uri).toBe(trackRun.uri);
      expect(matched[0]?.matchQuality).toBe('strict');
    });

    it('bike + Z3 acepta 80 BPM y rechaza el de 170 spm como strict', () => {
      const trackBike = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 70_000 });
      const trackRun = track({ tempoBpm: 170, energy: 0.7, valence: 0.55, durationMs: 70_000 });
      const segs: ClassifiedSegment[] = [
        { ...segment(3, 'bike'), durationSec: 60 },
      ];
      const matched = matchTracksToSegments(segs, [trackBike, trackRun], EMPTY_PREFERENCES);
      expect(matched).toHaveLength(1);
      // Bike Z3 flat: 70-90 BPM (1:1) o 140-180 BPM (2:1). 170 BPM cae en 2:1
      // y 80 BPM cae en 1:1 — ambos pasan filtro. El que mas se acerca al
      // midpoint de su rango respectivo gana. 80 (=midpoint 1:1) puntua mas.
      expect(matched[0]?.track?.uri).toBe(trackBike.uri);
    });

    it('run + Z6 (180-200 spm) NO acepta 90 BPM (cadencia sprint bike)', () => {
      // Track BPM 90: en bike Z6 sprint encaja (90-115 1:1). En run Z6 NO
      // encaja (180-200 1:1, ni half-cadence 90-100). Si el bug regresara,
      // matchearia como bike erroneamente.
      const trackSprintBike = track({ tempoBpm: 90, energy: 0.95, valence: 0.7, durationMs: 70_000 });
      const trackSprintRun = track({ tempoBpm: 185, energy: 0.95, valence: 0.7, durationMs: 70_000 });
      const segs: ClassifiedSegment[] = [
        { ...segment(6, 'run'), durationSec: 60, cadenceProfile: 'flat' },
      ];
      const matched = matchTracksToSegments(segs, [trackSprintBike, trackSprintRun], EMPTY_PREFERENCES);
      // El track de 185 BPM gana (cadencia run Z6 1:1 lo acepta).
      expect(matched[0]?.track?.uri).toBe(trackSprintRun.uri);
    });
  });
});
