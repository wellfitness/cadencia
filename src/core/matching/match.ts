import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import { hashSeed, mulberry32, pickWeightedFromTopK } from './random';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchedSegment, ZoneMusicCriteria } from './types';
import {
  applyAllEnergetic,
  getZoneCriteria,
  getAlternativeBpmRange,
  getPrimaryCadenceMax,
} from './zoneCriteria';

/** Tamaño del top-K para el sampling ponderado cuando hay seed. */
const RANDOM_TOP_K = 5;

/**
 * Distancia maxima en BPM al midpoint mas cercano (1:1 o alternativa) que se
 * tolera al caer al pool best-effort cross-zone. Si el unico track libre tiene
 * tempoBpm a mas de este margen del rango natural de la zona, lo descartamos
 * y la UI marca el slot como 'repeated' (mejor un track conocido repetido que
 * Z1 con 220 BPM hardcore o Z6 con 60 BPM balada).
 */
const BEST_EFFORT_BPM_TOLERANCE = 30;

/**
 * Distancia minima del tempoBpm al rango {1:1, alternativa} de la criteria.
 * Si el track encaja en alguno de los dos rangos devuelve 0. Si no, devuelve
 * los BPM que faltan para alcanzar el rango mas cercano.
 */
function bpmDistanceToCriteria(tempoBpm: number, criteria: ZoneMusicCriteria): number {
  // El techo del 1:1 usa el ensanche de recuperacion (Z1/Z2 → 110) si existe.
  const primaryMax = getPrimaryCadenceMax(criteria);
  const inOne = tempoBpm >= criteria.cadenceMin && tempoBpm <= primaryMax;
  if (inOne) return 0;
  const alt = getAlternativeBpmRange(criteria);
  const inAlt = tempoBpm >= alt.min && tempoBpm <= alt.max;
  if (inAlt) return 0;
  const distOne = tempoBpm < criteria.cadenceMin
    ? criteria.cadenceMin - tempoBpm
    : tempoBpm - primaryMax;
  const distAlt = tempoBpm < alt.min ? alt.min - tempoBpm : tempoBpm - alt.max;
  return Math.min(distOne, distAlt);
}

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
  usageCount: ReadonlyMap<string, number>,
  seed: number | undefined,
  slotIndex: number,
): ChoiceResult | null {
  // 1. Strict: cadencia OK + no usado.
  //    - Sin seed: el primero (top-1) del ranking, comportamiento legacy.
  //    - Con seed: weighted sampling entre los top-K frescos. Misma semilla
  //      reproduce la misma eleccion gracias a hashSeed(seed, slotIndex).
  const freshCandidates = scoredCadenceCandidates.filter((c) => !used.has(c.track.uri));
  if (freshCandidates.length > 0) {
    if (seed === undefined) {
      const top = freshCandidates[0]!;
      return { track: top.track, score: top.score, quality: cadenceQuality };
    }
    const prng = mulberry32(hashSeed(seed, slotIndex));
    const pick = pickWeightedFromTopK(freshCandidates, prng, RANDOM_TOP_K);
    if (pick) {
      return { track: pick.track, score: pick.score, quality: cadenceQuality };
    }
  }

  // 2. Best-effort cross-zone: cualquier track no usado, aunque cadencia no
  //    encaje exactamente. Aplicamos un FLOOR de tolerancia BPM: si el "mejor"
  //    candidato libre esta a >30 BPM del rango de la zona (ej. Z1 ideal 70-90
  //    o 140-180 BPM, track 220 BPM esta a 40 fuera), preferimos repetir un
  //    track conocido del ranking de cadencia antes que asignar algo
  //    musicalmente absurdo. La UI sigue marcandolo 'best-effort' o 'repeated'
  //    para que el usuario sepa que mejorara subiendo mas listas.
  const allFresh = allTracks.filter((t) => !used.has(t.uri));
  if (allFresh.length > 0) {
    const ranked = allFresh
      .map((t) => ({
        track: t,
        score: scoreTrack(t, effectiveCriteria, preferredGenres),
        bpmDistance: bpmDistanceToCriteria(t.tempoBpm, effectiveCriteria),
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0]!;
    if (best.bpmDistance <= BEST_EFFORT_BPM_TOLERANCE) {
      return { track: best.track, score: best.score, quality: 'best-effort' };
    }
    // El mejor candidato libre esta demasiado lejos: caer a 'repeated'.
  }

  // 3. Repeated: catalogo entero usado o todos los frescos cayeron del floor.
  //    Las repeticiones son INEVITABLES aqui, asi que las REPARTIMOS en vez de
  //    machacar siempre el top-1: elegimos el candidato de cadencia MENOS
  //    emitido hasta ahora (round-robin determinista). Antes se devolvia
  //    scoredCadenceCandidates[0] incondicional y una sola cancion (la de mayor
  //    score) absorbia todas las repeticiones de la zona ("Roxette x14"). Ahora
  //    cada copia inevitable cae en el track menos repetido.
  //
  //    Desempate (orden total, 100% determinista, sin seed): a igualdad de
  //    usos gana el de mayor score; como scoredCadenceCandidates ya viene
  //    ordenado por score desc, recorrerlo y quedarnos con el PRIMERO de menor
  //    uso da exactamente "menor uso → mayor score → orden estable original".
  let best: { track: Track; score: number } | null = null;
  let bestUses = Number.POSITIVE_INFINITY;
  for (const candidate of scoredCadenceCandidates) {
    const uses = usageCount.get(candidate.track.uri) ?? 0;
    if (uses < bestUses) {
      best = candidate;
      bestUses = uses;
    }
  }
  if (best) {
    return { track: best.track, score: best.score, quality: 'repeated' };
  }
  // Defensivo e inalcanzable en la práctica: los callers cortan antes si
  // `tracks` está vacío y findCandidates siempre devuelve >= 1 candidato con
  // catálogo no vacío, así que el bucle de arriba siempre asigna `best`.
  // Presente solo para satisfacer el tipo (`best` parte de null).
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
  // Cuantas veces se ha EMITIDO cada URI. `used` (booleano) sirve a las reglas
  // 1-2 (no repetir mientras quede algo fresco); `usageCount` solo lo consulta
  // la regla 3 para repartir las repeticiones inevitables (menos usado primero).
  const usageCount = new Map<string, number>();
  const out: MatchedSegment[] = [];
  // slotIndex monotonico: cada chooseTrack consume una sub-semilla distinta.
  // No es lo mismo que `i` porque en overlap un track tapa varios segmentos.
  let slotIndex = 0;

  let i = 0;
  while (i < segments.length) {
    const seg = segments[i]!;
    const baseCriteria = getZoneCriteria(seg.zone, seg.cadenceProfile, seg.sport);
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
      usageCount,
      preferences.seed,
      slotIndex,
    );
    slotIndex++;

    if (!choice) {
      out.push({ ...seg, track: null, matchScore: 0, matchQuality: 'insufficient' });
      i++;
      continue;
    }

    used.add(choice.track.uri);
    usageCount.set(choice.track.uri, (usageCount.get(choice.track.uri) ?? 0) + 1);

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
  // Ver nota en matchOverlap: `usageCount` reparte las repeticiones (regla 3).
  const usageCount = new Map<string, number>();
  const out: MatchedSegment[] = [];
  let slotIndex = 0;

  for (const seg of segments) {
    const baseCriteria = getZoneCriteria(seg.zone, seg.cadenceProfile, seg.sport);
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
        usageCount,
        preferences.seed,
        slotIndex,
      );
      slotIndex++;
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
      usageCount.set(choice.track.uri, (usageCount.get(choice.track.uri) ?? 0) + 1);

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

/**
 * Resumen de calidad de una playlist ya casada. Fuente UNICA de verdad para
 * los avisos: tanto el paso «Música» (preview) como el paso «Resultado» lo
 * consumen, asi que ambos cuentan EXACTAMENTE lo mismo y nunca se
 * desincronizan (no mas «sorpresa después»: lo que se avisa en Música es lo
 * que aparece en Resultado).
 *
 * Funcion pura y determinista: misma `matched` → mismo resumen.
 */
export interface RepetitionSummary {
  /** Slots marcados 'repeated' = apariciones de MÁS (2ª, 3ª… vez de una canción). */
  repeatedSlots: number;
  /**
   * Canciones DISTINTAS que se repiten (URIs únicos con al menos un slot
   * 'repeated'). Es la cifra honesta para el copy: «N canciones se repiten»,
   * NO el número de apariciones (que es repeatedSlots).
   */
  repeatedDistinct: number;
  /** Slots cubiertos con un track fuera de la cadencia ideal de la zona. */
  bestEffortSlots: number;
  /** Slots sin canción (track === null): el catálogo no cubre esa zona. */
  insufficientSlots: number;
}

export function summarizeRepetitions(
  matched: readonly MatchedSegment[],
): RepetitionSummary {
  let repeatedSlots = 0;
  let bestEffortSlots = 0;
  let insufficientSlots = 0;
  const repeatedUris = new Set<string>();
  for (const m of matched) {
    switch (m.matchQuality) {
      case 'repeated':
        repeatedSlots++;
        if (m.track) repeatedUris.add(m.track.uri);
        break;
      case 'best-effort':
        bestEffortSlots++;
        break;
      case 'insufficient':
        insufficientSlots++;
        break;
      case 'strict':
        // El caso "bueno": no se cuenta. Se lista explícito para que el
        // exhaustiveness check de abajo obligue a revisar este switch si
        // MatchQuality crece con un nuevo miembro.
        break;
      default: {
        const _exhaustive: never = m.matchQuality;
        void _exhaustive;
      }
    }
  }
  return {
    repeatedSlots,
    repeatedDistinct: repeatedUris.size,
    bestEffortSlots,
    insufficientSlots,
  };
}
