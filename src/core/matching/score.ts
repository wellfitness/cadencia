import type { Track } from '../tracks/types';
import type { ZoneMusicCriteria } from './types';

const W_GENRE = 0.5;
const W_BPM = 0.3;
const W_ENERGY = 0.2;

const NEUTRAL_GENRE_SCORE = 0.5; // sin preferencias o catalogo sin generos = neutro

/**
 * Calcula la puntuacion [0..1] de un track para una zona dada y las preferencias
 * de genero del usuario. Determinista: misma entrada -> misma salida.
 *
 * Pesos segun CLAUDE.md "Algoritmo de matching":
 *   score = 0.5 * match_genero + 0.3 * ajuste_BPM + 0.2 * energy
 *
 * Componentes:
 *  - match_genero: 1 si algun genero del track esta en preferredGenres,
 *                  NEUTRAL_GENRE_SCORE si la lista de preferidos esta vacia,
 *                  0 si tiene generos pero no matchean.
 *  - ajuste_BPM:   1 cuando el tempo coincide con el midpoint de la zona,
 *                  decrece linealmente hasta 0 en los bordes (bpmMin/bpmMax),
 *                  0 fuera del rango (los filtros previos descartan estos
 *                  tracks en matching estricto, pero best-effort si los puede
 *                  scorar fuera de rango).
 *  - energy:       el propio energy del track (0..1).
 */
export function scoreTrack(
  track: Track,
  criteria: ZoneMusicCriteria,
  preferredGenres: readonly string[],
): number {
  const genreScore =
    preferredGenres.length === 0
      ? NEUTRAL_GENRE_SCORE
      : track.genres.some((g) => preferredGenres.includes(g))
        ? 1
        : 0;

  const midpoint = (criteria.bpmMin + criteria.bpmMax) / 2;
  const halfRange = (criteria.bpmMax - criteria.bpmMin) / 2;
  const distance = Math.abs(track.tempoBpm - midpoint);
  const bpmScore = halfRange > 0 ? Math.max(0, 1 - distance / halfRange) : 0;

  const energyScore = Math.max(0, Math.min(1, track.energy));

  return W_GENRE * genreScore + W_BPM * bpmScore + W_ENERGY * energyScore;
}
