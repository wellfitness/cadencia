import { describe, it, expect } from 'vitest';
import {
  getAlternativesForSegment,
  moveTrackToSegment,
  replaceTrackInSegment,
} from './replaceTrack';
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
  it('incluye las usadas marcadas con usedAtIndex (frescas primero, usadas despues)', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.75, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.78, valence: 0.65, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.8, valence: 0.7, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.77, valence: 0.65, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);

    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    // 5 tracks - 1 (el del propio tramo 0) = 4 candidatas: 2 frescas + 2 usadas.
    expect(alts.length).toBe(4);
    const fresh = alts.filter((a) => a.usedAtIndex === null);
    const used = alts.filter((a) => a.usedAtIndex !== null);
    expect(fresh.length).toBe(2);
    expect(used.length).toBe(2);
    // Las usadas apuntan a OTROS tramos (1 o 2), nunca al propio (0).
    for (const u of used) {
      expect(u.usedAtIndex === 1 || u.usedAtIndex === 2).toBe(true);
    }
    // Frescas primero, usadas despues.
    expect(alts.slice(0, 2).every((a) => a.usedAtIndex === null)).toBe(true);
    expect(alts.slice(2).every((a) => a.usedAtIndex !== null)).toBe(true);
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

  it('todas en uso pero encajan aqui: ofrece las usadas marcadas (para mover)', () => {
    // Ambas canciones pasan cadencia Z3 (80, 85). El otro tramo usa la otra:
    // se ofrece marcada con su usedAtIndex para poder moverla a este slot.
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const alts = getAlternativesForSegment(matched, 0, tracks, EMPTY_PREFERENCES);
    expect(alts.length).toBe(1);
    expect(alts[0]!.usedAtIndex).not.toBeNull();
    expect(alts[0]!.passesCadence).toBe(true);
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

describe('moveTrackToSegment', () => {
  it('mueve la cancion al target y rellena el origen; cero repeticiones', () => {
    // 5 tracks (todos Z3), 4 segmentos -> 4 usados + 1 libre.
    const tracks = [
      track({ tempoBpm: 75, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 78, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 82, energy: 0.74, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.76, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.78, valence: 0.6, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const sourceUri = matched[2]!.track!.uri;

    const result = moveTrackToSegment(matched, 0, sourceUri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(true);
    expect(result.changedIndices).toEqual([0, 2]);
    // El target recibe la cancion movida.
    expect(result.matched[0]!.track!.uri).toBe(sourceUri);
    // El origen ya no tiene la cancion movida (se relleno con otra).
    expect(result.matched[2]!.track!.uri).not.toBe(sourceUri);
    // Cero repeticiones en toda la lista.
    const uris = result.matched.map((m) => m.track?.uri).filter((u): u is string => !!u);
    expect(new Set(uris).size).toBe(uris.length);
    // La longitud no cambia.
    expect(result.matched.length).toBe(matched.length);
  });

  it('reutiliza la cancion desplazada del target como relleno cuando es la unica libre (swap)', () => {
    // 4 tracks, 4 segmentos -> pool agotado, ninguna libre. Al mover la del
    // tramo 3 al tramo 0, la desplazada del tramo 0 queda libre y rellena el 3.
    const tracks = [
      track({ tempoBpm: 75, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 80, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.74, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.76, valence: 0.6, durationMs: 60_000 }),
    ];
    const segments = [segment(3), segment(3), segment(3), segment(3)];
    const matched = matchTracksToSegments(segments, tracks, EMPTY_PREFERENCES);
    const origSlot0 = matched[0]!.track!.uri;
    const origSlot3 = matched[3]!.track!.uri;

    const result = moveTrackToSegment(matched, 0, origSlot3, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(true);
    // Swap: target recibe la del 3; el 3 recibe la desplazada del 0.
    expect(result.matched[0]!.track!.uri).toBe(origSlot3);
    expect(result.matched[3]!.track!.uri).toBe(origSlot0);
    const uris = result.matched.map((m) => m.track!.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('recomputa matchQuality del target: best-effort si la movida no encaja en su zona', () => {
    // Track Z3 (80 BPM) y track Z6-only (100 BPM, sprint). En una sesion con
    // un tramo Z3 y un tramo Z6, mover el de 80 (Z3) al tramo Z6 lo marca
    // best-effort (80 no encaja en sprint 90-115).
    const z3Track = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 60_000 });
    const z6Track = track({ tempoBpm: 100, energy: 0.95, valence: 0.7, durationMs: 60_000 });
    const segments = [segment(3), segment(6)];
    const matched = matchTracksToSegments(segments, [z3Track, z6Track], EMPTY_PREFERENCES);
    // Mover el track de 80 (en el tramo Z3) al tramo Z6 (index 1).
    const result = moveTrackToSegment(matched, 1, z3Track.uri, [z3Track, z6Track], EMPTY_PREFERENCES);
    expect(result.moved).toBe(true);
    expect(result.matched[1]!.track!.uri).toBe(z3Track.uri);
    expect(result.matched[1]!.matchQuality).toBe('best-effort');
  });

  it('cero repeticiones: mover una cancion REPETIDA neutraliza TODAS sus copias', () => {
    // 2 tracks, 3 slots Z3 -> el motor repite uno: matched = [X, Y, X]. Este es
    // el caso que ataca la feature (catalogo pequeño en Z1/Z2). Mover X a un
    // tercer tramo NO debe dejar la otra copia viva (regla cardinal).
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments(
      [segment(3), segment(3), segment(3)],
      tracks,
      EMPTY_PREFERENCES,
    );
    const repeatedUri = matched[0]!.track!.uri;
    // Precondicion: la misma cancion ocupa los tramos 0 y 2.
    expect(matched[2]!.track!.uri).toBe(repeatedUri);
    expect(matched.filter((m) => m.track?.uri === repeatedUri).length).toBe(2);

    // El usuario la mueve al tramo 1 (donde NO esta).
    const result = moveTrackToSegment(matched, 1, repeatedUri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(true);
    // Queda en el target y EN NINGUN otro tramo.
    expect(result.matched[1]!.track!.uri).toBe(repeatedUri);
    expect(result.matched.filter((m) => m.track?.uri === repeatedUri).length).toBe(1);
    // Cero repeticiones global (ignorando huecos null).
    const uris = result.matched.map((m) => m.track?.uri).filter((u): u is string => !!u);
    expect(new Set(uris).size).toBe(uris.length);
    // Ambos huecos de origen (0 y 2) se reorganizaron.
    expect(result.changedIndices).toEqual([1, 0, 2]);
  });

  it('origen sin relleno posible -> ese hueco queda sin cancion (insufficient)', () => {
    // [X, Y, X]: al mover X al tramo 1, el hueco 0 se rellena con Y (la
    // desplazada del target), pero el hueco 2 ya no tiene candidata libre.
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments(
      [segment(3), segment(3), segment(3)],
      tracks,
      EMPTY_PREFERENCES,
    );
    const repeatedUri = matched[0]!.track!.uri;
    const result = moveTrackToSegment(matched, 1, repeatedUri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(true);
    const insufficientCount = result.matched.filter(
      (m) => m.track === null && m.matchQuality === 'insufficient',
    ).length;
    expect(insufficientCount).toBe(1);
  });

  it('no-op: el target ya contiene la cancion (mover sobre una de sus copias)', () => {
    // [X, Y, X]: pedir mover X al tramo 0 (donde ya esta) es no-op.
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.55, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments(
      [segment(3), segment(3), segment(3)],
      tracks,
      EMPTY_PREFERENCES,
    );
    const repeatedUri = matched[0]!.track!.uri;
    const result = moveTrackToSegment(matched, 0, repeatedUri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(false);
  });

  it('no-op: sourceUri no esta en la lista', () => {
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(3), segment(3)], tracks, EMPTY_PREFERENCES);
    const result = moveTrackToSegment(matched, 0, 'spotify:track:no-existe', tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(false);
    expect(result.changedIndices).toEqual([]);
    expect(result.matched.map((m) => m.track?.uri)).toEqual(matched.map((m) => m.track?.uri));
  });

  it('no-op: origen == destino (mover sobre si mismo)', () => {
    const tracks = [
      track({ tempoBpm: 80, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments([segment(3), segment(3)], tracks, EMPTY_PREFERENCES);
    const ownUri = matched[0]!.track!.uri;
    const result = moveTrackToSegment(matched, 0, ownUri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(false);
  });

  it('no-op: targetIndex fuera de rango', () => {
    const tracks = [track({ tempoBpm: 80, energy: 0.7, valence: 0.6, durationMs: 60_000 })];
    const matched = matchTracksToSegments([segment(3)], tracks, EMPTY_PREFERENCES);
    const result = moveTrackToSegment(matched, 99, matched[0]!.track!.uri, tracks, EMPTY_PREFERENCES);
    expect(result.moved).toBe(false);
  });

  it('determinista: misma entrada -> mismo resultado', () => {
    const tracks = [
      track({ tempoBpm: 75, energy: 0.7, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 80, energy: 0.72, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 85, energy: 0.74, valence: 0.6, durationMs: 60_000 }),
      track({ tempoBpm: 88, energy: 0.76, valence: 0.6, durationMs: 60_000 }),
    ];
    const matched = matchTracksToSegments(
      [segment(3), segment(3), segment(3)],
      tracks,
      EMPTY_PREFERENCES,
    );
    const sourceUri = matched[2]!.track!.uri;
    const a = moveTrackToSegment(matched, 0, sourceUri, tracks, EMPTY_PREFERENCES);
    const b = moveTrackToSegment(matched, 0, sourceUri, tracks, EMPTY_PREFERENCES);
    expect(a.matched.map((m) => m.track?.uri)).toEqual(b.matched.map((m) => m.track?.uri));
  });
});
