import { smoothElevation } from './elevationSmoothing';
import { haversineDistanceMeters } from './haversine';
import type { DistanceSegment, GpxTrack } from './types';

const SLOPE_CLAMP_PERCENT = 30;

/**
 * Ventana de distancia (metros) para suavizar la altimetría GPS antes de
 * derivar la pendiente. 50 m es un estándar industrial y plancha el jitter
 * típico (±1-3 m) sin enmascarar repechos reales sostenidos.
 */
const ELEVATION_SMOOTHING_WINDOW_METERS = 50;

/**
 * Velocidad estimada cuando el GPX no trae timestamps. Tabla aproximada
 * para ciclismo recreativo en bici de carretera/gravel.
 */
function estimateSpeedMps(slopePercent: number): number {
  const kmh =
    slopePercent < -1 ? 35 :
    slopePercent < 1 ? 25 :
    slopePercent < 4 ? 18 :
    slopePercent < 8 ? 14 :
    10;
  return (kmh * 1000) / 3600;
}

function clampSlope(slopePercent: number): number {
  if (slopePercent > SLOPE_CLAMP_PERCENT) return SLOPE_CLAMP_PERCENT;
  if (slopePercent < -SLOPE_CLAMP_PERCENT) return -SLOPE_CLAMP_PERCENT;
  return slopePercent;
}

/**
 * Convierte el track de puntos en una lista de segmentos consecutivos
 * (par i, i+1) con distancia, pendiente, duracion y velocidad.
 *
 * Antes de derivar la pendiente, la altimetría se suaviza con una ventana
 * de 50 m para eliminar el jitter GPS típico (±1-3 m) que produciría
 * falsos muros del 10-15% durante 2-3 m de track.
 *
 * - Si hasTimestamps: duracion real desde los timestamps; velocidad = dist/duracion.
 * - Si no: duracion estimada via velocidad heuristica por pendiente.
 *
 * Pendiente clampada a +/-30% como red de seguridad final por si quedase
 * algun outlier despues del suavizado (track GPS muy malo o ele saltada).
 */
export function computeSegments(track: GpxTrack): DistanceSegment[] {
  const out: DistanceSegment[] = [];
  const smoothedEle = smoothElevation(track.points, ELEVATION_SMOOTHING_WINDOW_METERS);

  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    if (!a || !b) continue;

    const distance = haversineDistanceMeters(a.lat, a.lon, b.lat, b.lon);
    // Pendiente sobre elevación suavizada para descartar jitter GPS.
    // elevationDeltaMeters reporta el delta SUAVIZADO porque es lo que
    // alimenta la ecuación de potencia y la clasificación cadenceProfile.
    const elevDelta = (smoothedEle[i + 1] ?? b.ele) - (smoothedEle[i] ?? a.ele);

    const rawSlope = distance > 0 ? (100 * elevDelta) / distance : 0;
    const slope = clampSlope(rawSlope);

    let duration: number;
    let speed: number;
    if (track.hasTimestamps && a.time !== null && b.time !== null) {
      duration = (b.time.getTime() - a.time.getTime()) / 1000;
      if (duration <= 0) {
        // GPX corrupto / puntos en el mismo instante: caer al fallback heuristico
        speed = estimateSpeedMps(slope);
        duration = speed > 0 ? distance / speed : 0;
      } else {
        speed = duration > 0 ? distance / duration : 0;
      }
    } else {
      speed = estimateSpeedMps(slope);
      duration = speed > 0 ? distance / speed : 0;
    }

    out.push({
      fromIndex: i,
      toIndex: i + 1,
      distanceMeters: distance,
      elevationDeltaMeters: elevDelta,
      slopePercent: slope,
      durationSeconds: duration,
      speedMps: speed,
    });
  }
  return out;
}
