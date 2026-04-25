import type { DistanceSegment } from '../gpx/types';
import { DEFAULT_POWER_CONSTANTS, type PowerConstants } from './types';

/**
 * Estima la potencia mecanica desarrollada por el ciclista en un segmento.
 *
 *   P_total = P_gravedad + P_rodadura + P_aerodinamica
 *
 *   P_gravedad     = m * g * v * sin(atan(slope/100))
 *   P_rodadura     = Crr * m * g * v * cos(atan(slope/100))
 *   P_aerodinamica = 0.5 * rho * CdA * v^3
 *
 * Donde m = peso ciclista + peso bici, v = velocidad media del segmento.
 *
 * - Si v <= 0: devuelve 0 (parado, no contribuye potencia mecanica).
 * - Si P_total < 0 (bajada con freno o inercia): clamp a 0. La potencia mecanica
 *   del ciclista no puede ser negativa por definicion (no estamos modelando frenado
 *   regenerativo ni biomecanica de pedaleo recogido).
 */
export function estimatePowerWatts(
  segment: DistanceSegment,
  riderWeightKg: number,
  constants: PowerConstants = DEFAULT_POWER_CONSTANTS,
): number {
  const v = segment.speedMps;
  if (!Number.isFinite(v) || v <= 0) return 0;

  const m = riderWeightKg + constants.bikeWeightKg;
  const g = constants.gravityMps2;

  // Angulo de la pendiente: slope% es tan(angle)*100
  const angle = Math.atan(segment.slopePercent / 100);
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);

  const pGravity = m * g * v * sinA;
  const pRolling = constants.crr * m * g * v * cosA;
  const pAero = 0.5 * constants.rhoKgPerM3 * constants.cdaM2 * v ** 3;

  const pTotal = pGravity + pRolling + pAero;
  return pTotal > 0 ? pTotal : 0;
}
