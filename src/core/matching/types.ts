import type { HeartRateZone } from '../physiology/karvonen';
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
 * Criterios musicales objetivo por zona de potencia. Valores derivados de
 * la tabla de CLAUDE.md "Mapeo zona -> metadatos de track".
 */
export interface ZoneMusicCriteria {
  zone: HeartRateZone;
  bpmMin: number;
  bpmMax: number;
  /** Energy minima [0..1] que debe tener el track para esta zona. */
  energyMin: number;
  /** Valencia minima [0..1] (positividad). null = no filtrar por valencia. */
  valenceMin: number | null;
  description: string;
}

export type MatchQuality = 'strict' | 'relaxed' | 'best-effort';

/**
 * Segmento de la ruta ya casado con una cancion concreta. Si track === null
 * el catalogo esta vacio (caso degenerado, no deberia pasar con los CSVs
 * nativos).
 */
export interface MatchedSegment extends ClassifiedSegment {
  track: Track | null;
  matchScore: number;
  matchQuality: MatchQuality;
}
