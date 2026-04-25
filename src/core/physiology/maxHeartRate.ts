/**
 * Estima la frecuencia cardiaca maxima teorica usando la formula de Gulati,
 * mas precisa que la clasica Tanaka (208 - 0.7*edad) sobre todo para mujeres.
 *
 * Referencia: Gulati M et al., Circulation 2010.
 */
export function calculateMaxHeartRateGulati(ageYears: number): number {
  if (!Number.isFinite(ageYears) || ageYears <= 0 || ageYears > 120) {
    throw new RangeError(`Invalid age: ${ageYears}`);
  }
  return 211 - 0.64 * ageYears;
}
