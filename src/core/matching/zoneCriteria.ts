import type { HeartRateZone } from '../physiology/karvonen';
import type { ZoneMusicCriteria } from './types';

/**
 * Criterios musicales por zona, segun la tabla "Mapeo zona -> metadatos de
 * track" de CLAUDE.md. Valores literales para que se vean en un vistazo.
 */
export const ZONE_MUSIC_CRITERIA: Record<HeartRateZone, ZoneMusicCriteria> = {
  1: { zone: 1, bpmMin: 90, bpmMax: 110, energyMin: 0.4, valenceMin: null, description: 'Recuperación' },
  2: { zone: 2, bpmMin: 110, bpmMax: 120, energyMin: 0.55, valenceMin: 0.4, description: 'Aeróbico' },
  3: { zone: 3, bpmMin: 120, bpmMax: 130, energyMin: 0.7, valenceMin: 0.5, description: 'Tempo' },
  4: { zone: 4, bpmMin: 130, bpmMax: 145, energyMin: 0.8, valenceMin: 0.6, description: 'Umbral' },
  5: { zone: 5, bpmMin: 145, bpmMax: 175, energyMin: 0.9, valenceMin: 0.7, description: 'Máximo' },
};

const ALL_ENERGETIC_FLOOR = 0.7;

/**
 * Aplica el toggle "todo con energia": en Z1-Z2 sube la Energy minima al
 * piso global 0.70 (sin tocar zonas mas altas que ya estan por encima).
 * Funcion pura.
 */
export function applyAllEnergetic(
  criteria: ZoneMusicCriteria,
  allEnergetic: boolean,
): ZoneMusicCriteria {
  if (!allEnergetic) return criteria;
  return {
    ...criteria,
    energyMin: Math.max(criteria.energyMin, ALL_ENERGETIC_FLOOR),
  };
}
