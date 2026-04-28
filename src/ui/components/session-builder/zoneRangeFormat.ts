import type {
  HeartRateZone,
  KarvonenZoneRange,
  PowerZoneRange,
} from '@core/physiology';

/**
 * Devuelve "min-max bpm" para la zona pedida, o null si no hay datos Karvonen
 * o si la zona es Z6 (FC saturada en max -> rango degenerado, sin sentido).
 */
export function formatBpmRange(
  zone: HeartRateZone,
  karvonen: readonly KarvonenZoneRange[] | null,
): string | null {
  if (karvonen === null) return null;
  if (zone === 6) return null;
  const range = karvonen.find((r) => r.zone === zone);
  if (range === undefined) return null;
  return `${Math.round(range.minBpm)}-${Math.round(range.maxBpm)} bpm`;
}

/**
 * Devuelve "min-max W" para la zona pedida, o null si no hay datos Coggan.
 * Z1 abre por debajo ("<137 W") y Z6 abre por arriba (">300 W") porque sus
 * limites teoricos son 0/Infinity.
 */
export function formatWattsRange(
  zone: HeartRateZone,
  power: readonly PowerZoneRange[] | null,
): string | null {
  if (power === null) return null;
  const range = power.find((r) => r.zone === zone);
  if (range === undefined) return null;
  if (range.minWatts === 0) return `<${Math.round(range.maxWatts)} W`;
  if (!Number.isFinite(range.maxWatts)) return `>${Math.round(range.minWatts)} W`;
  return `${Math.round(range.minWatts)}-${Math.round(range.maxWatts)} W`;
}
