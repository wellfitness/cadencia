export type HeartRateZone = 1 | 2 | 3 | 4 | 5 | 6;

export interface KarvonenZoneRange {
  zone: HeartRateZone;
  minBpm: number;
  maxBpm: number;
}

// Z6 (supramaxima/anaerobica) no es accesible solo por FC: la frecuencia
// cardiaca queda saturada en la maxima. El bound [1.0, 1.0] degenera a un
// rango vacio en bpm, asi que Z6 solo se distingue por potencia (>120% FTP).
const ZONE_BOUNDS: Record<HeartRateZone, readonly [number, number]> = {
  1: [0.5, 0.6],
  2: [0.6, 0.7],
  3: [0.7, 0.8],
  4: [0.8, 0.9],
  5: [0.9, 1.0],
  6: [1.0, 1.0],
};

/**
 * Calcula los rangos de FC por zona usando el metodo Karvonen sobre la reserva
 * de FC: zona = restingHr + factor * (maxHr - restingHr).
 */
export function calculateKarvonenZones(maxHr: number, restingHr: number): KarvonenZoneRange[] {
  if (!Number.isFinite(maxHr) || !Number.isFinite(restingHr) || maxHr <= restingHr || restingHr <= 0) {
    throw new RangeError(`Invalid HR inputs: max=${maxHr}, resting=${restingHr}`);
  }
  const reserve = maxHr - restingHr;
  return (Object.entries(ZONE_BOUNDS) as Array<[`${HeartRateZone}`, readonly [number, number]]>).map(
    ([zone, [low, high]]) => ({
      zone: Number(zone) as HeartRateZone,
      minBpm: restingHr + low * reserve,
      maxBpm: restingHr + high * reserve,
    }),
  );
}
