import type { HeartRateZone } from '../physiology/karvonen';
import type { CadenceProfile } from '../segmentation/sessionPlan';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import type { Sport } from '../user/userInputs';

/**
 * Preferencias musicales del usuario para guiar el matching.
 */
export interface MatchPreferences {
  /** Lista vacia = no filtrar por genero (catalogo entero disponible). */
  preferredGenres: string[];
  /** True = sube Energy minima a 0.70 incluso en zonas suaves (Z1-Z2). */
  allEnergetic: boolean;
  /**
   * Semilla aleatoria entera. Si está definida, el motor introduce variedad
   * controlada eligiendo entre los top-K candidatos de cada slot con
   * probabilidad ponderada por score (siempre buena calidad, distinta
   * cada vez que cambia la semilla). Si está `undefined`, comportamiento
   * legacy 100% determinista (siempre el #1 del ranking).
   *
   * Misma semilla + mismo input → siempre misma playlist (reproducible).
   */
  seed?: number;
}

export const EMPTY_PREFERENCES: MatchPreferences = {
  preferredGenres: [],
  allEnergetic: false,
};

/**
 * Criterios musicales para una combinacion (zona, cadenceProfile, sport).
 *
 * **Filtro EXCLUYENTE: cadencia.** Un track encaja si su tempoBpm cae en
 * [cadenceMin, cadenceMax] (match 1:1, una unidad de cadencia por beat) o en
 * el rango alternativo dependiente del deporte:
 *   - Sport 'bike': [2·cadenceMin, 2·cadenceMax] (half-time 2:1, track 2× rpm,
 *     golpe fuerte cada 2 pedaladas).
 *   - Sport 'run': [cadenceMin/2, cadenceMax/2] (track 0.5× spm, 2 pasos por
 *     beat).
 * Ver `getAlternativeBpmRange` en `zoneCriteria.ts`.
 *
 * **Score INCLUYENTE: energy y valence ideales.** Las dimensiones de
 * intensidad sonora y positividad emocional NO descartan tracks; afectan al
 * orden de preferencia en scoreTrack: tracks cerca del ideal puntuan mas.
 * Esto evita falsos descartes y permite que el motor maximice la calidad
 * dentro del catalogo disponible.
 */
export interface ZoneMusicCriteria {
  zone: HeartRateZone;
  /**
   * Deporte para el que se calculan los criterios. Determina rangos de
   * cadencia y direccion del match alternativo. Opcional por retrocompat;
   * undefined se trata como 'bike' en getAlternativeBpmRange.
   */
  sport?: Sport;
  /** En running es informativo (placeholder 'flat'); el matching no lo usa. */
  cadenceProfile: CadenceProfile;
  /** Cadencia objetivo minima (rpm en bike, spm en run). Filtro excluyente. */
  cadenceMin: number;
  /** Cadencia objetivo maxima (rpm en bike, spm en run). Filtro excluyente. */
  cadenceMax: number;
  /** Energy [0..1] ideal para esta zona. Score por distancia, no excluye. */
  energyIdeal: number;
  /** Valencia [0..1] ideal (positividad emocional). Score por distancia. */
  valenceIdeal: number;
  description: string;
}

export type MatchQuality = 'strict' | 'best-effort' | 'repeated' | 'insufficient';

/**
 * Segmento de la ruta ya casado con una cancion concreta. track === null
 * cuando el catalogo no puede cubrir este segmento sin repetir un track ya
 * usado en la playlist (regla "cero repeticiones"): puede ser por catalogo
 * vacio para la zona o por agotamiento del pool en sesiones largas. La UI
 * debe avisar al usuario antes de generar (ver poolCoverage.ts).
 */
export interface MatchedSegment extends ClassifiedSegment {
  track: Track | null;
  matchScore: number;
  matchQuality: MatchQuality;
}
