import allRaw from '@data/tracks/all.csv?raw';
import { parseTrackCsv } from './parser';
import type { Track } from './types';

let cached: Track[] | null = null;

/**
 * Carga el catalogo nativo unificado (`src/data/tracks/all.csv`), pre-dedupado
 * y depurado de huerfanos (tracks que no encajan en ninguna cadencia) por el
 * script `scripts/build-tracks.mjs`. Cacheado a nivel modulo: solo se ejecuta
 * una vez por sesion del navegador.
 *
 * Para regenerar el catalogo tras añadir/quitar listas en
 * `src/data/tracks/sources/`, ejecutar `pnpm build:tracks`.
 */
export function loadNativeTracks(): Track[] {
  if (cached !== null) return cached;
  cached = parseTrackCsv(allRaw);
  return cached;
}

/**
 * Combina varios arrays de tracks deduplicando por URI. Mantiene la primera
 * ocurrencia (first-wins). Util para mergear el catalogo nativo con CSVs
 * subidos por el usuario en runtime.
 */
export function dedupeByUri(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (!seen.has(t.uri)) {
      seen.add(t.uri);
      out.push(t);
    }
  }
  return out;
}

/** Solo para tests: limpia la cache forzando que la siguiente llamada relea el CSV. */
export function _resetCacheForTests(): void {
  cached = null;
}
