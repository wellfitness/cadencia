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
