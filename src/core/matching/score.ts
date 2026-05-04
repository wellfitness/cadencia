import { expandMacroToTags, isValidMacroId } from '../tracks/genreCategories';
import type { Track } from '../tracks/types';
import type { ZoneMusicCriteria } from './types';
import { getAlternativeBpmRange } from './zoneCriteria';

/**
 * Pesos del score. Todos suman 1.00 en cada juego. Hay dos juegos:
 *
 *  - BASE (sin preferencias de genero): cadencia y energy dominan, genero
 *    queda como discriminador secundario aplicado de forma neutra (0.5).
 *  - PREF (con preferencias activas): el peso del genero sube a 0.35 para
 *    combatir el sesgo estructural del catalogo. Cuando un catalogo bundled
 *    concentra un genero en BPM dulce de varias zonas (ej. rock clasico en
 *    bike Z1-Z4 flat), el reparto base 0.20 no basta para que la preferencia
 *    explicita del usuario gane el ranking. Subimos genero quitando peso a
 *    valence (mas fino, menos critico) y a energy (sigue dominando a 0.25).
 *
 * Ambas variantes mantienen cadencia en 0.30: la sincronia tempo<->esfuerzo
 * es el unico factor con evidencia empirica fuerte (Bacon et al. 2012).
 */
const W_CADENCE_BASE = 0.3;
const W_ENERGY_BASE = 0.3;
const W_VALENCE_BASE = 0.2;
const W_GENRE_BASE = 0.2;

const W_CADENCE_PREF = 0.3;
const W_ENERGY_PREF = 0.25;
const W_VALENCE_PREF = 0.1;
const W_GENRE_PREF = 0.35;

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
 * Pesos:
 *  - Sin preferencias: cadencia 0.30, energy 0.30, valence 0.20, genero 0.20
 *    (con genreScore=0.5 neutro, el componente genero aporta 0.10 fijo).
 *  - Con preferencias: cadencia 0.30, energy 0.25, valence 0.10, genero 0.35.
 *    El peso del genero sube para que la preferencia explicita del usuario
 *    gane el ranking aunque el catalogo este sesgado a otro genero en la
 *    misma banda BPM.
 *
 * El motor escoge en cada slot el track con mayor score que no este ya
 * usado (regla cero repeticiones).
 */
export function scoreTrack(
  track: Track,
  criteria: ZoneMusicCriteria,
  preferredGenres: readonly string[],
): number {
  // Guard: campos numéricos críticos deben ser finitos para evitar NaN en
  // cadenceScore/energyScore/valenceScore. Un track con datos rotos puntúa 0
  // y queda al fondo del ranking sin contaminar el resto de cálculos.
  if (
    !Number.isFinite(track.tempoBpm) ||
    !Number.isFinite(track.energy) ||
    !Number.isFinite(track.valence)
  ) {
    return 0;
  }

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
  // `preferredGenres` son macro-IDs (`'house'`, `'rock'`, ...). Expandimos
  // a sus tags concretos de Spotify y comprobamos si el track lleva al
  // menos uno de esos tags. Por compatibilidad hacia atras: si un valor
  // no es macro-ID valido, lo tratamos como tag literal — esto cubre
  // datos antiguos en sessionStorage o llegados de Drive desde versiones
  // previas, hasta que el motor de migracion los limpie.
  const expandedTags = new Set<string>();
  for (const pref of preferredGenres) {
    if (isValidMacroId(pref)) {
      for (const t of expandMacroToTags(pref)) expandedTags.add(t);
    } else {
      expandedTags.add(pref);
    }
  }
  const genreScore =
    preferredGenres.length === 0
      ? NEUTRAL_GENRE_SCORE
      : track.genres.some((g) => expandedTags.has(g))
        ? 1
        : 0;

  // === USER SOURCE BONUS ===
  // Sube la probabilidad de que un track del CSV del usuario gane el slot
  // frente a uno predefinido con score similar. Si todos los tracks del pool
  // son 'user' (modo "Solo mis CSV") el bonus es uniforme y no afecta al
  // ranking: solo desempata cuando coexisten origenes distintos ("Combinar").
  const sourceBonus = track.source === 'user' ? USER_SOURCE_BONUS : 0;

  // Selecciona el juego de pesos: BASE si no hay preferencias, PREF si las hay.
  // Suma siempre 1.00 en cada juego.
  const hasPrefs = preferredGenres.length > 0;
  const wCadence = hasPrefs ? W_CADENCE_PREF : W_CADENCE_BASE;
  const wEnergy = hasPrefs ? W_ENERGY_PREF : W_ENERGY_BASE;
  const wValence = hasPrefs ? W_VALENCE_PREF : W_VALENCE_BASE;
  const wGenre = hasPrefs ? W_GENRE_PREF : W_GENRE_BASE;

  return (
    wCadence * cadenceScore +
    wEnergy * energyScore +
    wValence * valenceScore +
    wGenre * genreScore +
    sourceBonus
  );
}
