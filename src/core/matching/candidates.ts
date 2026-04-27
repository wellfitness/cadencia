import type { Track } from '../tracks/types';
import type { MatchQuality, ZoneMusicCriteria } from './types';

export interface CandidateBag {
  candidates: Track[];
  quality: MatchQuality;
}

/**
 * Comprueba si el tempo de un track encaja con la cadencia objetivo del
 * bloque, aceptando dos vias:
 *   - 1:1: cadenceMin <= tempoBpm <= cadenceMax (track 80 BPM = 80 rpm).
 *   - 2:1 half-time: 2*cadenceMin <= tempoBpm <= 2*cadenceMax (track 160 BPM
 *     se pedalea a 80 rpm con golpe fuerte cada 2 pedaladas).
 *
 * Esta es la UNICA condicion excluyente del matching. Energy y valence se
 * incorporan al SCORE (scoreTrack), no como filtro.
 */
export function passesCadenceFilter(
  tempoBpm: number,
  criteria: ZoneMusicCriteria,
): boolean {
  if (tempoBpm >= criteria.cadenceMin && tempoBpm <= criteria.cadenceMax) {
    return true;
  }
  const halfTimeMin = 2 * criteria.cadenceMin;
  const halfTimeMax = 2 * criteria.cadenceMax;
  return tempoBpm >= halfTimeMin && tempoBpm <= halfTimeMax;
}

/**
 * Encuentra candidatos para un (zona, cadenceProfile). Pipeline en 2 niveles:
 *   1. Strict: tracks cuya cadencia (1:1 ∪ 2:1) encaje con el bloque.
 *   2. Best-effort: si NINGUN track del catalogo pasa el filtro de cadencia,
 *      devolver los 5 mas cercanos al midpoint para que el bloque no quede
 *      vacio. Esto es defensivo — en la practica con un catalogo razonable
 *      siempre hay tracks cuya cadencia encaja.
 *
 * No hay nivel "relaxed" intermedio: energy y valence ya no son filtros,
 * solo influyen en el score posterior.
 */
export function findCandidates(
  tracks: readonly Track[],
  criteria: ZoneMusicCriteria,
): CandidateBag {
  const strict = tracks.filter((t) => passesCadenceFilter(t.tempoBpm, criteria));
  if (strict.length > 0) return { candidates: strict, quality: 'strict' };

  if (tracks.length === 0) return { candidates: [], quality: 'best-effort' };

  // Best-effort: top 5 mas cercanos al midpoint mas cercano (1:1 o 2:1).
  const midpoint11 = (criteria.cadenceMin + criteria.cadenceMax) / 2;
  const midpoint21 = midpoint11 * 2;
  const distanceToNearest = (bpm: number): number =>
    Math.min(Math.abs(bpm - midpoint11), Math.abs(bpm - midpoint21));
  const nearest = [...tracks]
    .sort((a, b) => distanceToNearest(a.tempoBpm) - distanceToNearest(b.tempoBpm))
    .slice(0, 5);
  return { candidates: nearest, quality: 'best-effort' };
}
