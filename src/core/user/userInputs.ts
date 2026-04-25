/** Tipos de bici soportados para el modelo fisico. Eléctrica fuera por ahora. */
export type BikeType = 'road' | 'gravel' | 'mtb' | 'urban';

export const BIKE_TYPES: readonly BikeType[] = ['road', 'gravel', 'mtb', 'urban'] as const;

/**
 * Datos fisiologicos crudos tal cual los introduce el usuario en el formulario.
 * Cualquier campo puede ser null mientras la pantalla este en edicion.
 */
export interface UserInputsRaw {
  weightKg: number | null;
  ftpWatts: number | null;
  maxHeartRate: number | null;
  restingHeartRate: number | null;
  birthYear: number | null;
  bikeWeightKg: number | null;
  bikeType: BikeType | null;
}

/**
 * Datos validados y derivados, listos para alimentar el resto del pipeline.
 *
 * - weightKg siempre presente (es el unico campo requerido sin alternativa).
 * - bikeWeightKg y bikeType siempre presentes (defaulteados si el usuario no los toca).
 * - effectiveMaxHr es la FC max provista o, si falta, la calculada por Gulati
 *   a partir de birthYear.
 * - hasFtp/hasHeartRateZones permiten al pipeline decidir que metodo de
 *   zonificacion aplicar (Coggan si hay FTP, Karvonen si hay FC reposo).
 */
export interface ValidatedUserInputs {
  weightKg: number;
  ftpWatts: number | null;
  effectiveMaxHr: number | null;
  restingHeartRate: number | null;
  birthYear: number | null;
  bikeWeightKg: number;
  bikeType: BikeType;
  hasFtp: boolean;
  hasHeartRateZones: boolean;
}

export const EMPTY_USER_INPUTS: UserInputsRaw = {
  weightKg: null,
  ftpWatts: null,
  maxHeartRate: null,
  restingHeartRate: null,
  birthYear: null,
  bikeWeightKg: null,
  bikeType: null,
};

/** Defaults aplicados cuando el usuario no toca el campo. */
export const DEFAULTS = {
  bikeType: 'gravel' as const satisfies BikeType,
  /** Peso default por tipo de bici (kg). */
  bikeWeightByType: {
    road: 8,
    gravel: 10,
    mtb: 13,
    urban: 15,
  } as const satisfies Record<BikeType, number>,
};

/** Rangos aceptados (constantes exportadas para reuso en tests y UI). */
export const VALIDATION_LIMITS = {
  weightKg: { min: 30, max: 200 },
  ftpWatts: { min: 50, max: 600 },
  maxHeartRate: { min: 100, max: 230 },
  restingHeartRate: { min: 30, max: 100 },
  birthYear: { min: 1920, maxOffsetFromCurrent: 10 },
  bikeWeightKg: { min: 5, max: 30 },
} as const;
