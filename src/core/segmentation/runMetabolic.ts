import type { HeartRateZone } from '../physiology/karvonen';

/**
 * Coste energetico de carrera (J/kg/m) en funcion de la pendiente del terreno.
 *
 * A diferencia del ciclismo (donde la velocidad domina la ecuacion de potencia
 * por la aerodinamica), en running el Cr depende SOLO de la pendiente y es
 * INDEPENDIENTE de la velocidad. Esto simplifica el motor outdoor de running:
 * no necesitamos peso ni velocidad, solo el perfil de elevacion del GPX.
 *
 * Modelo: polinomio empirico de quinto grado ajustado a los datos de
 *   Minetti et al. 2002 (J Appl Physiol — DOI 10.1152/japplphysiol.01177.2001),
 * obtenidos sobre 10 runners en cinta entre -45% y +45% de pendiente.
 *
 *   Cr(g) = 155.4·g^5 - 30.4·g^4 - 43.3·g^3 + 46.3·g^2 + 19.5·g + 3.6
 *
 * donde g es la pendiente en fraccion (no en porcentaje). El polinomio captura
 * la forma "U" del coste en bajada: minimo a g ≈ -0.20 (~1.8 J/kg/m, 50% del
 * llano) y vuelve a subir en bajadas mas pronunciadas por la carga excentrica.
 *
 * Valores de referencia (medidos por Minetti 2002, abstract):
 *   g=0    -> 3.40 J/kg/m (llano, independiente de velocidad)
 *   g=-0.20 -> 1.73 J/kg/m (minimo)
 *   g=-0.45 -> 3.92 J/kg/m (extremo descendente, carga excentrica)
 *   g=+0.45 -> 18.93 J/kg/m (extremo ascendente)
 *
 * El polinomio reproduce los valores medidos con error < 10% en el rango
 * [-0.45, +0.45], pero da 3.6 en g=0 (no 3.4 medido). Es el sesgo conocido del
 * fit polinomico; ver comentario en FLAT_CR_J_PER_KG_M abajo. Funcion pura.
 */

/**
 * Coste energetico en llano segun el polinomio (J/kg/m). Es el termino
 * independiente: Cr(0) = 3.6. Lo usamos como referencia del multiplicador
 * para que multiplier(0) = 1.0 exacto. El valor medido por Minetti 2002 es
 * 3.40 J/kg/m (~6% inferior al polinomio); usar el valor medido como
 * referencia introduciria un sesgo sistematico (multiplier ≈ 1.06 en llano).
 */
const FLAT_CR_J_PER_KG_M = 3.6;

/**
 * Pendientes mas alla de este rango son extrapolacion no validada y suelen
 * ser ruido del GPS en GPX reales. Las clampamos para que la funcion sea
 * robusta a entradas patologicas.
 */
const MAX_SLOPE_PERCENT = 50;
const MIN_SLOPE_PERCENT = -50;

function clampSlopePercent(slopePercent: number): number {
  if (!Number.isFinite(slopePercent)) return 0;
  return Math.max(MIN_SLOPE_PERCENT, Math.min(MAX_SLOPE_PERCENT, slopePercent));
}

/**
 * Calcula el coste energetico de correr (J/kg/m) para una pendiente dada.
 * Polinomio de Minetti 2002.
 *
 * @param slopePercent pendiente en porcentaje (5 = subir 5%, -10 = bajar 10%)
 * @returns Cr en J/kg/m, siempre > 0.
 */
export function runEnergyCostJoulesPerKgM(slopePercent: number): number {
  const g = clampSlopePercent(slopePercent) / 100;
  const g2 = g * g;
  const g3 = g2 * g;
  const g4 = g2 * g2;
  const g5 = g4 * g;
  const cr = 155.4 * g5 - 30.4 * g4 - 43.3 * g3 + 46.3 * g2 + 19.5 * g + 3.6;
  // El polinomio puede dar valores ligeramente negativos cerca del minimo por
  // ruido del fit. Acotamos a un piso fisiologico minimo (~0.5 J/kg/m).
  return Math.max(0.5, cr);
}

/**
 * Multiplicador metabolico relativo al llano. =1 en llano, ~5.6x en +45%,
 * minimo ~0.53x a -20%, vuelve a subir hacia ~1.18x en -45%.
 *
 * Este es el "proxy de intensidad" que usamos para mapear pendiente -> zona.
 */
export function runMetabolicMultiplier(slopePercent: number): number {
  return runEnergyCostJoulesPerKgM(slopePercent) / FLAT_CR_J_PER_KG_M;
}

/**
 * Mapea una pendiente a la zona de carrera (Z1-Z6) usando el multiplicador
 * metabolico como proxy de intensidad.
 *
 * Tabla de zonas (basada en la curva de Minetti):
 *   multiplier < 0.75  -> Z1  (bajada moderada, recovery, minimo metabolico)
 *   0.75 - 1.05         -> Z2  (llano, base aerobica)
 *   1.05 - 1.40         -> Z3  (subida 2-5%, tempo)
 *   1.40 - 2.00         -> Z4  (subida 5-10%, umbral)
 *   2.00 - 2.50         -> Z5  (subida 10-15%, VO2max)
 *   >= 2.50              -> Z6  (subida >15%, anaerobico, muros)
 *
 * Nota sobre bajadas extremas: a partir de g < -0.20 el multiplicador vuelve
 * a subir por carga excentrica/control. La tabla mapea correctamente: g=-0.30
 * cae en Z1 (todavia bajo, ~0.72x), g=-0.40 cae en Z2 (~1.06x), g=-0.45 cae
 * en Z2 (~1.18x). Esto refleja que las bajadas muy pronunciadas no son recovery.
 */
export function slopeToRunZone(slopePercent: number): HeartRateZone {
  const m = runMetabolicMultiplier(slopePercent);
  if (m < 0.75) return 1;
  if (m < 1.05) return 2;
  if (m < 1.4) return 3;
  if (m < 2.0) return 4;
  if (m < 2.5) return 5;
  return 6;
}
