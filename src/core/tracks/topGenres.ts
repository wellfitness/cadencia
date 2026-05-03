import { categorizeTag, MACRO_GENRES, type MacroGenreId } from './genreCategories';
import type { Track } from './types';

export interface GenreCount {
  genre: string;
  count: number;
}

/**
 * Devuelve los generos mas frecuentes del catalogo, ordenados desc por
 * numero de tracks que los contienen. Limit acota el resultado.
 *
 * Cada track puede tener varios generos; cada uno cuenta una vez por track.
 *
 * @deprecated En la UI usar `getTopMacroGenres` para presentar al usuario
 * un panel limpio con etiquetas legibles. Esta funcion sigue disponible
 * para diagnostico interno y compatibilidad.
 */
export function getTopGenres(tracks: readonly Track[], limit = 12): GenreCount[] {
  const counts = new Map<string, number>();
  for (const t of tracks) {
    for (const g of t.genres) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, limit);
}

/** Conteo por macro-categoria con su label legible. */
export interface MacroGenreCount {
  id: MacroGenreId;
  label: string;
  count: number;
}

/**
 * Devuelve los macros mas frecuentes del catalogo, ordenados desc por
 * numero de tracks unicos que pertenecen a ese macro.
 *
 * Un track con multiples tags del mismo macro (ej. ['rock', 'rock clasico'])
 * cuenta UNA vez en ese macro. Un track con tags de macros distintos
 * (ej. ['country rock', 'rock clasico']) sigue contando UNA vez en cada
 * macro al que pertenezcan sus tags — solo afecta cuando los macros son
 * diferentes (lo cual ya no pasa porque los tags son disjuntos).
 *
 * Tags no clasificados se ignoran silenciosamente.
 */
export function getTopMacroGenres(
  tracks: readonly Track[],
  limit: number = MACRO_GENRES.length,
): MacroGenreCount[] {
  const counts = new Map<MacroGenreId, number>();
  for (const t of tracks) {
    const seenMacros = new Set<MacroGenreId>();
    for (const g of t.genres) {
      const macro = categorizeTag(g);
      if (macro !== null && !seenMacros.has(macro)) {
        seenMacros.add(macro);
        counts.set(macro, (counts.get(macro) ?? 0) + 1);
      }
    }
  }
  // Stable order: por count desc, luego por orden de declaracion de
  // MACRO_GENRES (para tiebreaks deterministas).
  const declarationOrder = new Map(MACRO_GENRES.map((m, i) => [m.id, i]));
  return MACRO_GENRES.map((m) => ({
    id: m.id,
    label: m.label,
    count: counts.get(m.id) ?? 0,
  }))
    .filter((m) => m.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        (declarationOrder.get(a.id) ?? 0) - (declarationOrder.get(b.id) ?? 0),
    )
    .slice(0, limit);
}
