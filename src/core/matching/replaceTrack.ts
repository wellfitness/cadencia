import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

const NEIGHBOR_WINDOW = 5;

export interface ReplaceResult {
  /** Lista de matched con la fila reemplazada. Si no hay alternativa, devuelve la lista igual. */
  matched: MatchedSegment[];
  /** True si se reemplazo realmente (false si no habia alternativa). */
  replaced: boolean;
}

/**
 * Sustituye el track del segmento en la posicion `index` por el siguiente
 * mejor candidato del ranking, evitando:
 *  - Repetir el track actual.
 *  - Repetir tracks de los NEIGHBOR_WINDOW segmentos vecinos (para mantener
 *    la sensacion de variedad que aplicamos en el matching original).
 *
 * Funcion pura: misma entrada -> misma salida. Devuelve un nuevo array.
 *
 * Casos:
 *  - Si no hay alternativa, devuelve la lista intacta y replaced=false.
 *  - Si la zona del segmento no tiene tracks en el catalogo, idem.
 */
export function replaceTrackInSegment(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): ReplaceResult {
  const target = matched[index];
  if (!target) {
    return { matched: [...matched], replaced: false };
  }

  const baseCriteria = ZONE_MUSIC_CRITERIA[target.zone];
  const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
  const { candidates, quality } = findCandidates(tracks, effective);

  if (candidates.length === 0) {
    return { matched: [...matched], replaced: false };
  }

  // URIs prohibidas: la actual + los vecinos (anteriores y posteriores)
  const forbidden = new Set<string>();
  if (target.track !== null) forbidden.add(target.track.uri);
  const from = Math.max(0, index - NEIGHBOR_WINDOW);
  const to = Math.min(matched.length, index + NEIGHBOR_WINDOW + 1);
  for (let i = from; i < to; i++) {
    if (i === index) continue;
    const t = matched[i]?.track;
    if (t) forbidden.add(t.uri);
  }

  const ranked = candidates
    .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
    .sort((a, b) => b.score - a.score);

  const next = ranked.find((c) => !forbidden.has(c.track.uri));
  if (!next) {
    // Fallback: si todos los candidatos estan en forbidden (catalogo muy pequeno),
    // intentamos con el primero que NO sea el track actual exactamente.
    const fallback = ranked.find((c) => c.track.uri !== target.track?.uri);
    if (!fallback) {
      return { matched: [...matched], replaced: false };
    }
    return {
      matched: matched.map((m, i) =>
        i === index
          ? { ...m, track: fallback.track, matchScore: fallback.score, matchQuality: quality }
          : m,
      ),
      replaced: true,
    };
  }

  return {
    matched: matched.map((m, i) =>
      i === index
        ? { ...m, track: next.track, matchScore: next.score, matchQuality: quality }
        : m,
    ),
    replaced: true,
  };
}
