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
}

/**
 * Datos validados y derivados, listos para alimentar el resto del pipeline.
 *
 * - weightKg siempre presente (es el unico campo requerido sin alternativa).
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
  hasFtp: boolean;
  hasHeartRateZones: boolean;
}

export const EMPTY_USER_INPUTS: UserInputsRaw = {
  weightKg: null,
  ftpWatts: null,
  maxHeartRate: null,
  restingHeartRate: null,
  birthYear: null,
};

/** Rangos aceptados (constantes exportadas para reuso en tests y UI). */
export const VALIDATION_LIMITS = {
  weightKg: { min: 30, max: 200 },
  ftpWatts: { min: 50, max: 600 },
  maxHeartRate: { min: 100, max: 230 },
  restingHeartRate: { min: 30, max: 100 },
  birthYear: { min: 1920, maxOffsetFromCurrent: 10 },
} as const;
