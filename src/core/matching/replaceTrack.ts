import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

export interface ReplaceResult {
  /** Lista de matched con la fila reemplazada. Si no hay alternativa, devuelve la lista igual. */
  matched: MatchedSegment[];
  /** True si se reemplazo realmente (false si no habia alternativa). */
  replaced: boolean;
}

/**
 * Sustituye el track del segmento en la posicion `index` por el siguiente
 * mejor candidato del ranking, evitando repetir CUALQUIER track ya presente
 * en la playlist (regla cero repeticiones global, alineada con el motor de
 * matching).
 *
 * Funcion pura: misma entrada -> misma salida. Devuelve un nuevo array.
 *
 * Casos:
 *  - Si no hay alternativa unica disponible, devuelve replaced=false. La UI
 *    debe avisar al usuario que suba mas listas.
 *  - Si la zona del segmento no tiene tracks en el catalogo, idem.
 *  - Indice fuera de rango: no rompe, devuelve replaced=false.
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

  // URIs prohibidas: TODAS las que ya estan en la playlist (no solo vecinos).
  // El segmento que estamos reemplazando se incluye explicitamente para que
  // el ranking nunca devuelva el mismo track (aunque el index del array ya
  // lo cubrira al estar en la lista).
  const forbidden = new Set<string>();
  for (let i = 0; i < matched.length; i++) {
    const t = matched[i]?.track;
    if (t) forbidden.add(t.uri);
  }

  const ranked = candidates
    .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
    .sort((a, b) => b.score - a.score);

  const next = ranked.find((c) => !forbidden.has(c.track.uri));
  if (!next) {
    return { matched: [...matched], replaced: false };
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
