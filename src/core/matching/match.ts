import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

/** Cuantos segmentos atras evitamos repetir la misma cancion. */
const NO_REPEAT_WINDOW = 5;

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
