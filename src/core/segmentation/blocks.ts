import { computeSegments } from '../gpx/segments';
import type { GpxTrack } from '../gpx/types';
import type { HeartRateZone } from '../physiology/karvonen';
import { estimatePowerWatts } from '../power/equation';
import { buildPowerConstants, type PowerConstants } from '../power/types';
import type { ValidatedUserInputs } from '../user/userInputs';
import { classifyZone } from './classifyZone';
import type { CadenceProfile } from './sessionPlan';
import type { ClassifiedSegment, RouteMeta } from './types';

const TARGET_BLOCK_DURATION_SEC = 60;

/**
 * Umbral de pendiente (%) por encima del cual el bloque se considera escalada
 * a efectos de cadencia objetivo (climb). Por debajo se asume llano (flat).
 * El valor 6% es conservador: cubre repechos sostenidos pero no falsos
 * positivos en colinas suaves.
 */
const CLIMB_SLOPE_THRESHOLD_PCT = 6;

export function inferCadenceProfileFromSlopePct(slopePct: number): CadenceProfile {
  return slopePct > CLIMB_SLOPE_THRESHOLD_PCT ? 'climb' : 'flat';
}

export interface SegmentationResult {
  segments: ClassifiedSegment[];
  meta: RouteMeta;
}

/**
 * Pipeline completo: GPX track -> bloques de ~60s clasificados por zona,
 * mas metadata agregada del recorrido completo.
 *
 * Algoritmo:
 *   1. computeSegments(track) para obtener DistanceSegment[] punto-a-punto.
 *   2. Acumular segmentos consecutivos hasta sumar >= 60s (o agotar la ruta).
 *   3. Por cada bloque calcular potencia media ponderada por duracion.
 *   4. Clasificar en zona Coggan.
 *   5. Agregar metadata: distancia total, desnivel, NP = (mean(P^4))^(1/4),
 *      tiempo en cada zona.
 */
export function segmentInto60SecondBlocks(
  track: GpxTrack,
  validated: ValidatedUserInputs,
  /** Override opcional de constantes (testing o configuracion avanzada). Por defecto deriva del tipo+peso de bici. */
  constants: PowerConstants = buildPowerConstants(validated.bikeWeightKg, validated.bikeType),
): SegmentationResult {
  const distSegments = computeSegments(track);
  const blocks: ClassifiedSegment[] = [];

  let totalDistance = 0;
  let totalGain = 0;
  let totalLoss = 0;
  let totalDuration = 0;

  // Estado del bloque actual en construccion
  let blockStartIdx: number | null = null;
  let blockDuration = 0;
  let blockDistance = 0;
  let blockEnergyJoules = 0; // potencia*duracion sumada para promediar despues
  let blockStartTimeSec = 0;

  const flushBlock = (endSegmentIdx: number): void => {
    if (blockStartIdx === null) return;
    const startSeg = distSegments[blockStartIdx];
    const endSeg = distSegments[endSegmentIdx];
    if (!startSeg || !endSeg) return;

    const startPoint = track.points[startSeg.fromIndex];
    const endPoint = track.points[endSeg.toIndex];
    if (!startPoint || !endPoint) return;

    const avgPower = blockDuration > 0 ? blockEnergyJoules / blockDuration : 0;
    const zone = classifyZone(avgPower, validated);
    const slopePct = blockDistance > 0 ? ((endPoint.ele - startPoint.ele) / blockDistance) * 100 : 0;
    const cadenceProfile = inferCadenceProfileFromSlopePct(slopePct);

    blocks.push({
      startSec: blockStartTimeSec,
      durationSec: blockDuration,
      avgPowerWatts: avgPower,
      zone,
      cadenceProfile,
      startDistanceMeters: totalDistance - blockDistance,
      endDistanceMeters: totalDistance,
      startElevationMeters: startPoint.ele,
      endElevationMeters: endPoint.ele,
      startLat: startPoint.lat,
      startLon: startPoint.lon,
    });

    // Reset para el siguiente bloque
    blockStartIdx = null;
    blockDuration = 0;
    blockDistance = 0;
    blockEnergyJoules = 0;
  };

  for (let i = 0; i < distSegments.length; i++) {
    const ds = distSegments[i];
    if (!ds) continue;

    if (blockStartIdx === null) {
      blockStartIdx = i;
      blockStartTimeSec = totalDuration;
    }

    const power = estimatePowerWatts(ds, validated.weightKg, constants);
    blockDuration += ds.durationSeconds;
    blockDistance += ds.distanceMeters;
    blockEnergyJoules += power * ds.durationSeconds;

    totalDistance += ds.distanceMeters;
    totalDuration += ds.durationSeconds;
    if (ds.elevationDeltaMeters > 0) totalGain += ds.elevationDeltaMeters;
    if (ds.elevationDeltaMeters < 0) totalLoss += -ds.elevationDeltaMeters;

    if (blockDuration >= TARGET_BLOCK_DURATION_SEC) {
      flushBlock(i);
    }
  }

  // Bloque parcial final
  if (blockStartIdx !== null) {
    flushBlock(distSegments.length - 1);
  }

  // Metadata agregada
  const totalEnergy = blocks.reduce((acc, b) => acc + b.avgPowerWatts * b.durationSec, 0);
  const averagePower = totalDuration > 0 ? totalEnergy / totalDuration : 0;

  // Normalized Power: NP = (sum(P^4 * dt) / totalDuration)^(1/4) sobre los bloques.
  // Nota: Coggan original usa moving avg 30s, no bloques fijos. Esta es una
  // aproximacion razonable para esta primera version.
  const npNumerator = blocks.reduce(
    (acc, b) => acc + Math.pow(b.avgPowerWatts, 4) * b.durationSec,
    0,
  );
  const np = totalDuration > 0 ? Math.pow(npNumerator / totalDuration, 0.25) : 0;

  const zoneDurations: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const b of blocks) zoneDurations[b.zone] += b.durationSec;

  const meta: RouteMeta = {
    name: track.name,
    totalDistanceMeters: totalDistance,
    totalElevationGainMeters: totalGain,
    totalElevationLossMeters: totalLoss,
    totalDurationSec: totalDuration,
    averagePowerWatts: averagePower,
    normalizedPowerWatts: np,
    zoneDurationsSec: zoneDurations,
    hadRealTimestamps: track.hasTimestamps,
  };

  return { segments: blocks, meta };
}
