import type { HeartRateZone } from '../physiology/karvonen';
import type { CadenceProfile } from '../segmentation/sessionPlan';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';

/**
 * Preferencias musicales del usuario para guiar el matching.
 */
export interface MatchPreferences {
  /** Lista vacia = no filtrar por genero (catalogo entero disponible). */
  preferredGenres: string[];
  /** True = sube Energy minima a 0.70 incluso en zonas suaves (Z1-Z2). */
  allEnergetic: boolean;
}

export const EMPTY_PREFERENCES: MatchPreferences = {
  preferredGenres: [],
  allEnergetic: false,
};

/**
 * Criterios musicales para una combinacion (zona, cadenceProfile).
 *
 * **Filtro EXCLUYENTE: cadencia rpm.** Un track encaja si su tempoBpm cae en
 * [cadenceMin, cadenceMax] (match 1:1, una pedalada por beat) o en
 * [2·cadenceMin, 2·cadenceMax] (match 2:1 half-time, golpe fuerte cada 2
 * pedaladas). Si no, no es candidato.
 *
 * **Score INCLUYENTE: energy y valence ideales.** Las dimensiones de
 * intensidad sonora y positividad emocional NO descartan tracks; afectan al
 * orden de preferencia en scoreTrack: tracks cerca del ideal puntuan mas.
 * Esto evita falsos descartes y permite que el motor maximice la calidad
 * dentro del catalogo disponible.
 */
export interface ZoneMusicCriteria {
  zone: HeartRateZone;
  cadenceProfile: CadenceProfile;
  /** Cadencia objetivo minima (rpm). Filtro excluyente vía 1:1 o 2:1. */
  cadenceMin: number;
  /** Cadencia objetivo maxima (rpm). Filtro excluyente vía 1:1 o 2:1. */
  cadenceMax: number;
  /** Energy [0..1] ideal para esta zona. Score por distancia, no excluye. */
  energyIdeal: number;
  /** Valencia [0..1] ideal (positividad emocional). Score por distancia. */
  valenceIdeal: number;
  description: string;
}

export type MatchQuality = 'strict' | 'best-effort' | 'insufficient';

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
