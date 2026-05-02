import type { HeartRateZone } from '../physiology/karvonen';
import type { BikeType, ValidatedUserInputs } from '../user/userInputs';

/**
 * Zonas Coggan en porcentaje de FTP, modelo de 6 zonas (estandar PDF curso
 * ciclo indoor + Coggan):
 *
 *   Z1 < 55%        Recuperacion completa
 *   Z2 55-75%       Recuperacion activa
 *   Z3 75-90%       Tempo / MLSS
 *   Z4 90-105%      Potencia umbral / VT2
 *   Z5 105-120%     VT2 / PAM (muros)
 *   Z6 >= 120%      Supramaxima (sprint)
 */
function ratioToCogganZone(ratio: number): HeartRateZone {
  if (ratio < 0.55) return 1;
  if (ratio < 0.75) return 2;
  if (ratio < 0.9) return 3;
  if (ratio < 1.05) return 4;
  if (ratio < 1.2) return 5;
  return 6;
}

/**
 * Tabla de "floor" de zona en funcion de la pendiente y el tipo de bici.
 *
 * El modelo de potencia mecanica (gravedad + rodadura + aero) es matematicamente
 * correcto y CONSISTENTE entre tipos de bici cuando la potencia esta fija. El
 * problema en gravel/MTB es que el GPX captura una velocidad media baja por:
 *   - Crr efectivo dinamico (barro, raices, grava suelta) muy variable y >>0.012.
 *   - Micro-paradas tecnicas (sortear obstaculos, plantar pie) que tiran abajo
 *     la velocidad media sin que la FC del ciclista baje.
 *   - Coste metabolico de equilibrio/control que no se traduce en potencia
 *     traslacional medida.
 *
 * Como la pendiente sale limpia del GPX y correlaciona con esfuerzo cardio
 * independientemente de la superficie, la usamos como suelo minimo de zona en
 * gravel/MTB. Carretera tambien tiene tabla pero permisiva (rara vez activa
 * porque Coggan ya funciona bien sobre asfalto).
 *
 * En la misma pendiente fuerte la jerarquia es road < gravel <= mtb, reflejando
 * que el coste cardiovascular de subir esa pendiente crece con la "tax" tecnica
 * de la superficie.
 *
 * Tabla calibrada empiricamente para coincidir con el esfuerzo percibido tipico
 * en cada superficie. Pendientes negativas o llano no aplican floor (Z1).
 */
const BIKE_SLOPE_FLOOR_TABLE: Record<BikeType, ReadonlyArray<readonly [number, HeartRateZone]>> = {
  // Carretera: floor permisivo, Coggan suele ganar el max.
  road: [
    [3, 2],
    [5, 3],
    [7, 4],
    [9, 5],
    [12, 6],
  ],
  // Gravel: floor moderado.
  gravel: [
    [2, 2],
    [4, 3],
    [6, 4],
    [8, 5],
    [11, 6],
  ],
  // MTB: floor estricto. Subir 7% en MTB tecnico ya es muros (Z5) por defecto.
  mtb: [
    [2, 2],
    [3, 3],
    [5, 4],
    [7, 5],
    [10, 6],
  ],
};

/**
 * Devuelve la zona minima (floor) que la pendiente impone en una superficie
 * dada. Funcion pura: misma entrada -> misma salida, sin dependencias del DOM.
 *
 * @param slopePercent pendiente en porcentaje (5 = subir 5%, -3 = bajar 3%)
 * @param bikeType tipo de bici, calibra la severidad del floor
 * @returns zona minima Z1-Z6 que se debe asignar al segmento
 */
export function bikeSlopeFloorZone(slopePercent: number, bikeType: BikeType): HeartRateZone {
  if (!Number.isFinite(slopePercent) || slopePercent < 0) return 1;
  let zone: HeartRateZone = 1;
  for (const [minSlope, z] of BIKE_SLOPE_FLOOR_TABLE[bikeType]) {
    if (slopePercent >= minSlope) zone = z;
  }
  return zone;
}

/**
 * Clasifica un bloque ciclista (potencia media estimada, pendiente media) en
 * una zona Z1-Z6 combinando dos senales:
 *
 *   1. Coggan estricto sobre %FTP (si el usuario tiene FTP).
 *   2. Floor por pendiente segun tipo de bici (siempre).
 *
 * La zona final = max(Coggan, floor). Justificacion en el comentario de
 * BIKE_SLOPE_FLOOR_TABLE arriba: el modelo de potencia mecanica subestima el
 * esfuerzo cardiovascular en superficies de baja velocidad, asi que la
 * pendiente actua como red de seguridad para evitar que una rampa fuerte en
 * gravel/MTB se clasifique como Z1/Z2 solo porque la velocidad media GPX es
 * baja por terreno tecnico.
 *
 * Si el usuario NO aporta FTP devolvemos directamente el floor: no hay info
 * de potencia fiable, asi que usamos solo la pendiente como proxy. Mas honesto
 * que inventar un FTP generico de 2.5 W/kg que arrastraria todo a Z1/Z2 cuando
 * la potencia GPX-derivada es baja en gravel/MTB.
 */
export function classifyZone(
  avgPowerWatts: number,
  slopePercent: number,
  validated: ValidatedUserInputs,
): HeartRateZone {
  const floor = bikeSlopeFloorZone(slopePercent, validated.bikeType);

  if (!validated.hasFtp || validated.ftpWatts === null || validated.ftpWatts <= 0) {
    return floor;
  }

  const ratio = avgPowerWatts / validated.ftpWatts;
  const cogganZone = ratioToCogganZone(ratio);
  return cogganZone > floor ? cogganZone : floor;
}
