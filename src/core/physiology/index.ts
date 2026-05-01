export { calculateMaxHeartRate } from './maxHeartRate';
export { calculateKarvonenZones } from './karvonen';
export type { HeartRateZone, KarvonenZoneRange } from './karvonen';
export { calculatePowerZones } from './coggan';
export type { PowerZoneRange } from './coggan';
export { getZoneFeeling, formatRpeRange } from './zoneFeeling';
export type { ZoneFeeling } from './zoneFeeling';
export {
  ftpFromRampMap,
  vo2maxFromMap5,
  cpFrom3MT,
  maxHrFromPeak,
  lthrFrom5MinMeanHr,
  vMasFromBuchheitStage,
} from './tests';
export type { CpResult } from './tests';
