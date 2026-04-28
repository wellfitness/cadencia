import type { BiologicalSex } from '../user/userInputs';

/**
 * Estima la frecuencia cardiaca maxima teorica con la formula derivada para
 * cada sexo biologico. Las dos formulas se eligieron por ser las mas citadas
 * en la literatura para su poblacion objetivo:
 *
 * - Mujer: Gulati et al., Circulation 2010. 5.437 mujeres asintomaticas.
 *   FC_max = 206 - 0.88 * edad
 * - Hombre: Tanaka et al., JACC 2001. Meta-analisis sobre 18.712 sujetos.
 *   FC_max = 208 - 0.7 * edad
 *
 * Pedimos sexo porque la formula clasica unica (Fox 220-edad o Tanaka mixta)
 * sobreestima de forma sistematica la FC max en mujeres, lo que desplaza una
 * banda Karvonen entera y desfasa todo el matching musical a la baja.
 */
export function calculateMaxHeartRate(ageYears: number, sex: BiologicalSex): number {
  if (!Number.isFinite(ageYears) || ageYears <= 0 || ageYears > 120) {
    throw new RangeError(`Invalid age: ${ageYears}`);
  }
  return sex === 'female' ? 206 - 0.88 * ageYears : 208 - 0.7 * ageYears;
}
