import type { HeartRateZone } from '../physiology/karvonen';
import type { CadenceProfile } from './sessionPlan';

/**
 * Bloque de ~60 segundos del recorrido, ya clasificado a una zona de
 * intensidad. Es la unidad sobre la que el matching musical (fase 3) elegira
 * tracks.
 */
export interface ClassifiedSegment {
  /** Segundo desde el inicio del recorrido en el que arranca el bloque. */
  startSec: number;
  /** Duracion real (puede ser <60s en el ultimo bloque). */
  durationSec: number;
  avgPowerWatts: number;
  zone: HeartRateZone;
  /**
   * Perfil de cadencia. En GPX se infiere por pendiente (>6% → climb, resto
   * → flat). En sesion indoor se hereda directamente del SessionBlock.
   */
  cadenceProfile: CadenceProfile;
  startDistanceMeters: number;
  endDistanceMeters: number;
  startElevationMeters: number;
  endElevationMeters: number;
  startLat: number;
  startLon: number;
}

/**
 * Resumen agregado del recorrido completo.
 */
export interface RouteMeta {
  name: string;
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalElevationLossMeters: number;
  totalDurationSec: number;
  averagePowerWatts: number;
  /** Normalized Power = (mean(P^4))^(1/4) sobre los bloques de 60s. */
  normalizedPowerWatts: number;
  /** Tiempo total acumulado en cada zona (segundos). */
  zoneDurationsSec: Record<HeartRateZone, number>;
  /** True si el GPX traia timestamps reales (vs estimados por pendiente). */
  hadRealTimestamps: boolean;
}
