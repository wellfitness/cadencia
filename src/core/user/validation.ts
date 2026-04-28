import { calculateMaxHeartRate } from '../physiology/maxHeartRate';
import {
  BIKE_TYPES,
  DEFAULTS,
  VALIDATION_LIMITS,
  type BikeType,
  type UserInputsRaw,
  type ValidatedUserInputs,
} from './userInputs';

export type ValidationError =
  | { code: 'WEIGHT_REQUIRED' }
  | { code: 'WEIGHT_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'FTP_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'NEED_FTP_OR_HR_DATA' }
  | { code: 'NEED_HR_DATA' }
  | { code: 'BIRTH_YEAR_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'MAX_HR_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'RESTING_HR_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'RESTING_GE_MAX_HR' }
  | { code: 'SEX_REQUIRED' }
  | { code: 'BIKE_WEIGHT_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'BIKE_TYPE_INVALID' };

export type ValidationResult =
  | { ok: true; data: ValidatedUserInputs }
  | { ok: false; errors: ValidationError[] };

/**
 * Modo de validacion segun la fuente del entrenamiento.
 *
 * - 'gpx': comportamiento original. Peso obligatorio (alimenta la ecuacion
 *   de potencia GPX), zonas requieren FTP o FC o birthYear. Bici relevante.
 * - 'session': el usuario construye bloques manualmente y elige la zona de
 *   cada uno, asi que el peso/bici no son load-bearing y pueden quedar
 *   vacios. EXIGE minimo FC maxima O (birthYear + sex) para que el modo TV
 *   pueda mostrar pulsaciones objetivo en cada bloque; sin ese dato la
 *   experiencia se queda muda y el usuario no sabria a que ritmo pedalear.
 *   FTP, FC reposo, peso y bici siguen siendo opcionales.
 */
export type ValidationMode = 'gpx' | 'session';

const SESSION_DEFAULT_WEIGHT_KG = 70;

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Valida los inputs del usuario.
 *
 * Modo 'gpx' (default, retrocompatible):
 * - weightKg obligatorio.
 * - Si no hay FTP, requiere FC max O ano de nacimiento.
 * - restingHeartRate opcional pero necesario para zonas Karvonen.
 *
 * Modo 'session' (sesion indoor):
 * - weightKg opcional (defaultea a 70kg para estimaciones cosmeticas).
 * - Sin requisito de FTP/FC/birthYear (las zonas las elige el usuario por
 *   bloque al construir la sesion).
 * - Bike fields ignorados (no afectan a la pipeline indoor).
 *
 * Funcion pura: misma entrada -> misma salida. currentYear se pasa por
 * parametro para mantenerla testeable sin mocks de Date.
 */
export function validateUserInputs(
  raw: UserInputsRaw,
  currentYear: number,
  mode: ValidationMode = 'gpx',
): ValidationResult {
  if (mode === 'session') {
    return validateSession(raw, currentYear);
  }
  const errors: ValidationError[] = [];
  const limits = VALIDATION_LIMITS;

  // 1. Peso (obligatorio)
  if (raw.weightKg === null) {
    errors.push({ code: 'WEIGHT_REQUIRED' });
  } else if (!inRange(raw.weightKg, limits.weightKg.min, limits.weightKg.max)) {
    errors.push({
      code: 'WEIGHT_OUT_OF_RANGE',
      min: limits.weightKg.min,
      max: limits.weightKg.max,
    });
  }

  // 2. FTP (opcional, pero si esta debe ser valido)
  if (raw.ftpWatts !== null && !inRange(raw.ftpWatts, limits.ftpWatts.min, limits.ftpWatts.max)) {
    errors.push({
      code: 'FTP_OUT_OF_RANGE',
      min: limits.ftpWatts.min,
      max: limits.ftpWatts.max,
    });
  }

  // 3. Sin FTP -> necesita FC max O birthYear
  const hasFtp = raw.ftpWatts !== null;
  const hasMaxHr = raw.maxHeartRate !== null;
  const hasBirthYear = raw.birthYear !== null;
  if (!hasFtp && !hasMaxHr && !hasBirthYear) {
    errors.push({ code: 'NEED_FTP_OR_HR_DATA' });
  }

  // 3b. Si vamos a estimar FC max desde edad (birthYear sin FC max medida),
  // necesitamos sexo: las formulas Gulati/Tanaka divergen ~10 bpm.
  if (hasBirthYear && !hasMaxHr && raw.sex === null) {
    errors.push({ code: 'SEX_REQUIRED' });
  }

  // 4. birthYear (si esta, debe ser valido)
  const birthYearMax = currentYear - limits.birthYear.maxOffsetFromCurrent;
  if (raw.birthYear !== null && !inRange(raw.birthYear, limits.birthYear.min, birthYearMax)) {
    errors.push({
      code: 'BIRTH_YEAR_OUT_OF_RANGE',
      min: limits.birthYear.min,
      max: birthYearMax,
    });
  }

  // 5. maxHeartRate (si esta, debe ser valido)
  if (
    raw.maxHeartRate !== null &&
    !inRange(raw.maxHeartRate, limits.maxHeartRate.min, limits.maxHeartRate.max)
  ) {
    errors.push({
      code: 'MAX_HR_OUT_OF_RANGE',
      min: limits.maxHeartRate.min,
      max: limits.maxHeartRate.max,
    });
  }

  // 6. restingHeartRate (si esta, debe ser valido)
  if (
    raw.restingHeartRate !== null &&
    !inRange(raw.restingHeartRate, limits.restingHeartRate.min, limits.restingHeartRate.max)
  ) {
    errors.push({
      code: 'RESTING_HR_OUT_OF_RANGE',
      min: limits.restingHeartRate.min,
      max: limits.restingHeartRate.max,
    });
  }

  // 7. bikeWeightKg (si esta, debe ser valido)
  if (
    raw.bikeWeightKg !== null &&
    !inRange(raw.bikeWeightKg, limits.bikeWeightKg.min, limits.bikeWeightKg.max)
  ) {
    errors.push({
      code: 'BIKE_WEIGHT_OUT_OF_RANGE',
      min: limits.bikeWeightKg.min,
      max: limits.bikeWeightKg.max,
    });
  }

  // 8. bikeType (si esta, debe ser uno de los valores aceptados)
  if (raw.bikeType !== null && !BIKE_TYPES.includes(raw.bikeType)) {
    errors.push({ code: 'BIKE_TYPE_INVALID' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // weightKg garantizado por la validacion de arriba
  const weightKg = raw.weightKg as number;

  // Calcular FC max efectiva. En modo gpx, si llegamos aqui con birthYear y
  // sin maxHeartRate, sex esta garantizado no-null por la regla SEX_REQUIRED.
  let effectiveMaxHr: number | null = null;
  if (raw.maxHeartRate !== null) {
    effectiveMaxHr = raw.maxHeartRate;
  } else if (raw.birthYear !== null && raw.sex !== null) {
    effectiveMaxHr = calculateMaxHeartRate(currentYear - raw.birthYear, raw.sex);
  }

  // Validacion cruzada: FC reposo < FC max
  if (
    raw.restingHeartRate !== null &&
    effectiveMaxHr !== null &&
    raw.restingHeartRate >= effectiveMaxHr
  ) {
    return { ok: false, errors: [{ code: 'RESTING_GE_MAX_HR' }] };
  }

  const hasHeartRateZones = effectiveMaxHr !== null && raw.restingHeartRate !== null;

  // Defaults razonables para bici si el usuario no toca los campos
  const bikeType: BikeType = raw.bikeType ?? DEFAULTS.bikeType;
  const bikeWeightKg = raw.bikeWeightKg ?? DEFAULTS.bikeWeightByType[bikeType];

  return {
    ok: true,
    data: {
      weightKg,
      ftpWatts: raw.ftpWatts,
      effectiveMaxHr,
      restingHeartRate: raw.restingHeartRate,
      birthYear: raw.birthYear,
      sex: raw.sex,
      bikeWeightKg,
      bikeType,
      hasFtp,
      hasHeartRateZones,
    },
  };
}

/**
 * Validador para sesiones indoor. Reglas relajadas: peso opcional (default
 * 70 kg), bici irrelevante, sin requisito de FTP/FC/birthYear. Solo valida
 * que los campos que el usuario SI ha rellenado esten dentro de rango.
 *
 * Devuelve siempre `{ok: true}` salvo cuando algun campo introducido cae
 * fuera de su rango aceptado.
 */
function validateSession(raw: UserInputsRaw, currentYear: number): ValidationResult {
  const errors: ValidationError[] = [];
  const limits = VALIDATION_LIMITS;

  // weightKg: opcional, pero si esta debe ser valido
  if (raw.weightKg !== null && !inRange(raw.weightKg, limits.weightKg.min, limits.weightKg.max)) {
    errors.push({
      code: 'WEIGHT_OUT_OF_RANGE',
      min: limits.weightKg.min,
      max: limits.weightKg.max,
    });
  }

  // FTP: opcional, validar rango si esta
  if (raw.ftpWatts !== null && !inRange(raw.ftpWatts, limits.ftpWatts.min, limits.ftpWatts.max)) {
    errors.push({
      code: 'FTP_OUT_OF_RANGE',
      min: limits.ftpWatts.min,
      max: limits.ftpWatts.max,
    });
  }

  // birthYear: opcional, validar rango si esta
  const birthYearMax = currentYear - limits.birthYear.maxOffsetFromCurrent;
  if (raw.birthYear !== null && !inRange(raw.birthYear, limits.birthYear.min, birthYearMax)) {
    errors.push({
      code: 'BIRTH_YEAR_OUT_OF_RANGE',
      min: limits.birthYear.min,
      max: birthYearMax,
    });
  }

  // maxHeartRate: opcional, validar rango si esta
  if (
    raw.maxHeartRate !== null &&
    !inRange(raw.maxHeartRate, limits.maxHeartRate.min, limits.maxHeartRate.max)
  ) {
    errors.push({
      code: 'MAX_HR_OUT_OF_RANGE',
      min: limits.maxHeartRate.min,
      max: limits.maxHeartRate.max,
    });
  }

  // restingHeartRate: opcional, validar rango si esta
  if (
    raw.restingHeartRate !== null &&
    !inRange(raw.restingHeartRate, limits.restingHeartRate.min, limits.restingHeartRate.max)
  ) {
    errors.push({
      code: 'RESTING_HR_OUT_OF_RANGE',
      min: limits.restingHeartRate.min,
      max: limits.restingHeartRate.max,
    });
  }

  // Minimo de FC: el modo TV necesita poder mostrar pulsaciones objetivo
  // por bloque. Aceptamos FC max directa o (birthYear + sex) para estimarla
  // por edad. Sin esto, el usuario llegaria al modo TV sin guia de ritmo.
  const hasMaxHr = raw.maxHeartRate !== null;
  const canEstimateMaxHr = raw.birthYear !== null && raw.sex !== null;
  if (!hasMaxHr && !canEstimateMaxHr) {
    errors.push({ code: 'NEED_HR_DATA' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Calcular FC max efectiva. Tras el check anterior, hasMaxHr ||
  // canEstimateMaxHr esta garantizado, asi que effectiveMaxHr nunca queda null.
  let effectiveMaxHr: number | null = null;
  if (raw.maxHeartRate !== null) {
    effectiveMaxHr = raw.maxHeartRate;
  } else if (raw.birthYear !== null && raw.sex !== null) {
    effectiveMaxHr = calculateMaxHeartRate(currentYear - raw.birthYear, raw.sex);
  }

  // Validacion cruzada: FC reposo < FC max
  if (
    raw.restingHeartRate !== null &&
    effectiveMaxHr !== null &&
    raw.restingHeartRate >= effectiveMaxHr
  ) {
    return { ok: false, errors: [{ code: 'RESTING_GE_MAX_HR' }] };
  }

  const hasFtp = raw.ftpWatts !== null;
  const hasHeartRateZones = effectiveMaxHr !== null && raw.restingHeartRate !== null;
  const weightKg = raw.weightKg ?? SESSION_DEFAULT_WEIGHT_KG;

  // Bici: defaults razonables aunque el usuario no toque nada (la pipeline
  // indoor no usa estos campos, pero ValidatedUserInputs los exige por contrato)
  const bikeType: BikeType = raw.bikeType ?? DEFAULTS.bikeType;
  const bikeWeightKg = raw.bikeWeightKg ?? DEFAULTS.bikeWeightByType[bikeType];

  return {
    ok: true,
    data: {
      weightKg,
      ftpWatts: raw.ftpWatts,
      effectiveMaxHr,
      restingHeartRate: raw.restingHeartRate,
      birthYear: raw.birthYear,
      sex: raw.sex,
      bikeWeightKg,
      bikeType,
      hasFtp,
      hasHeartRateZones,
    },
  };
}

/** Helper para mostrar mensajes de error legibles en la UI. */
export function describeValidationError(err: ValidationError): string {
  switch (err.code) {
    case 'WEIGHT_REQUIRED':
      return 'El peso corporal es obligatorio.';
    case 'WEIGHT_OUT_OF_RANGE':
      return `El peso debe estar entre ${err.min} y ${err.max} kg.`;
    case 'FTP_OUT_OF_RANGE':
      return `La FTP debe estar entre ${err.min} y ${err.max} W.`;
    case 'NEED_FTP_OR_HR_DATA':
      return 'Necesitamos tu FTP o, en su defecto, tu FC máxima o tu año de nacimiento.';
    case 'NEED_HR_DATA':
      return 'Necesitamos tu FC máxima — o tu año de nacimiento y sexo, y la estimamos.';
    case 'BIRTH_YEAR_OUT_OF_RANGE':
      return `El año de nacimiento debe estar entre ${err.min} y ${err.max}.`;
    case 'MAX_HR_OUT_OF_RANGE':
      return `La FC máxima debe estar entre ${err.min} y ${err.max} bpm.`;
    case 'RESTING_HR_OUT_OF_RANGE':
      return `La FC en reposo debe estar entre ${err.min} y ${err.max} bpm.`;
    case 'RESTING_GE_MAX_HR':
      return 'La FC en reposo no puede ser mayor o igual que la FC máxima.';
    case 'SEX_REQUIRED':
      return 'Indícanos si eres mujer u hombre para estimar tu FC máxima por edad.';
    case 'BIKE_WEIGHT_OUT_OF_RANGE':
      return `El peso de la bici debe estar entre ${err.min} y ${err.max} kg.`;
    case 'BIKE_TYPE_INVALID':
      return 'Tipo de bici no reconocido.';
  }
}
