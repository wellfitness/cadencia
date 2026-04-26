import type { Track } from '../tracks/types';
import type { MatchQuality, ZoneMusicCriteria } from './types';

/** Paso de relajacion del filtro de Energy si no hay candidatos estrictos. */
const RELAX_STEP = 0.05;

export interface CandidateBag {
  candidates: Track[];
  quality: MatchQuality;
}

export function passesStrictFilter(track: Track, criteria: ZoneMusicCriteria): boolean {
  if (track.tempoBpm < criteria.bpmMin || track.tempoBpm > criteria.bpmMax) return false;
  if (track.energy < criteria.energyMin) return false;
  if (criteria.valenceMin !== null && track.valence < criteria.valenceMin) return false;
  return true;
}

/**
 * Encuentra candidatos para una zona. Pipeline en 3 niveles:
 *   1. Filtro estricto (BPM + Energy + Valence segun criteria).
 *   2. Relajar Energy progresivamente (-0.05) manteniendo BPM/Valence.
 *   3. Best-effort: top 5 por cercania al BPM midpoint, sin filtros.
 */
export function findCandidates(
  tracks: readonly Track[],
  criteria: ZoneMusicCriteria,
): CandidateBag {
  const strict = tracks.filter((t) => passesStrictFilter(t, criteria));
  if (strict.length > 0) return { candidates: strict, quality: 'strict' };

  for (let energyMin = criteria.energyMin - RELAX_STEP; energyMin >= 0; energyMin -= RELAX_STEP) {
    const relaxedCriteria: ZoneMusicCriteria = { ...criteria, energyMin };
    const relaxed = tracks.filter((t) => passesStrictFilter(t, relaxedCriteria));
    if (relaxed.length > 0) return { candidates: relaxed, quality: 'relaxed' };
  }

  if (tracks.length === 0) return { candidates: [], quality: 'best-effort' };
  const midpoint = (criteria.bpmMin + criteria.bpmMax) / 2;
  const nearest = [...tracks]
    .sort((a, b) => Math.abs(a.tempoBpm - midpoint) - Math.abs(b.tempoBpm - midpoint))
    .slice(0, 5);
  return { candidates: nearest, quality: 'best-effort' };
}
