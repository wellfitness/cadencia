import cinelliRaw from '@data/tracks/cinelli_rider.csv?raw';
import mixAlegreRaw from '@data/tracks/mix_alegre.csv?raw';
import trainingPeaksRaw from '@data/tracks/trainingpeaks_virtual.csv?raw';
import { parseTrackCsv } from './parser';
import type { Track } from './types';

let cached: Track[] | null = null;

/**
 * Carga los 3 CSVs nativos de Spotify, los parsea y deduplica por URI
 * (manteniendo la primera ocurrencia). Cacheado a nivel modulo: solo se
 * ejecuta una vez por sesion del navegador.
 */
export function loadNativeTracks(): Track[] {
  if (cached !== null) return cached;
  const all: Track[] = [
    ...parseTrackCsv(cinelliRaw, 'cinelli_rider'),
    ...parseTrackCsv(mixAlegreRaw, 'mix_alegre'),
    ...parseTrackCsv(trainingPeaksRaw, 'trainingpeaks_virtual'),
  ];
  cached = dedupeByUri(all);
  return cached;
}

/**
 * Combina varios arrays de tracks deduplicando por URI. Mantiene la primera
 * ocurrencia (first-wins). Util tambien para fase 5 cuando el usuario
 * pueda subir CSVs adicionales.
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

/** Solo para tests: limpia la cache forzando que la siguiente llamada relea los CSVs. */
export function _resetCacheForTests(): void {
  cached = null;
}
