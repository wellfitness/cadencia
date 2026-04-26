import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

/** Cuantos tracks atras evitamos repetir la misma cancion. */
const NO_REPEAT_WINDOW = 5;

/**
 * Modo de asignacion de tracks frente a la estructura de zonas:
 * - 'overlap' (default, GPX): un track cubre los siguientes segmentos
 *   consecutivos hasta agotar su duracion, AUNQUE cambien de zona. Adecuado
 *   para rutas continuas donde los segmentos vecinos suelen compartir zona.
 * - 'discrete' (sesion indoor): cada segmento es una unidad atomica. Para
 *   un segmento de duracion D se emiten N tracks de SU zona hasta cubrir D.
 *   El siguiente segmento arranca con su propio track. Evita que un track
 *   de zona alta suene durante un bloque de recuperacion.
 */
export type CrossZoneMode = 'overlap' | 'discrete';

export interface MatchOptions {
  crossZoneMode?: CrossZoneMode;
}

/**
 * Asigna canciones a la ruta segun los criterios de zona y las preferencias
 * del usuario. Determinista: misma entrada -> misma salida.
 *
 * Para GPX (default 'overlap'): cada track ocupa todos los segmentos
 * consecutivos que su duracion cubra (3-4 min de cancion = 3-4 segmentos
 * de 60 s). Asi una ruta de 4 h produce ~70 tracks en vez de 240 (CLAUDE.md
 * "Algoritmo de matching", paso 4: "permitir solapamiento al siguiente").
 *
 * Para sesion indoor ('discrete'): cada bloque es atomico, recibe N tracks
 * todos de su zona, y el siguiente bloque empieza limpio.
 */
export function matchTracksToSegments(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
  options: MatchOptions = {},
): MatchedSegment[] {
  const { crossZoneMode = 'overlap' } = options;
  if (crossZoneMode === 'discrete') {
    return matchDiscrete(segments, tracks, preferences);
  }
  return matchOverlap(segments, tracks, preferences);
}

/**
 * Algoritmo original (GPX): cursor que avanza segmentos consumiendo lo que
 * dura el track elegido en el segmento de partida.
 */
function matchOverlap(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const recent: string[] = [];
  const out: MatchedSegment[] = [];

  let i = 0;
  while (i < segments.length) {
    const seg = segments[i]!;
    const baseCriteria = ZONE_MUSIC_CRITERIA[seg.zone];
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    const { candidates, quality } = findCandidates(tracks, effective);

    if (candidates.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: quality });
      i++;
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    const fresh = scored.find((c) => !recent.includes(c.track.uri));
    const choice = fresh ?? scored[0]!;

    recent.push(choice.track.uri);
    if (recent.length > NO_REPEAT_WINDOW) recent.shift();

    out.push({
      ...seg,
      track: choice.track,
      matchScore: choice.score,
      matchQuality: quality,
    });

    const trackDurationSec = Math.max(1, choice.track.durationMs / 1000);
    let coveredSec = 0;
    do {
      coveredSec += segments[i]!.durationSec;
      i++;
    } while (i < segments.length && coveredSec < trackDurationSec);
  }

  return out;
}

/**
 * Algoritmo discrete (sesion indoor): cada segmento se trata como un bloque
 * atomico. Para cubrir su duracion se emiten tantos tracks como hagan falta,
 * todos de SU zona. El siguiente segmento arranca con su propio track.
 *
 * Window dinamico de no-repeticion POR ZONA: max(1, min(5, pool - 1)).
 * Mantener una cola separada por zona evita el olvido cruzado: si paso por
 * un bloque Z2 con pool de 4, no quiero que eso reduzca mi memoria de Z4.
 */
function matchDiscrete(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const recentByZone = new Map<ClassifiedSegment['zone'], string[]>();
  const out: MatchedSegment[] = [];

  for (const seg of segments) {
    const baseCriteria = ZONE_MUSIC_CRITERIA[seg.zone];
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    const { candidates, quality } = findCandidates(tracks, effective);

    if (candidates.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: quality });
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    // Window dinamico: que cada track suene antes de repetirse, con un techo
    // de NO_REPEAT_WINDOW para no agotar memoria en bloques largos.
    const windowSize = Math.max(1, Math.min(NO_REPEAT_WINDOW, scored.length - 1));
    const recent = recentByZone.get(seg.zone) ?? [];

    let coveredSec = 0;
    while (coveredSec < seg.durationSec) {
      const fresh = scored.find((c) => !recent.includes(c.track.uri));
      const choice = fresh ?? scored[0]!;

      recent.push(choice.track.uri);
      while (recent.length > windowSize) recent.shift();

      const trackDurationSec = Math.max(1, choice.track.durationMs / 1000);
      const remainingSec = seg.durationSec - coveredSec;
      const slotSec = Math.min(trackDurationSec, remainingSec);

      out.push({
        ...seg,
        startSec: seg.startSec + coveredSec,
        durationSec: slotSec,
        track: choice.track,
        matchScore: choice.score,
        matchQuality: quality,
      });

      // Avanzamos por la duracion REAL del track (no acotada). Si el track
      // dura mas que el bloque, igualmente cerramos el bloque aqui — el
      // siguiente bloque empezara con su propio track.
      coveredSec += trackDurationSec;
    }

    recentByZone.set(seg.zone, recent);
  }

  return out;
}
