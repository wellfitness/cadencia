import {
  expandSessionPlan,
  type SessionTemplate,
  type SessionTemplateId,
} from '@core/segmentation';
import type { HeartRateZone } from '@core/physiology/karvonen';

/**
 * Patrones de barras de intensidad curados a mano para las 8 plantillas
 * estandar. Cada array representa la sesion como una secuencia de N zonas;
 * cada elemento es una barra (~totalSec/N segundos del plan).
 *
 * Los hemos hecho a mano —en lugar de muestrear con un algoritmo— porque:
 * - Solo son 8 plantillas, asi que el coste de mantenerlos es bajo.
 * - El resultado refleja la "lectura visual" que querriamos transmitir
 *   incluso en sesiones con intervalos muy cortos (SIT, HIIT 10-20-30)
 *   donde un sampling automatico promediaria los picos hasta perderlos.
 *
 * Si se anaden mas plantillas o un usuario edita un plan custom, caemos al
 * fallback algoritmico mas abajo (zona dominante por tiempo).
 */
const MANUAL_BARS_24: Partial<Record<SessionTemplateId, readonly HeartRateZone[]>> = {
  // 2 + 20 + 2 = 24
  'recuperacion-activa': [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1],
  // 3 + 18 + 3 = 24
  'zona2-continuo': [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
  // 3 + 6×3 + 3 = 24 — 3 bloques Z3 con micropausa Z2 entre cada uno
  'tempo-mlss': [
    2, 2, 2,
    3, 3, 3, 3, 3, 2,
    3, 3, 3, 3, 3, 2,
    3, 3, 3, 3, 3, 2,
    1, 1, 1,
  ],
  // 4 + 3×5 + 5 = 24 — 5 intervalos Z4 con micropausa Z2 entre cada uno
  'umbral-progresivo': [
    2, 2, 2, 2,
    4, 4, 2,
    4, 4, 2,
    4, 4, 2,
    4, 4, 2,
    4, 4, 2,
    1, 1, 1, 1, 1,
  ],
  // 4 + 4×4 + 4 = 24 — 4 intervalos Z4 (3 barras) con recuperacion Z2 (1 barra)
  'noruego-4x4': [
    2, 2, 2, 2,
    4, 4, 4, 2,
    4, 4, 4, 2,
    4, 4, 4, 2,
    4, 4, 4, 2,
    1, 1, 1, 1,
  ],
  // 5 + 4×4 + 3 = 24 — 4 bloques del 30/20/10, cada uno con 3 barras de
  // sub-ciclo (Z2-Z3-Z6) + 1 barra Z2 de descanso entre series (Bangsbo)
  'hiit-10-20-30': [
    2, 2, 2, 2, 2,
    2, 3, 6, 2,
    2, 3, 6, 2,
    2, 3, 6, 2,
    2, 3, 6, 2,
    1, 1, 1,
  ],
  // 5 + 2×6 + 7 = 24 — 6 intervalos Z5 alternados con recuperacion Z1
  'vo2max-cortos': [
    2, 2, 2, 2, 2,
    5, 1,
    5, 1,
    5, 1,
    5, 1,
    5, 1,
    5, 1,
    1, 1, 1, 1, 1, 1, 1,
  ],
  // 3 + 3×6 + 3 = 24 — 6 sprints Z6 con recuperacion larga Z1
  sit: [
    2, 2, 2,
    6, 1, 1,
    6, 1, 1,
    6, 1, 1,
    6, 1, 1,
    6, 1, 1,
    6, 1, 1,
    1, 1, 1,
  ],
};

/**
 * Version compacta para las cards de TemplateGallery (8 barras), que tienen
 * mucho menos espacio. Mantiene la misma intencion narrativa: warmup + zona
 * o intervalos dominantes + cooldown.
 */
const MANUAL_BARS_8: Partial<Record<SessionTemplateId, readonly HeartRateZone[]>> = {
  'recuperacion-activa': [1, 2, 2, 2, 2, 2, 2, 1],
  'zona2-continuo': [1, 2, 2, 2, 2, 2, 2, 1],
  'tempo-mlss': [2, 3, 2, 3, 2, 3, 2, 1],
  'umbral-progresivo': [2, 4, 2, 4, 2, 4, 2, 1],
  'noruego-4x4': [2, 4, 2, 4, 2, 4, 2, 1],
  'hiit-10-20-30': [2, 6, 2, 6, 2, 6, 2, 1],
  'vo2max-cortos': [2, 5, 1, 5, 1, 5, 1, 1],
  sit: [2, 6, 1, 6, 1, 6, 1, 1],
};

/**
 * Devuelve la representacion en N segmentos de una plantilla. Para las 8
 * plantillas estandar con N=8 o N=24 usa el patron curado a mano (refleja
 * fielmente la estructura). Para cualquier otro caso (planes custom, N
 * inesperado) cae al algoritmo de "zona dominante por tiempo".
 *
 * Funcion pura, determinista. Util para previsualizar plantillas tanto en
 * el constructor (TemplateGallery, N=8) como en el centro de ayuda
 * (TemplateExplainer, N=24) con un mismo render coherente.
 */
export function buildIntensityBars(template: SessionTemplate, n: number): HeartRateZone[] {
  if (n === 24) {
    const manual = MANUAL_BARS_24[template.id];
    if (manual) return [...manual];
  }
  if (n === 8) {
    const manual = MANUAL_BARS_8[template.id];
    if (manual) return [...manual];
  }

  // Fallback: zona dominante por tiempo en cada segmento. Se aplica solo a
  // planes custom o longitudes no curadas. Evita el sampling al punto medio
  // que en sesiones de intervalos cortos daba barras visualmente caoticas.
  const expanded = expandSessionPlan({ name: template.name, items: [...template.items] });
  const totalSec = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
  if (totalSec === 0) return [];
  const segLen = totalSec / n;
  const result: HeartRateZone[] = [];
  for (let i = 0; i < n; i++) {
    const segStart = segLen * i;
    const segEnd = segLen * (i + 1);
    const timeByZone: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let cursor = 0;
    for (const b of expanded.blocks) {
      const blockEnd = cursor + b.durationSec;
      const overlapStart = Math.max(cursor, segStart);
      const overlapEnd = Math.min(blockEnd, segEnd);
      if (overlapEnd > overlapStart) {
        timeByZone[b.zone] += overlapEnd - overlapStart;
      }
      cursor = blockEnd;
      if (cursor >= segEnd) break;
    }
    let dominantZone: HeartRateZone = 1;
    let maxTime = -1;
    for (const z of [6, 5, 4, 3, 2, 1] as const) {
      if (timeByZone[z] > maxTime) {
        maxTime = timeByZone[z];
        dominantZone = z;
      }
    }
    result.push(dominantZone);
  }
  return result;
}

/**
 * Mapeo de zona a clase Tailwind de fondo. Comparte definicion con
 * TemplateGallery para que cualquier renderizado de barras de intensidad luzca
 * igual en toda la app.
 */
export const ZONE_BG_BAR: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};
