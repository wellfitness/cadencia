import { getZoneCriteria } from '@core/matching';
import {
  formatRpeRange,
  getZoneFeeling,
  type HeartRateZone,
  type KarvonenZoneRange,
  type PowerZoneRange,
} from '@core/physiology';
import { getRecommendedCadence, type CadenceProfile } from '@core/segmentation';
import type { Sport } from '@core/user';

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

/**
 * Devuelve "min-max rpm" para la cadencia recomendada al ciclista en la
 * combinacion (zona, profile). A diferencia de bpm/W, esta informacion no
 * depende de los datos del usuario, solo de la zona y el profile, asi que
 * siempre devuelve un string (nunca null).
 */
export function formatRecommendedCadence(
  zone: HeartRateZone,
  profile: CadenceProfile,
): string {
  const range = getRecommendedCadence(zone, profile);
  return `${range.min}-${range.max} rpm`;
}

/**
 * Devuelve "min-max spm" para la cadencia de zancada recomendada al runner
 * en la zona. En carrera la cadencia depende solo de la zona (no del terreno
 * como en bici), asi que `profile` no se usa.
 */
export function formatRecommendedCadenceRun(zone: HeartRateZone): string {
  const c = getZoneCriteria(zone, 'flat', 'run');
  return `${c.cadenceMin}-${c.cadenceMax} spm`;
}

/**
 * Helper unico que bifurca por sport y devuelve la cadencia formateada con
 * la unidad correcta (rpm para bici, spm para carrera). Default sport 'bike'.
 */
export function formatRecommendedCadenceForSport(
  zone: HeartRateZone,
  profile: CadenceProfile,
  sport: Sport = 'bike',
): string {
  if (sport === 'run') return formatRecommendedCadenceRun(zone);
  return formatRecommendedCadence(zone, profile);
}

/**
 * Devuelve "RPE X · «sensacion»" para la zona pedida. Universal: no depende
 * del deporte ni de los datos del usuario, solo de la zona Z1-Z6.
 *
 * El uso de comillas tipograficas «...» sigue la convencion del copy de
 * usuario del proyecto (CLAUDE.md, seccion "Open source colaborativo").
 */
export function formatZoneFeeling(zone: HeartRateZone): string {
  const feeling = getZoneFeeling(zone);
  return `${formatRpeRange(feeling)} · «${feeling.sensation}»`;
}
