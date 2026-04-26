import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchQuality, MatchedSegment, ZoneMusicCriteria } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

/** Cuantos segmentos atras evitamos repetir la misma cancion. */
const NO_REPEAT_WINDOW = 5;

/** Paso de relajacion del filtro de Energy si no hay candidatos estrictos. */
const RELAX_STEP = 0.05;

interface CandidateBag {
  candidates: Track[];
  quality: MatchQuality;
}

function passesStrictFilter(track: Track, criteria: ZoneMusicCriteria): boolean {
  if (track.tempoBpm < criteria.bpmMin || track.tempoBpm > criteria.bpmMax) return false;
  if (track.energy < criteria.energyMin) return false;
  if (criteria.valenceMin !== null && track.valence < criteria.valenceMin) return false;
  return true;
}

function findCandidates(tracks: readonly Track[], criteria: ZoneMusicCriteria): CandidateBag {
  // 1. Filtro estricto
  const strict = tracks.filter((t) => passesStrictFilter(t, criteria));
  if (strict.length > 0) return { candidates: strict, quality: 'strict' };

  // 2. Relajar energy progresivamente (manteniendo BPM y valencia)
  for (let energyMin = criteria.energyMin - RELAX_STEP; energyMin >= 0; energyMin -= RELAX_STEP) {
    const relaxedCriteria: ZoneMusicCriteria = { ...criteria, energyMin };
    const relaxed = tracks.filter((t) => passesStrictFilter(t, relaxedCriteria));
    if (relaxed.length > 0) return { candidates: relaxed, quality: 'relaxed' };
  }

  // 3. Best-effort: ordenar todo el catalogo por cercania al BPM midpoint
  if (tracks.length === 0) return { candidates: [], quality: 'best-effort' };
  const midpoint = (criteria.bpmMin + criteria.bpmMax) / 2;
  const nearest = [...tracks]
    .sort((a, b) => Math.abs(a.tempoBpm - midpoint) - Math.abs(b.tempoBpm - midpoint))
    .slice(0, 5);
  return { candidates: nearest, quality: 'best-effort' };
}

/**
 * Asigna una cancion a cada segmento de la ruta segun los criterios de zona
 * y las preferencias del usuario. Determinista: misma entrada -> misma salida.
 *
 * Algoritmo (ver CLAUDE.md "Algoritmo de matching"):
 *  1. Para cada segmento, derivar criterios efectivos (con allEnergetic).
 *  2. Filtrar candidatos estrictos -> relajados -> best-effort.
 *  3. Calcular score por candidato, ordenar desc.
 *  4. Coger el primer track no usado en los ultimos NO_REPEAT_WINDOW segmentos.
 *  5. Si no hay candidato disponible (catalogo demasiado pequeno), elegir
 *     el de mayor score aunque repita: la ventana es preferencia, no regla
 *     bloqueante.
 */
export function matchTracksToSegments(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const recent: string[] = [];
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
  }

  return out;
}
