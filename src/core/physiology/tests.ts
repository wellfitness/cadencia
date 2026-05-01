/**
 * Formulas puras de los seis tests fisiologicos guiados de Cadencia.
 *
 * Cada funcion es deterministica, sin imports de DOM/React, y se testea por
 * separado en `tests.test.ts`. Las plantillas-test en
 * `src/core/segmentation/sessionTemplates.ts` referencian estas funciones
 * dentro de su `testProtocol.compute()` para producir un `TestResult` que
 * el modal post-sesion guarda en `cadenciaStore.userInputs`.
 *
 * Refs principales:
 * - Bike rampa: Michalik 2019 (10.23736/S0022-4707.19.09126-6),
 *   Valenzuela 2018 (10.1123/ijspp.2018-0008).
 * - Bike 5-min PAM: Sitko 2021 (10.1123/ijspp.2020-0923).
 * - Bike 3MT: Vanhatalo 2007 (10.1249/mss.0b013e31802dd3e6),
 *   Black 2013 (10.1080/17461391.2013.810306).
 * - Run FCmax Daniels: Zhou 2001 (10.1097/00005768-200111000-00008) +
 *   Daniels Running Formula.
 * - Run 30-15 IFT: Buchheit 2011 (10.1519/JSC.0b013e3181d686b7).
 */

/* ------------------------------------------------------------------ */
/* BIKE — Test de rampa                                                */
/* ------------------------------------------------------------------ */

/**
 * FTP estimada a partir de la Maximal Aerobic Power (MAP) del test de rampa.
 *
 * Factor 0.75 — convencion estandar de la industria (Zwift, TrainerRoad).
 * La rampa lineal (~25 W/min) es un protocolo recreativo viable que sustituye
 * al test de 20 min de Coggan, mas exigente psicologicamente.
 *
 * Limitacion documentada en UI: en ciclistas recreativos FTP tiende a quedar
 * un 5-7 % por debajo del LT real (Valenzuela 2018).
 *
 * @param maxAerobicPowerWatts MAP = potencia minuto pico del test (W).
 * @returns FTP estimada en vatios, redondeada al entero.
 */
export function ftpFromRampMap(maxAerobicPowerWatts: number): number {
  if (!Number.isFinite(maxAerobicPowerWatts) || maxAerobicPowerWatts <= 0) {
    throw new RangeError(`Invalid MAP: ${maxAerobicPowerWatts}`);
  }
  return Math.round(0.75 * maxAerobicPowerWatts);
}

/* ------------------------------------------------------------------ */
/* BIKE — Test 5-min PAM                                                */
/* ------------------------------------------------------------------ */

/**
 * VO2max estimado desde la potencia media del test 5-min all-out.
 *
 * Sitko 2021 — regresion bayesiana sobre 46 ciclistas amateur:
 *   VO2max (mL/kg/min) = 16.6 + 8.87 * (P5min / weight)
 *   R^2 95 % CI = 0.61–0.77.
 *
 * El test cubre dos datos de un solo esfuerzo: la potencia media estima
 * VO2max y la FC pico al final del 5' aproxima FCmax (la propia plantilla
 * pide el peakHr como segundo input).
 *
 * @param meanPower5MinWatts Potencia media de los 5 minutos all-out (W).
 * @param weightKg Peso corporal del usuario (kg).
 * @returns VO2max estimado en mL/kg/min (sin redondear).
 */
export function vo2maxFromMap5(meanPower5MinWatts: number, weightKg: number): number {
  if (!Number.isFinite(meanPower5MinWatts) || meanPower5MinWatts <= 0) {
    throw new RangeError(`Invalid power: ${meanPower5MinWatts}`);
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new RangeError(`Invalid weight: ${weightKg}`);
  }
  const relativePower = meanPower5MinWatts / weightKg;
  return 16.6 + 8.87 * relativePower;
}

/* ------------------------------------------------------------------ */
/* BIKE — Test 3MT (Vanhatalo)                                          */
/* ------------------------------------------------------------------ */

export interface CpResult {
  /** Critical Power (W). En el 3MT equivale al "End-test power" (EP). */
  cp: number;
  /** W' (J): trabajo realizado por encima de CP durante los 180 s. */
  wPrime: number;
}

/**
 * Critical Power y W′ a partir del test 3-min all-out de Vanhatalo.
 *
 * Protocolo (Vanhatalo, Doust & Burnley 2007): 3 minutos all-out CONTRA
 * RESISTENCIA FIJA. EP = potencia media de los ultimos 30 s = CP.
 * W′ = trabajo total - (EP * 180 s).
 *
 * Validez en 8/10 sujetos a ±5 W vs CP convencional. Predictive validity
 * r = -0.83 con TT 16.1 km (Black 2013).
 *
 * IMPORTANTE — disclaimer de hardware: el rodillo debe estar en modo
 * NIVEL/SLOPE (resistencia fija), NO en modo ERG (resistencia auto-ajustada
 * a una potencia objetivo). En ERG el resultado es invalido sin error visible.
 * Este disclaimer se renderiza en la UI desde `testProtocol.hardwareDisclaimer`.
 *
 * @param meanPowerLast30sWatts Potencia media de los ultimos 30 s del test (W).
 * @param totalWorkJoules Trabajo total realizado en los 180 s del test (J).
 * @returns { cp, wPrime } en W y J respectivamente. wPrime se clampa a 0 si
 *   los datos son inconsistentes (totalWork < cp*180).
 */
export function cpFrom3MT(
  meanPowerLast30sWatts: number,
  totalWorkJoules: number,
): CpResult {
  if (!Number.isFinite(meanPowerLast30sWatts) || meanPowerLast30sWatts <= 0) {
    throw new RangeError(`Invalid CP power: ${meanPowerLast30sWatts}`);
  }
  if (!Number.isFinite(totalWorkJoules) || totalWorkJoules <= 0) {
    throw new RangeError(`Invalid total work: ${totalWorkJoules}`);
  }
  const cp = meanPowerLast30sWatts;
  const wPrime = Math.max(0, totalWorkJoules - cp * 180);
  return { cp, wPrime };
}

/* ------------------------------------------------------------------ */
/* RUN — Test FCmax Daniels (4'+1'+3')                                  */
/* ------------------------------------------------------------------ */

/**
 * FCmax = FC pico del ultimo minuto del test Daniels.
 *
 * El protocolo (4 min duro + 1 min recovery + 3 min all-out) esta dise~nado
 * para alcanzar el plateau cardiovascular en ≤10 min de esfuerzo. La FC pico
 * registrada es la FCmax real del usuario, mas fiable que cualquier formula
 * por edad (Gulati/Tanaka tienen ±10 bpm de error).
 *
 * Esta funcion es un passthrough con validacion de rango (100-230 bpm) por
 * homogeneidad con las demas: el dato bruto YA es la FCmax. La validacion
 * captura errores de tecleo evidentes.
 *
 * @param peakHrBpm FC pico registrada por el pulsometro durante el test.
 * @returns FCmax en bpm, redondeada al entero.
 */
export function maxHrFromPeak(peakHrBpm: number): number {
  if (!Number.isFinite(peakHrBpm) || peakHrBpm < 100 || peakHrBpm > 230) {
    throw new RangeError(`Invalid peak HR: ${peakHrBpm}`);
  }
  return Math.round(peakHrBpm);
}

/* ------------------------------------------------------------------ */
/* RUN — Test 5-min all-out                                             */
/* ------------------------------------------------------------------ */

/**
 * LTHR (FC umbral aproximada) desde la FC media de un 5-min all-out en running.
 *
 * En un esfuerzo all-out de 5 min, la FC media tipicamente cae en el 92-95 %
 * de la FCmax y se aproxima razonablemente a la LTHR clasica de Joe Friel
 * (FC media de los ultimos 20 min de un TT de 30 min). Es una estimacion,
 * no una medida directa: la UI lo deja claro al mostrarlo.
 *
 * @param meanHrBpm FC media durante los 5 minutos del test (bpm).
 * @returns LTHR estimada en bpm, redondeada al entero.
 */
export function lthrFrom5MinMeanHr(meanHrBpm: number): number {
  if (!Number.isFinite(meanHrBpm) || meanHrBpm < 100 || meanHrBpm > 230) {
    throw new RangeError(`Invalid mean HR: ${meanHrBpm}`);
  }
  return Math.round(meanHrBpm);
}

/* ------------------------------------------------------------------ */
/* RUN — Test 30-15 IFT (Buchheit)                                      */
/* ------------------------------------------------------------------ */

/**
 * vMAS (Velocidad Aerobica Maxima, km/h) desde el ultimo estadio completado
 * del 30-15 Intermittent Fitness Test.
 *
 * Protocolo (Buchheit 2011): correr 30 s + descanso 15 s con velocidad
 * creciente +0.5 km/h en cada estadio (audio + conos cada 40 m). Stage 1 =
 * 8 km/h. vMAS = velocidad del ultimo stage que el corredor completa antes
 * del agotamiento.
 *
 * vMAS es informativa en Cadencia V1 (no alimenta el motor de matching).
 * El valor de este test esta en su FC pico (que SI alimenta `maxHeartRate`).
 *
 * @param lastCompletedStage Numero del ultimo estadio completado (1-50).
 * @returns vMAS en km/h.
 */
export function vMasFromBuchheitStage(lastCompletedStage: number): number {
  if (
    !Number.isFinite(lastCompletedStage) ||
    lastCompletedStage < 1 ||
    lastCompletedStage > 50
  ) {
    throw new RangeError(`Invalid stage: ${lastCompletedStage}`);
  }
  return 8 + 0.5 * (lastCompletedStage - 1);
}
