import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment } from './types';
import { applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

/**
 * Modo de asignacion de tracks frente a la estructura de zonas:
 * - 'overlap' (default, GPX): un track cubre los siguientes segmentos
 *   consecutivos hasta agotar su duracion, AUNQUE cambien de zona.
 * - 'discrete' (sesion indoor): cada segmento es una unidad atomica.
 */
export type CrossZoneMode = 'overlap' | 'discrete';

export interface MatchOptions {
  crossZoneMode?: CrossZoneMode;
}

/**
 * Asigna canciones a la ruta segun los criterios de zona y las preferencias
 * del usuario. Determinista: misma entrada -> misma salida.
 *
 * Politica de repetición: el motor PREFIERE no repetir, pero si el pool se
 * agota antes de cubrir todos los segmentos, **repite el mejor track ya
 * usado** en lugar de dejar huecos. La playlist nunca queda incompleta.
 * El track repetido lleva matchQuality='repeated' para que la UI lo señale
 * y el usuario sepa que subiendo más listas mejorará la variedad.
 *
 * Solo emite track=null cuando literalmente no hay candidatos para una
 * zona (catalogo vacio para esa cadencia).
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
    const baseCriteria = getZoneCriteria(seg.zone, seg.cadenceProfile);
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    const { candidates, quality } = findCandidates(tracks, effective);

    if (candidates.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      i++;
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    const fresh = scored.find((c) => !used.has(c.track.uri));
    // Si no hay fresh, repetimos el mejor (scored[0]) marcandolo como 'repeated'.
    const choice = fresh ?? scored[0]!;
    const isRepeat = !fresh;

    used.add(choice.track.uri);

    out.push({
      ...seg,
      track: choice.track,
      matchScore: choice.score,
      matchQuality: isRepeat ? 'repeated' : quality,
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
 * Algoritmo discrete (sesion indoor): cada segmento es atomico. Cubre su
 * duracion con tantos tracks como haga falta, todos de SU zona/profile.
 *
 * Politica de repetición igual que overlap: prefiere fresh, pero si el pool
 * se agota dentro de un bloque largo, repite el mejor en lugar de dejar
 * hueco.
 */
function matchDiscrete(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MatchedSegment[] {
  const used = new Set<string>();
  const out: MatchedSegment[] = [];

  for (const seg of segments) {
    const baseCriteria = getZoneCriteria(seg.zone, seg.cadenceProfile);
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    const { candidates, quality } = findCandidates(tracks, effective);

    if (candidates.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    let coveredSec = 0;
    while (coveredSec < seg.durationSec) {
      const fresh = scored.find((c) => !used.has(c.track.uri));
      const choice = fresh ?? scored[0]!;
      const isRepeat = !fresh;

      used.add(choice.track.uri);

      const trackDurationSec = Math.max(1, choice.track.durationMs / 1000);
      const remainingSec = seg.durationSec - coveredSec;
      const slotSec = Math.min(trackDurationSec, remainingSec);

      out.push({
        ...seg,
        startSec: seg.startSec + coveredSec,
        durationSec: slotSec,
        track: choice.track,
        matchScore: choice.score,
        matchQuality: isRepeat ? 'repeated' : quality,
      });

      coveredSec += trackDurationSec;
    }
  }

  return out;
}
