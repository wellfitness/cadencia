import type { HeartRateZone } from './karvonen';

export interface PowerZoneRange {
  zone: HeartRateZone;
  minWatts: number;
  /** Z6 es abierto por arriba (>120% FTP). El consumidor formatea como ">N W". */
  maxWatts: number;
}

// Bandas Coggan estandar (% de FTP). Z1 abierto por debajo, Z6 abierto por
// arriba: dejamos minWatts=0 en Z1 y maxWatts=Infinity en Z6 para que el
// consumidor decida como representarlas.
const ZONE_BOUNDS: Record<HeartRateZone, readonly [number, number]> = {
  1: [0, 0.55],
  2: [0.55, 0.75],
  3: [0.75, 0.9],
  4: [0.9, 1.05],
  5: [1.05, 1.2],
  6: [1.2, Infinity],
};

/**
 * Calcula los rangos de potencia (vatios) por zona usando el modelo Coggan
 * sobre la FTP del usuario. Misma estructura que calculateKarvonenZones para
 * que la UI pueda renderizar ambos lado a lado de forma simetrica.
 */
export function calculatePowerZones(ftpWatts: number): PowerZoneRange[] {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    throw new RangeError(`Invalid FTP: ${ftpWatts}`);
  }
  return (Object.entries(ZONE_BOUNDS) as Array<[`${HeartRateZone}`, readonly [number, number]]>).map(
    ([zone, [low, high]]) => ({
      zone: Number(zone) as HeartRateZone,
      minWatts: ftpWatts * low,
      maxWatts: high === Infinity ? Infinity : ftpWatts * high,
    }),
  );
}
