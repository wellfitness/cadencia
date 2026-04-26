import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

/** Cuantos tracks atras evitamos repetir la misma cancion. */
const NO_REPEAT_WINDOW = 5;

/**
 * Asigna canciones a la ruta segun los criterios de zona y las preferencias
 * del usuario. Determinista: misma entrada -> misma salida.
 *
 * Cada track ocupa todos los segmentos consecutivos que su duracion natural
 * cubra (3-4 min de cancion = 3-4 segmentos de 60 s), en lugar de generar
 * una entrada por cada bloque de 60 s. Asi una ruta de 4 h produce ~70
 * tracks en vez de 240 (CLAUDE.md "Algoritmo de matching", paso 4:
 * "permitir solapamiento al siguiente").
 *
 * Algoritmo:
 *  1. En el segmento actual derivar criterios (con allEnergetic).
 *  2. Filtrar candidatos: estrictos -> relajados -> best-effort.
 *  3. Score por candidato y orden desc.
 *  4. Elegir el primer track no usado en los ultimos NO_REPEAT_WINDOW. Si
 *     todos repiten (catalogo pequeno), coger el de mayor score igualmente.
 *  5. Emitir UNA entrada anclada al segmento actual y avanzar el cursor
 *     consumiendo segmentos hasta cubrir la duracion del track elegido.
 *  6. Si no hay candidato (catalogo vacio en esa zona), avanzar 1 segmento.
 */
export function matchTracksToSegments(
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

    // Consumir tantos segmentos como dure el track. Salvaguarda contra
    // duracion 0 o negativa (datos corruptos): minimo avanzar 1 segmento
    // para no entrar en bucle infinito.
    const trackDurationSec = Math.max(1, choice.track.durationMs / 1000);
    let coveredSec = 0;
    do {
      coveredSec += segments[i]!.durationSec;
      i++;
    } while (i < segments.length && coveredSec < trackDurationSec);
  }

  return out;
}
