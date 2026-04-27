import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

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
 * Regla cero repeticiones: ningun track aparece dos veces en la playlist.
 * Si el pool no llega para cubrir todos los segmentos, se emiten huecos con
 * track=null y matchQuality='insufficient'. La UI debe pre-comprobar la
 * cobertura con analyzePoolCoverage() antes de invocar este motor.
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
 * Algoritmo overlap (GPX): cursor que avanza segmentos consumiendo lo que
 * dura el track elegido en el segmento de partida.
 */
function matchOverlap(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const used = new Set<string>();
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

    const fresh = scored.find((c) => !used.has(c.track.uri));

    if (!fresh) {
      // Pool agotado: emitimos hueco para este segmento y avanzamos un slot
      // (60 s). No repetimos: la regla es cero duplicados en la playlist.
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      i++;
      continue;
    }

    used.add(fresh.track.uri);

    out.push({
      ...seg,
      track: fresh.track,
      matchScore: fresh.score,
      matchQuality: quality,
    });

    const trackDurationSec = Math.max(1, fresh.track.durationMs / 1000);
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
 * Regla cero repeticiones: el Set 'used' es global a la playlist (no por
 * zona), asi que un mismo track no puede aparecer en dos bloques distintos
 * aunque sean de la misma zona.
 */
function matchDiscrete(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const used = new Set<string>();
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

    let coveredSec = 0;
    while (coveredSec < seg.durationSec) {
      const fresh = scored.find((c) => !used.has(c.track.uri));

      if (!fresh) {
        // Pool agotado para esta zona dentro del bloque: emitimos un hueco
        // con la duracion restante y cerramos el bloque. La UI pre-check
        // deberia haber evitado llegar aqui.
        const remainingSec = seg.durationSec - coveredSec;
        out.push({
          ...seg,
          startSec: seg.startSec + coveredSec,
          durationSec: remainingSec,
          track: null,
          matchScore: 0,
          matchQuality: 'insufficient',
        });
        break;
      }

      used.add(fresh.track.uri);

      const trackDurationSec = Math.max(1, fresh.track.durationMs / 1000);
      const remainingSec = seg.durationSec - coveredSec;
      const slotSec = Math.min(trackDurationSec, remainingSec);

      out.push({
        ...seg,
        startSec: seg.startSec + coveredSec,
        durationSec: slotSec,
        track: fresh.track,
        matchScore: fresh.score,
        matchQuality: quality,
      });

      // Avanzamos por la duracion REAL del track (no acotada). Si el track
      // dura mas que el bloque, igualmente cerramos el bloque aqui — el
      // siguiente bloque empezara con su propio track.
      coveredSec += trackDurationSec;
    }
  }

  return out;
}
