import { haversineDistanceMeters } from './haversine';
import type { GpxPoint } from './types';

/**
 * Suaviza la altimetría sobre una ventana de distancia en metros (no nº de
 * puntos: GPX con muestreo irregular romperían el promedio uniforme).
 *
 * Para cada punto i, devuelve la media aritmética de la elevación de todos
 * los puntos cuya distancia acumulada en el track caiga en
 * [d_i - W/2, d_i + W/2]. Si W <= 0 devuelve el array original sin cambios.
 *
 * Por qué: los altímetros GPS de relojes/ciclocomputadores tienen ruido
 * típico de ±1-3 m incluso parados. Computar pendiente punto-a-punto
 * amplifica ese jitter en falsos muros del 10-15% durante 2-3 m de track,
 * que la ecuación de potencia convierte en picos irreales de ~600 W. Una
 * ventana de 30-50 m (estándar industrial: Strava, Garmin Connect) plancha
 * el ruido sin perder la información de pendientes reales sostenidas.
 */
export function smoothElevation(points: readonly GpxPoint[], windowMeters: number): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (windowMeters <= 0) return points.map((p) => p.ele);

  // Distancia acumulada desde el primer punto.
  const cumulative = new Array<number>(n);
  cumulative[0] = 0;
  for (let i = 1; i < n; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cumulative[i] = cumulative[i - 1]! + haversineDistanceMeters(a.lat, a.lon, b.lat, b.lon);
  }

  const half = windowMeters / 2;
  const out = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    const target = cumulative[i]!;
    // Avanzar hi mientras esté dentro de [target - half, target + half]
    while (hi < n && cumulative[hi]! <= target + half) {
      sum += points[hi]!.ele;
      count++;
      hi++;
    }
    // Avanzar lo mientras esté fuera del extremo inferior
    while (lo < hi && cumulative[lo]! < target - half) {
      sum -= points[lo]!.ele;
      count--;
      lo++;
    }
    out[i] = count > 0 ? sum / count : points[i]!.ele;
  }
  return out;
}
