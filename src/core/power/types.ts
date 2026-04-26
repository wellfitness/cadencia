import type { BikeType } from '../user/userInputs';

/**
 * Constantes fisicas para el modelo de potencia.
 * Para casos tipicos derivar de BIKE_PRESETS via buildPowerConstants().
 */
export interface PowerConstants {
  /** Peso del conjunto bici + accesorios (no del ciclista). */
  bikeWeightKg: number;
  /** Aceleracion de la gravedad en la Tierra. */
  gravityMps2: number;
  /** Coeficiente de resistencia a la rodadura. */
  crr: number;
  /** Densidad del aire (rho). 1.225 = nivel del mar a 15 grados. */
  rhoKgPerM3: number;
  /** Coeficiente aerodinamico * area frontal. */
  cdaM2: number;
}

export const DEFAULT_POWER_CONSTANTS: PowerConstants = {
  bikeWeightKg: 10,
  gravityMps2: 9.81,
  crr: 0.004,
  rhoKgPerM3: 1.225,
  cdaM2: 0.36,
};

/**
 * Presets fisicos por tipo de bici. Crr y CdA sacados de la literatura clasica
 * (Coggan, BicycleRollingResistance.com, varios estudios).
 *
 * - road: tubeless carretera, postura aerodinamica con manillar bajo.
 * - gravel: neumatico mixto, postura erguida-relajada.
 * - mtb: tacos anchos, postura erguida.
 */
export interface BikePreset {
  crr: number;
  cdaM2: number;
}

export const BIKE_PRESETS: Record<BikeType, BikePreset> = {
  road: { crr: 0.003, cdaM2: 0.28 },
  gravel: { crr: 0.005, cdaM2: 0.36 },
  mtb: { crr: 0.012, cdaM2: 0.48 },
};

export const BIKE_TYPE_LABELS: Record<BikeType, string> = {
  road: 'Carretera',
  gravel: 'Gravel',
  mtb: 'Montaña',
};

/** Material icon name por tipo de bici (todos disponibles en Material Icons). */
export const BIKE_TYPE_ICONS: Record<BikeType, string> = {
  road: 'directions_bike',
  gravel: 'terrain',
  mtb: 'landscape',
};

/**
 * Construye las constantes fisicas a partir del peso de bici y el tipo,
 * combinando el preset (Crr, CdA) con valores universales (g, rho).
 */
export function buildPowerConstants(bikeWeightKg: number, bikeType: BikeType): PowerConstants {
  const preset = BIKE_PRESETS[bikeType];
  return {
    bikeWeightKg,
    gravityMps2: 9.81,
    crr: preset.crr,
    rhoKgPerM3: 1.225,
    cdaM2: preset.cdaM2,
  };
}
