import type { HeartRateZone } from '../physiology/karvonen';
import type { ValidatedUserInputs } from '../user/userInputs';
import { coalesceContiguousBlocks } from './coalesceBlocks';
import { detectIntervalSets } from './intervalSets';
import type { SessionPlan } from './sessionPlan';
import type { ClassifiedSegment, RouteMeta } from './types';

/**
 * Conversion SessionPlan → ClassifiedSegment[] + RouteMeta para alimentar el
 * mismo motor de matching que ya consume los GPX procesados. La sesion no
 * tiene ruta real (sin distancia, sin elevacion, sin coordenadas), asi que
 * los campos cosmeticos del ClassifiedSegment se ponen a 0; el matching no
 * los usa, solo `zone` y `durationSec`.
 */

/**
 * Punto medio de cada banda Coggan, expresado como porcentaje de FTP. Lo usamos
 * para sintetizar una potencia "media" representativa de cada zona cuando el
 * usuario construye la sesion manualmente. Coherente con classifyZone.ts: si
 * pasamos esta potencia por ratioToCogganZone(), recuperamos la misma zona,
 * cerrando el bucle de forma determinista.
 *
 *   Z1 < 55%      → 45%
 *   Z2 55-75%     → 65%
 *   Z3 75-90%     → 82.5%
 *   Z4 90-105%    → 97.5%
 *   Z5 105-120%   → 112.5%
 *   Z6 ≥ 120%     → 135%
 */
const ZONE_FTP_MIDPOINT: Record<HeartRateZone, number> = {
  1: 0.45,
  2: 0.65,
  3: 0.825,
  4: 0.975,
  5: 1.125,
  6: 1.35,
};

/** Mismo estimador W/kg que classifyZone.ts cuando el usuario no aporta FTP. */
const ESTIMATED_FTP_WATTS_PER_KG = 2.5;

/**
 * FTP generico para indoor cuando el usuario no aporta nada. ~175W es la
 * referencia de un ciclista recreativo medio. La potencia mostrada en
 * sesiones indoor es solo cosmetica (las zonas las decide el usuario al
 * construir bloques), asi que un default razonable es suficiente.
 */
const DEFAULT_INDOOR_FTP_WATTS = 175;

function effectiveFtp(validated: ValidatedUserInputs): number {
  if (validated.hasFtp && validated.ftpWatts !== null) {
    return validated.ftpWatts;
  }
  if (validated.weightKg > 0) {
    return ESTIMATED_FTP_WATTS_PER_KG * validated.weightKg;
  }
  return DEFAULT_INDOOR_FTP_WATTS;
}

/**
 * Mapea cada SessionBlock a un ClassifiedSegment con potencia sintetica
 * coherente con la zona. Determinista: misma entrada → misma salida.
 *
 * Antes del mapeo aplica un pre-procesado que el matcher recibe ya cocinado:
 *   1. coalesceContiguousBlocks: fusiona runs contiguos de misma
 *      (zone, profile, phase) — limpia bloques fragmentados.
 *   2. detectIntervalSets: detecta sets interválicos con bloques cortos
 *      (SIT, HIIT, VO2max Cortos) y los sustituye por un macrobloque virtual
 *      de la zona alta del set. Evita que un track de recuperacion derrame a
 *      un intervalo de Z4/Z5/Z6.
 *
 * El matcher (matchDiscrete / matchOverlap) no se entera del pre-procesado.
 */
export function classifySessionPlan(
  plan: SessionPlan,
  validated: ValidatedUserInputs,
): ClassifiedSegment[] {
  const ftp = effectiveFtp(validated);
  const preprocessed = detectIntervalSets(coalesceContiguousBlocks(plan.blocks));
  const segments: ClassifiedSegment[] = [];
  let cursorSec = 0;

  for (const block of preprocessed) {
    if (block.durationSec <= 0) continue;
    const avgPowerWatts = ftp * ZONE_FTP_MIDPOINT[block.zone];
    segments.push({
      startSec: cursorSec,
      durationSec: block.durationSec,
      avgPowerWatts,
      zone: block.zone,
      cadenceProfile: block.cadenceProfile,
      startDistanceMeters: 0,
      endDistanceMeters: 0,
      startElevationMeters: 0,
      endElevationMeters: 0,
      startLat: 0,
      startLon: 0,
    });
    cursorSec += block.durationSec;
  }

  return segments;
}

/**
 * Construye el RouteMeta sintetico para la sesion: distancia/elevacion en 0,
 * y los demas campos derivados de los segments. Mantiene la forma del
 * RouteMeta original para que el resto de la UI (ResultStep, MusicStep) no
 * requiera cambios.
 */
export function buildSessionRouteMeta(
  plan: SessionPlan,
  segments: readonly ClassifiedSegment[],
): RouteMeta {
  const totalDurationSec = segments.reduce((acc, s) => acc + s.durationSec, 0);
  const totalEnergy = segments.reduce((acc, s) => acc + s.avgPowerWatts * s.durationSec, 0);
  const averagePowerWatts = totalDurationSec > 0 ? totalEnergy / totalDurationSec : 0;
  const npNumerator = segments.reduce(
    (acc, s) => acc + Math.pow(s.avgPowerWatts, 4) * s.durationSec,
    0,
  );
  const normalizedPowerWatts =
    totalDurationSec > 0 ? Math.pow(npNumerator / totalDurationSec, 0.25) : 0;

  const zoneDurationsSec: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const s of segments) zoneDurationsSec[s.zone] += s.durationSec;

  return {
    name: plan.name,
    totalDistanceMeters: 0,
    totalElevationGainMeters: 0,
    totalElevationLossMeters: 0,
    totalDurationSec,
    averagePowerWatts,
    normalizedPowerWatts,
    zoneDurationsSec,
    hadRealTimestamps: false,
  };
}
