import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment, ZoneMusicCriteria } from './types';
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

interface ChoiceResult {
  track: Track;
  score: number;
  /**
   * Calidad de la asignacion:
   *  - 'strict' / 'best-effort': el devuelto por findCandidates dentro del
   *    pool que pasa cadencia.
   *  - 'best-effort' (override): cuando se cae al catalogo entero porque
   *    no quedan tracks frescos con cadencia adecuada.
   *  - 'repeated': cuando absolutamente todos los tracks ya estan usados.
   */
  quality: MatchedSegment['matchQuality'];
}

/**
 * Politica de seleccion de track con prioridad:
 *   1. **strict**: candidato con cadencia OK que NO esta en `used`.
 *   2. **best-effort cross-zone**: si todos los strict ya estan usados,
 *      buscar CUALQUIER track del catalogo no usado, ordenado por score
 *      respecto al criteria del segmento. La cadencia puede no encajar,
 *      pero el track sigue siendo "novedoso" en la playlist.
 *   3. **repeated**: ultimo recurso. Solo cuando TODO el catalogo ha sido
 *      usado en la playlist. Devuelve el mejor del ranking de cadencia.
 *
 * Esto garantiza que NUNCA se repita una cancion mientras quede una
 * alternativa fresca, aunque su cadencia no sea ideal. La UI marca los
 * 'best-effort' y 'repeated' para que el usuario suba mas listas.
 */
function chooseTrack(
  scoredCadenceCandidates: readonly { track: Track; score: number }[],
  cadenceQuality: MatchedSegment['matchQuality'],
  effectiveCriteria: ZoneMusicCriteria,
  preferredGenres: readonly string[],
  allTracks: readonly Track[],
  used: ReadonlySet<string>,
): ChoiceResult | null {
  // 1. Strict: cadencia OK + no usado.
  const fresh = scoredCadenceCandidates.find((c) => !used.has(c.track.uri));
  if (fresh) {
    return { track: fresh.track, score: fresh.score, quality: cadenceQuality };
  }

  // 2. Best-effort cross-zone: cualquier track no usado, aunque cadencia no encaje.
  const allFresh = allTracks.filter((t) => !used.has(t.uri));
  if (allFresh.length > 0) {
    const ranked = allFresh
      .map((t) => ({ track: t, score: scoreTrack(t, effectiveCriteria, preferredGenres) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0]!;
    return { track: best.track, score: best.score, quality: 'best-effort' };
  }

  // 3. Repeated: catalogo entero usado. Devolvemos el mejor del ranking
  //    original (puede ser null si el ranking estaba vacio, pero entonces
  //    allTracks tampoco tendría tracks usables — caso degenerado).
  const fallback = scoredCadenceCandidates[0];
  if (fallback) {
    return { track: fallback.track, score: fallback.score, quality: 'repeated' };
  }
  return null;
}

/**
 * Asigna canciones a la ruta segun los criterios de zona y las preferencias
 * del usuario. Determinista: misma entrada -> misma salida.
 *
 * Solo emite `track: null` con `matchQuality: 'insufficient'` cuando el
 * catalogo esta literalmente vacio.
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

    if (tracks.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      i++;
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    const choice = chooseTrack(
      scored,
      quality,
      effective,
      preferences.preferredGenres,
      tracks,
      used,
    );

    if (!choice) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      i++;
      continue;
    }

    used.add(choice.track.uri);

    out.push({
      ...seg,
      track: choice.track,
      matchScore: choice.score,
      matchQuality: choice.quality,
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

    if (tracks.length === 0) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      continue;
    }

    const scored = candidates
      .map((t) => ({ track: t, score: scoreTrack(t, effective, preferences.preferredGenres) }))
      .sort((a, b) => b.score - a.score);

    let coveredSec = 0;
    while (coveredSec < seg.durationSec) {
      const choice = chooseTrack(
        scored,
        quality,
        effective,
        preferences.preferredGenres,
        tracks,
        used,
      );
      if (!choice) {
        out.push({
          ...seg,
          startSec: seg.startSec + coveredSec,
          durationSec: seg.durationSec - coveredSec,
          track: null,
          matchScore: 0,
          matchQuality: 'insufficient',
        });
        break;
      }

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
        matchQuality: choice.quality,
      });

      coveredSec += trackDurationSec;
    }
  }

  return out;
}
