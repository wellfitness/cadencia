import type { Track } from '../tracks/types';
import type { ZoneMusicCriteria } from './types';
import { getAlternativeBpmRange } from './zoneCriteria';

/**
 * Pesos del score. Todos suman 1.00. Cadencia y energy son los factores
 * principales (pedaleo y intensidad sonora). Valence (positividad emocional)
 * y genero preferido son discriminadores secundarios.
 */
const W_CADENCE = 0.3;
const W_ENERGY = 0.3;
const W_VALENCE = 0.2;
const W_GENRE = 0.2;

const NEUTRAL_GENRE_SCORE = 0.5; // sin preferencias o catalogo sin generos

/**
 * Bonus aditivo cuando el track viene del CSV subido por el usuario
 * (`source === 'user'`). Sube ligeramente la probabilidad de que las canciones
 * propias ganen el slot frente a tracks predefinidos con score similar, sin
 * pisar tracks predefinidos claramente mejores. Equivale a ~0.4 puntos de
 * componente individual (cada componente pesa 0.20-0.30). El score puede
 * superar 1.0; el motor solo usa el orden, no el valor absoluto.
 */
const USER_SOURCE_BONUS = 0.08;

/**
 * Calcula la puntuacion de un track para una (zona, profile) dada y las
 * preferencias de genero del usuario. Determinista.
 *
 * Rango: la suma ponderada de componentes esta en [0..1]. Si el track viene
 * del CSV del usuario (`source === 'user'`) se anade un bonus aditivo
 * (USER_SOURCE_BONUS), por lo que el score final puede llegar a [0..1.08].
 * El motor solo usa el orden para escoger, no el valor absoluto.
 *
 * Componentes (todos 0..1):
 *  - cadenceScore:  proximidad al midpoint del rango de cadencia, tomando
 *                   el max entre vía 1:1 y vía 2:1 (half-time).
 *  - energyScore:   1 - |track.energy - zone.energyIdeal|. Distancia al
 *                   ideal de intensidad sonora. NO descarta tracks lejos.
 *  - valenceScore:  1 - |track.valence - zone.valenceIdeal|. Distancia al
 *                   ideal de positividad emocional.
 *  - genreScore:    1 si el track matchea preferenciaUsuario, 0 si no
 *                   matchea, 0.5 si lista de preferidos vacia.
 *
 * El motor escoge en cada slot el track con mayor score que no este ya
 * usado (regla cero repeticiones).
 */
export function scoreTrack(
  track: Track,
  criteria: ZoneMusicCriteria,
  preferredGenres: readonly string[],
): number {
  // === CADENCE ===
  // Score por proximidad al midpoint del rango 1:1 O del rango alternativo
  // (2× en bike, 0.5× en run). Tomamos el max para no penalizar tracks que
  // matchean por la via half-time/half-cadence.
  const midpoint11 = (criteria.cadenceMin + criteria.cadenceMax) / 2;
  const halfRange11 = (criteria.cadenceMax - criteria.cadenceMin) / 2;
  const alt = getAlternativeBpmRange(criteria);
  const midpointAlt = (alt.min + alt.max) / 2;
  const halfRangeAlt = (alt.max - alt.min) / 2;
  const score11 =
    halfRange11 > 0
      ? Math.max(0, 1 - Math.abs(track.tempoBpm - midpoint11) / halfRange11)
      : 0;
  const scoreAlt =
    halfRangeAlt > 0
      ? Math.max(0, 1 - Math.abs(track.tempoBpm - midpointAlt) / halfRangeAlt)
      : 0;
  const cadenceScore = Math.max(score11, scoreAlt);

  // === ENERGY (continua, no excluyente, penalizacion CUADRATICA) ===
  // (1 - dist)² castiga mas fuerte los outliers. Track con energy 0.95 vs
  // ideal Z1 0.30 (dist 0.65): linear 0.35 → cuadratico 0.12. Tracks cerca
  // del ideal (dist <0.2) quedan casi intactos. Esto evita que en zonas
  // con ideal extremo (Z1 ideal 0.30, Z6 ideal 0.95) los tracks lejanos
  // suban al top cuando no hay opciones cercanas.
  const energyDist = Math.abs(track.energy - criteria.energyIdeal);
  const energyScore = Math.pow(Math.max(0, 1 - energyDist), 2);

  // === VALENCE (continua, no excluyente, penalizacion CUADRATICA) ===
  const valenceDist = Math.abs(track.valence - criteria.valenceIdeal);
  const valenceScore = Math.pow(Math.max(0, 1 - valenceDist), 2);

  // === GENRE ===
  const genreScore =
    preferredGenres.length === 0
      ? NEUTRAL_GENRE_SCORE
      : track.genres.some((g) => preferredGenres.includes(g))
        ? 1
        : 0;

  // === USER SOURCE BONUS ===
  // Sube la probabilidad de que un track del CSV del usuario gane el slot
  // frente a uno predefinido con score similar. Si todos los tracks del pool
  // son 'user' (modo "Solo mis CSV") el bonus es uniforme y no afecta al
  // ranking: solo desempata cuando coexisten origenes distintos ("Combinar").
  const sourceBonus = track.source === 'user' ? USER_SOURCE_BONUS : 0;

  return (
    W_CADENCE * cadenceScore +
    W_ENERGY * energyScore +
    W_VALENCE * valenceScore +
    W_GENRE * genreScore +
    sourceBonus
  );
}
