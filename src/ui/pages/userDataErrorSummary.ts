import type { ValidationError } from '@core/user';

/**
 * Etiqueta corta de cada campo, usada en el resumen aria-live de errores
 * de UserDataStep. El orden en el que aparecen los codigos es irrelevante
 * para el mapeo: solo importa que cubra todos los codigos del dominio.
 */
const ERROR_FIELD_LABEL: Record<ValidationError['code'], string> = {
  WEIGHT_REQUIRED: 'peso',
  WEIGHT_OUT_OF_RANGE: 'peso',
  MAX_HR_OUT_OF_RANGE: 'FC máxima',
  RESTING_HR_OUT_OF_RANGE: 'FC en reposo',
  RESTING_GE_MAX_HR: 'FC en reposo',
  FTP_OUT_OF_RANGE: 'FTP',
  BIRTH_YEAR_OUT_OF_RANGE: 'año de nacimiento',
  SEX_REQUIRED: 'sexo biológico',
  NEED_FTP_OR_HR_DATA: 'FC máxima o año de nacimiento',
  NEED_HR_DATA: 'frecuencia cardíaca',
  BIKE_WEIGHT_OUT_OF_RANGE: 'peso de la bici',
  BIKE_TYPE_INVALID: 'tipo de bici',
};

/**
 * Genera el texto resumen de errores para anunciar via aria-live tras un
 * intento de submit fallido en el paso "Tus datos".
 *
 * - Deduplica por etiqueta (peso vs peso fuera de rango -> un solo "peso").
 * - Mantiene orden de aparicion de los errores (no orden alfabetico).
 * - Formatea singular/plural en castellano: "Falta 1 dato" o "Faltan N datos".
 */
export function buildErrorSummary(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  const labels: string[] = [];
  for (const e of errors) {
    const label = ERROR_FIELD_LABEL[e.code];
    if (!labels.includes(label)) labels.push(label);
  }
  const count = labels.length;
  if (count === 1) return `Falta 1 dato: ${labels[0]}.`;
  return `Faltan ${count} datos: ${labels.join(', ')}.`;
}
