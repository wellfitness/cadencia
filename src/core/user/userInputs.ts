/**
 * Tipos de bici soportados para el modelo fisico.
 *
 * No incluimos "urbana" deliberadamente: la app pide al ciclista llevar
 * auriculares y eso es arriesgado en ciudad (no oyes el trafico). Para
 * trayectos urbanos recomendamos no usar la app.
 *
 * Electrica fuera por ahora (la asistencia rompe la ecuacion de potencia).
 */
export type BikeType = 'road' | 'gravel' | 'mtb';

export const BIKE_TYPES: readonly BikeType[] = ['road', 'gravel', 'mtb'] as const;

/**
 * Sexo biologico del usuario.
 *
 * Necesario solo para la formula de FC maxima teorica (Gulati en mujeres,
 * Tanaka en hombres). No es un dato de identidad ni de genero: si el usuario
 * mide su FC max con pulsometro, este campo no se usa.
 */
export type BiologicalSex = 'female' | 'male';

export const BIOLOGICAL_SEXES: readonly BiologicalSex[] = ['female', 'male'] as const;

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
  sex: BiologicalSex | null;
  bikeWeightKg: number | null;
  bikeType: BikeType | null;
}

/**
 * Datos validados y derivados, listos para alimentar el resto del pipeline.
 *
 * - weightKg siempre presente (es el unico campo requerido sin alternativa).
 * - bikeWeightKg y bikeType siempre presentes (defaulteados si el usuario no los toca).
 * - effectiveMaxHr es la FC max provista o, si falta, la calculada a partir
 *   de birthYear con la formula del sexo correspondiente (Gulati en mujeres,
 *   Tanaka en hombres).
 * - hasFtp/hasHeartRateZones permiten al pipeline decidir que metodo de
 *   zonificacion aplicar (Coggan si hay FTP, Karvonen si hay FC reposo).
 */
export interface ValidatedUserInputs {
  weightKg: number;
  ftpWatts: number | null;
  effectiveMaxHr: number | null;
  restingHeartRate: number | null;
  birthYear: number | null;
  sex: BiologicalSex | null;
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
  sex: null,
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
