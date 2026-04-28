import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchQuality, MatchedSegment } from './types';
import { applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

export interface ReplaceResult {
  /** Lista de matched con la fila reemplazada. Si no hay alternativa, devuelve la lista igual. */
  matched: MatchedSegment[];
  /** True si se reemplazo realmente (false si no habia alternativa). */
  replaced: boolean;
}

/**
 * Una alternativa rankeada para un slot de la playlist. La UI usa esta forma
 * para mostrar el listado en el dropdown "Otro tema".
 */
export interface AlternativeCandidate {
  track: Track;
  score: number;
}

interface RankedCandidatesBag {
  ranked: AlternativeCandidate[];
  /**
   * Calidad heredada de findCandidates: 'strict' si algun track del catalogo
   * pasa el filtro de cadencia, 'best-effort' si ninguno pasa. Si el segmento
   * actual es 'best-effort', las alternativas tambien lo seran por construccion.
   */
  quality: MatchQuality;
}

/**
 * Calcula el ranking de candidatos validos para sustituir el track en
 * `index`, excluyendo TODAS las URIs ya presentes en `matched` (incluida la
 * del propio segmento). Pure helper compartido por:
 *  - `getAlternativesForSegment` (lista para el dropdown UI).
 *  - `replaceTrackInSegment` (sustitucion concreta).
 *
 * Devuelve `null` si el index esta fuera de rango. Devuelve `ranked: []`
 * cuando no hay candidatos en el catalogo o todos estan ya en uso.
 */
function rankAvailableCandidates(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): RankedCandidatesBag | null {
  const target = matched[index];
  if (!target) return null;

  const baseCriteria = getZoneCriteria(target.zone, target.cadenceProfile);
  const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
  const { candidates, quality } = findCandidates(tracks, effective);

  // URIs prohibidas: TODAS las que ya estan en la playlist (no solo vecinos).
  // El segmento que estamos reemplazando se incluye explicitamente para que
  // el ranking nunca devuelva el mismo track.
  const forbidden = new Set<string>();
  for (const m of matched) {
    if (m.track) forbidden.add(m.track.uri);
  }

  const ranked = candidates
    .filter((t) => !forbidden.has(t.uri))
    .map((t) => ({
      track: t,
      score: scoreTrack(t, effective, preferences.preferredGenres),
    }))
    .sort((a, b) => b.score - a.score);

  return { ranked, quality };
}

/**
 * Devuelve TODAS las alternativas validas para el segmento en `index`,
 * ordenadas por score descendente y excluyendo cualquier URI ya presente en
 * `matched` (incluido el propio track actual del segmento).
 *
 * Funcion pura: misma entrada -> misma salida. La UI usa el resultado para
 * pintar un dropdown de seleccion manual.
 *
 * - Si el segmento actual es 'best-effort' (ningun track del catalogo pasa
 *   filtro de cadencia para esa zona), las alternativas devueltas tambien
 *   seran 'best-effort' por construccion de findCandidates.
 * - Devuelve `[]` cuando el indice es invalido, el catalogo no tiene
 *   candidatos para esa zona, o todos los candidatos estan ya en uso.
 */
export function getAlternativesForSegment(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): AlternativeCandidate[] {
  const bag = rankAvailableCandidates(matched, index, tracks, preferences);
  return bag?.ranked ?? [];
}

/**
 * Sustituye el track del segmento en la posicion `index`. Por defecto coge el
 * mejor candidato del ranking; si se pasa `targetUri`, sustituye exactamente
 * por ese URI (siempre que sea un candidato valido y no este ya en la
 * playlist). En ambos casos respeta la regla cero repeticiones global.
 *
 * Funcion pura: misma entrada -> misma salida. Devuelve un nuevo array.
 *
 * Casos:
 *  - Sin alternativas disponibles: replaced=false.
 *  - `targetUri` no esta en candidates o ya esta en uso: replaced=false.
 *  - Indice fuera de rango: replaced=false.
 */
export function replaceTrackInSegment(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
  targetUri?: string,
): ReplaceResult {
  const bag = rankAvailableCandidates(matched, index, tracks, preferences);
  if (!bag || bag.ranked.length === 0) {
    return { matched: [...matched], replaced: false };
  }

  const next =
    targetUri !== undefined
      ? bag.ranked.find((c) => c.track.uri === targetUri)
      : bag.ranked[0];
  if (!next) {
    return { matched: [...matched], replaced: false };
  }

  return {
    matched: matched.map((m, i) =>
      i === index
        ? { ...m, track: next.track, matchScore: next.score, matchQuality: bag.quality }
        : m,
    ),
    replaced: true,
  };
}
