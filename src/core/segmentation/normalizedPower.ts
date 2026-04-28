/**
 * Muestra de potencia (vatios) durante un intervalo. Permite series con dt
 * irregular (ej. GPX donde algunos puntos están a 1s y otros a 5-10s).
 */
export interface PowerSample {
  powerWatts: number;
  durationSec: number;
}

const ROLLING_WINDOW_SEC = 30;

/**
 * Normalized Power (NP) según el algoritmo original de Andrew Coggan:
 *
 *   1. Resamplear la potencia a una malla de 1 s (aquí: replicar el valor
 *      del segmento original en cada segundo que cubre).
 *   2. Aplicar una media móvil de 30 s sobre la malla 1 s.
 *   3. Elevar cada valor de la media móvil a la 4ª potencia.
 *   4. Calcular la media aritmética.
 *   5. Tomar la raíz 4ª.
 *
 * Por qué: la 4ª potencia modela la respuesta metabólica desproporcionada
 * a esfuerzos altos. La media móvil de 30 s captura la inercia
 * fisiológica (no respondes instantáneamente a un sprint de 3 s). La
 * versión sobre bloques de 60 s (la previa) sobre-suavizaba: un sprint
 * de 30 s dentro de un bloque de 60 s desaparece, y NP subestimaba.
 *
 * Si la serie total es < 30 s no hay ventana suficiente para el rolling
 * y devolvemos la media simple (caso degenerado de rutas muy cortas).
 */
export function calculateNormalizedPower(samples: readonly PowerSample[]): number {
  if (samples.length === 0) return 0;

  // 1. Resample a malla de 1s. Para cada segmento de duracionSec=N, replicamos
  //    el valor N veces. Para durationSec fraccionarios usamos floor y
  //    acumulamos el resto al siguiente segmento (no perdemos energía total).
  const power1s: number[] = [];
  let carry = 0;
  for (const s of samples) {
    const total = s.durationSec + carry;
    const whole = Math.floor(total);
    carry = total - whole;
    for (let i = 0; i < whole; i++) power1s.push(s.powerWatts);
  }
  // Resto final: si queda al menos medio segundo sin asignar, lo añadimos
  // como una muestra extra al precio de la última potencia.
  if (carry >= 0.5 && samples.length > 0) {
    power1s.push(samples[samples.length - 1]!.powerWatts);
  }

  if (power1s.length === 0) return 0;

  // 2. Caso degenerado: serie demasiado corta para la ventana de 30s.
  if (power1s.length < ROLLING_WINDOW_SEC) {
    return power1s.reduce((a, b) => a + b, 0) / power1s.length;
  }

  // 3. Rolling mean de 30s con prefix-sum incremental + ^4 acumulado.
  let windowSum = 0;
  for (let i = 0; i < ROLLING_WINDOW_SEC; i++) windowSum += power1s[i]!;

  let np4Sum = Math.pow(windowSum / ROLLING_WINDOW_SEC, 4);
  let count = 1;

  for (let i = ROLLING_WINDOW_SEC; i < power1s.length; i++) {
    windowSum += power1s[i]! - power1s[i - ROLLING_WINDOW_SEC]!;
    np4Sum += Math.pow(windowSum / ROLLING_WINDOW_SEC, 4);
    count++;
  }

  return Math.pow(np4Sum / count, 0.25);
}
