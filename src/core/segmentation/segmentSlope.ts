import type { ClassifiedSegment } from './types';

/**
 * Umbral en valor absoluto (%) por debajo del cual la pendiente se considera
 * "llano" SOLO a efectos de visualización. NO se usa para decidir cadencia
 * objetivo: ese threshold físico vive en blocks.ts (CLIMB_SLOPE_THRESHOLD_PCT
 * = 6%). Aquí solo queremos evitar que la UI muestre "↘ -0.1%" o similar.
 */
export const FLAT_SLOPE_DISPLAY_THRESHOLD_PCT = 1;

type SlopeInput = Pick<
  ClassifiedSegment,
  'startDistanceMeters' | 'endDistanceMeters' | 'startElevationMeters' | 'endElevationMeters'
>;

/**
 * Pendiente media del segmento en %. Positivo = subida, negativo = bajada.
 * Devuelve 0 si la distancia horizontal es 0 (caso degenerado o segmento de
 * sesión indoor con startDistanceMeters === endDistanceMeters).
 */
export function computeSegmentSlopePct(segment: SlopeInput): number {
  const distance = segment.endDistanceMeters - segment.startDistanceMeters;
  if (distance <= 0) return 0;
  const elevationDelta = segment.endElevationMeters - segment.startElevationMeters;
  return (elevationDelta / distance) * 100;
}

/** Tras computar la pendiente, indica si debe pintarse como "llano" sin valor. */
export function isSlopeVisuallyFlat(slopePct: number): boolean {
  return Math.abs(slopePct) < FLAT_SLOPE_DISPLAY_THRESHOLD_PCT;
}
