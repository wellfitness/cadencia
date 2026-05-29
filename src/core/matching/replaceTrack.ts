import type { Track } from '../tracks/types';
import { passesCadenceFilter } from './candidates';
import { scoreTrack } from './score';
import type { MatchPreferences, MatchQuality, MatchedSegment, ZoneMusicCriteria } from './types';
import { applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

export interface ReplaceResult {
  /** Lista de matched con la fila reemplazada. Si no hay alternativa, devuelve la lista igual. */
  matched: MatchedSegment[];
  /** True si se reemplazo realmente (false si no habia alternativa). */
  replaced: boolean;
}

export interface MoveResult {
  /** Lista de matched tras mover + rellenar. Si no se movio, la lista igual. */
  matched: MatchedSegment[];
  /** True si se movio realmente. */
  moved: boolean;
  /** Indices modificados `[targetIndex, sourceIndex]` cuando moved=true; `[]` si no. */
  changedIndices: number[];
}

/**
 * Una alternativa rankeada para un slot de la playlist. La UI usa esta forma
 * para mostrar el listado en el dropdown "Otro tema".
 */
export interface AlternativeCandidate {
  track: Track;
  score: number;
  /**
   * Si el track encaja en cadencia (1:1 ∪ 2:1) para la zona del slot. En la
   * lista por defecto todos seran true (solo strict). En el fallback (cuando
   * no hay strict libres) todos seran false. Permite a la UI mostrar un aviso
   * cuando el dropdown opera en modo fallback.
   */
  passesCadence: boolean;
  /**
   * Tramo (indice 0-based en `matched`) donde esta cancion ya esta colocada, o
   * null si esta libre. La UI muestra `usedAtIndex + 1` como "en tu lista ·
   * tramo N" y, al elegirla, MUEVE la cancion a este slot rellenando el origen.
   * Las usadas se excluyen de "Aleatorio" para no duplicar.
   */
  usedAtIndex: number | null;
}

interface RankedCandidatesBag {
  ranked: AlternativeCandidate[];
  /**
   * Criteria efectiva (zona + profile + allEnergetic) usada al rankear. Se
   * propaga para que `replaceTrackInSegment` calcule la matchQuality correcta
   * del track elegido (strict si pasa cadencia, best-effort si no).
   */
  criteria: ZoneMusicCriteria;
}

/**
 * Calcula el ranking de candidatos **libres** para sustituir el track en
 * `index`, excluyendo TODAS las URIs ya presentes en `matched` (incluida la
 * del propio segmento). Es la politica "solo-libres": nunca devuelve una
 * cancion ya en uso, asi que jamas duplica. Pure helper compartido por:
 *  - `replaceTrackInSegment` (sustitucion concreta).
 *  - el relleno del origen en `moveTrackToSegment`.
 *
 * NO la usa `getAlternativesForSegment` (el dropdown): ese SI muestra las
 * usadas, marcadas, para permitir moverlas — ver su implementacion.
 *
 * Devuelve `null` si el index esta fuera de rango. Devuelve `ranked: []`
 * cuando no hay candidatos en el catalogo o todos estan ya en uso. Todas las
 * candidatas llevan `usedAtIndex: null` por construccion (son libres).
 */
function rankAvailableCandidates(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): RankedCandidatesBag | null {
  const target = matched[index];
  if (!target) return null;

  const baseCriteria = getZoneCriteria(target.zone, target.cadenceProfile, target.sport);
  const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);

  // URIs prohibidas: TODAS las que ya estan en la playlist (no solo vecinos).
  // El segmento que estamos reemplazando se incluye explicitamente para que
  // el ranking nunca devuelva el mismo track.
  const forbidden = new Set<string>();
  for (const m of matched) {
    if (m.track) forbidden.add(m.track.uri);
  }

  const free = tracks.filter((t) => !forbidden.has(t.uri));
  const score = (t: Track): number =>
    scoreTrack(t, effective, preferences.preferredGenres);

  // Por defecto el dropdown ofrece SOLO los tracks que pasan filtro de
  // cadencia (1:1 ∪ 2:1). Es lo que el usuario espera: alternativas con
  // calidad equivalente a la asignacion automatica del motor.
  const strictRanked: AlternativeCandidate[] = free
    .filter((t) => passesCadenceFilter(t.tempoBpm, effective))
    .map((t) => ({ track: t, score: score(t), passesCadence: true, usedAtIndex: null }))
    .sort((a, b) => b.score - a.score);

  if (strictRanked.length > 0) {
    return { ranked: strictRanked, criteria: effective };
  }

  // Fallback: NO queda ningun track strict libre (o el catalogo no tiene
  // ninguno para esta zona). Damos al usuario el resto del catalogo no
  // usado, ordenado por score, para que NUNCA se quede sin alternativas.
  // Estos tracks no encajan en cadencia: el slot resultante se marcara
  // 'best-effort' al sustituir.
  const fallbackRanked: AlternativeCandidate[] = free
    .map((t) => ({
      track: t,
      score: score(t),
      passesCadence: passesCadenceFilter(t.tempoBpm, effective),
      usedAtIndex: null,
    }))
    .sort((a, b) => b.score - a.score);

  return { ranked: fallbackRanked, criteria: effective };
}

/**
 * Devuelve las alternativas para el dropdown "Otro tema" del segmento `index`.
 * A diferencia de `rankAvailableCandidates`, esta SI incluye las canciones ya
 * usadas en otros tramos, marcadas con `usedAtIndex`, para que el usuario pueda
 * MOVERLAS a este slot. Solo excluye la cancion del PROPIO tramo (no tiene
 * sentido "sustituir por la misma").
 *
 * Composicion (frescas primero, luego usadas):
 *  - Seccion fresca: las libres que pasan cadencia (strict). Si no hay ninguna
 *    fresca strict, cae al resto de frescas (best-effort) para no dejar al
 *    usuario sin opcion "sin cascada".
 *  - Seccion usadas: las ya colocadas en OTRO tramo que ADEMAS encajan aqui
 *    (pasan cadencia). Mover una que no encaja crearia best-effort + cascada,
 *    asi que solo ofrecemos las que encajan.
 *
 * Funcion pura: misma entrada -> misma salida. Devuelve `[]` cuando el indice
 * es invalido o no hay ninguna candidata.
 */
export function getAlternativesForSegment(
  matched: readonly MatchedSegment[],
  index: number,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): AlternativeCandidate[] {
  const target = matched[index];
  if (!target) return [];

  const baseCriteria = getZoneCriteria(target.zone, target.cadenceProfile, target.sport);
  const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
  const ownUri = target.track?.uri;

  // Mapa uri -> primer tramo donde aparece (para marcar usedAtIndex).
  const usedIndexByUri = new Map<string, number>();
  matched.forEach((m, i) => {
    if (m.track && !usedIndexByUri.has(m.track.uri)) usedIndexByUri.set(m.track.uri, i);
  });

  const score = (t: Track): number => scoreTrack(t, effective, preferences.preferredGenres);
  const toAlt = (t: Track): AlternativeCandidate => ({
    track: t,
    score: score(t),
    passesCadence: passesCadenceFilter(t.tempoBpm, effective),
    usedAtIndex: usedIndexByUri.get(t.uri) ?? null,
  });

  // Candidatos = catalogo salvo la cancion del propio tramo.
  const candidates = tracks.filter((t) => t.uri !== ownUri);
  const fresh = candidates.filter((t) => !usedIndexByUri.has(t.uri));
  const used = candidates.filter((t) => usedIndexByUri.has(t.uri));

  const freshStrict = fresh.filter((t) => passesCadenceFilter(t.tempoBpm, effective));
  // Seccion fresca: strict si las hay; si no, todas las frescas (best-effort).
  const freshSection = freshStrict.length > 0 ? freshStrict : fresh;
  // Seccion usadas: solo las que encajan aqui (mover con sentido).
  const usedSection = used.filter((t) => passesCadenceFilter(t.tempoBpm, effective));

  const freshAlts = freshSection.map(toAlt).sort((a, b) => b.score - a.score);
  const usedAlts = usedSection.map(toAlt).sort((a, b) => b.score - a.score);
  return [...freshAlts, ...usedAlts];
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

  // La calidad del nuevo slot la determina el track elegido individualmente:
  // 'strict' si pasa filtro de cadencia (1:1 ∪ 2:1) para la zona del slot,
  // 'best-effort' si no encaja. No reusamos la quality del bag — esa era una
  // propiedad del catalogo/agotamiento, no del track concreto que sale.
  const newQuality: MatchQuality = passesCadenceFilter(next.track.tempoBpm, bag.criteria)
    ? 'strict'
    : 'best-effort';

  return {
    matched: matched.map((m, i) =>
      i === index
        ? { ...m, track: next.track, matchScore: next.score, matchQuality: newQuality }
        : m,
    ),
    replaced: true,
  };
}

/**
 * Mueve la cancion `sourceUri` (que ya esta en algun tramo) al tramo `targetIndex`
 * y RELLENA el tramo de origen con la mejor alternativa libre. Pensado para
 * "cambiar de posicion" desde el dropdown "Otro tema" cuando el usuario elige
 * una cancion marcada como ya usada.
 *
 * Garantia "cero repeticiones": tras mover, `sourceUri` aparece una sola vez
 * (en el target) y el relleno se elige con `rankAvailableCandidates`, que
 * prohibe todas las URIs en uso. La cancion desplazada del target queda libre
 * y el relleno PUEDE reutilizarla si es la mejor para el origen — degradando de
 * forma natural a un intercambio cuando eso es lo optimo, sin duplicar nunca.
 *
 * Funcion pura: misma entrada -> misma salida (el relleno es determinista).
 *
 * Casos `moved=false` (lista sin cambios): `targetIndex` fuera de rango,
 * `sourceUri` no presente en `matched`, o origen == destino.
 */
export function moveTrackToSegment(
  matched: readonly MatchedSegment[],
  targetIndex: number,
  sourceUri: string,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MoveResult {
  const target = matched[targetIndex];
  if (!target) return { matched: [...matched], moved: false, changedIndices: [] };

  const sourceIndex = matched.findIndex((m) => m.track?.uri === sourceUri);
  if (sourceIndex === -1 || sourceIndex === targetIndex) {
    return { matched: [...matched], moved: false, changedIndices: [] };
  }
  const sourceTrack = matched[sourceIndex]!.track!; // existe: lo localizamos por uri

  // 1. Colocar la cancion movida en el target, recomputando su calidad para la
  //    zona del target (strict si encaja, best-effort si no).
  const targetCriteria = applyAllEnergetic(
    getZoneCriteria(target.zone, target.cadenceProfile, target.sport),
    preferences.allEnergetic,
  );
  const targetQuality: MatchQuality = passesCadenceFilter(sourceTrack.tempoBpm, targetCriteria)
    ? 'strict'
    : 'best-effort';
  const targetScore = scoreTrack(sourceTrack, targetCriteria, preferences.preferredGenres);

  const intermediate = matched.map((m, i) =>
    i === targetIndex
      ? { ...m, track: sourceTrack, matchScore: targetScore, matchQuality: targetQuality }
      : m,
  );

  // 2. Rellenar el origen con la mejor alternativa LIBRE. rankAvailableCandidates
  //    prohibe todas las URIs presentes en `intermediate` (incluida sourceUri,
  //    ya en el target) → nunca duplica. La cancion que estaba en el target ya
  //    no aparece en `intermediate`, asi que es elegible como relleno.
  const sourceSeg = matched[sourceIndex]!;
  const bag = rankAvailableCandidates(intermediate, sourceIndex, tracks, preferences);
  let filled: MatchedSegment;
  if (bag && bag.ranked.length > 0) {
    const pick = bag.ranked[0]!;
    const quality: MatchQuality = passesCadenceFilter(pick.track.tempoBpm, bag.criteria)
      ? 'strict'
      : 'best-effort';
    filled = { ...sourceSeg, track: pick.track, matchScore: pick.score, matchQuality: quality };
  } else {
    // No queda nada libre para el origen: queda sin cancion (la UI ya pinta ese
    // estado con CTA "Subir mas temas").
    filled = { ...sourceSeg, track: null, matchScore: 0, matchQuality: 'insufficient' };
  }

  const result = intermediate.map((m, i) => (i === sourceIndex ? filled : m));
  return { matched: result, moved: true, changedIndices: [targetIndex, sourceIndex] };
}
