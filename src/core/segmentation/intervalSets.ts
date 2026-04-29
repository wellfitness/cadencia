import type { HeartRateZone } from '../physiology/karvonen';
import type { SessionBlock } from './sessionPlan';

/**
 * Umbral por debajo del cual un bloque cuenta como "corto" para el detector
 * de patrones interválicos. Frontera elegida tras inspeccionar las plantillas
 * reales: por debajo de 180s caen SIT (30s), HIIT 10-20-30 (10-30s) y VO2max
 * Cortos (120s); por encima quedan Noruego 4×4 (240s), Tempo MLSS (720s) y
 * Umbral Progresivo (300s).
 */
const SHORT_BLOCK_THRESHOLD_SEC = 180;

/**
 * Umbral por encima del cual un bloque de recovery/rest se considera
 * "descanso entre sets" (no parte del estimulo continuo) y rompe el patron
 * B. Frontera fisiologica: a partir de ~90s la FC y el lactato bajan lo
 * suficiente para que el cuerpo entre en modo recuperacion real. Por debajo
 * (los 30s "suaves" del 10-20-30) el sistema sigue cargado y la pausa es
 * parte del intervalo. Coherente con el recovery de 90s de VO2max-cortos
 * (que NO debe romperse — pero usa Patron A, no este).
 */
const LONG_RECOVERY_THRESHOLD_SEC = 90;

/** Zona considerada "alta" — donde la queja del usuario es crítica. */
const HIGH_ZONE_MIN: HeartRateZone = 4;

function isShort(b: SessionBlock): boolean {
  return b.durationSec < SHORT_BLOCK_THRESHOLD_SEC;
}

function isShortWorkHigh(b: SessionBlock): boolean {
  return b.phase === 'work' && b.zone >= HIGH_ZONE_MIN && isShort(b);
}

function isRecoveryOrRest(b: SessionBlock): boolean {
  return b.phase === 'recovery' || b.phase === 'rest';
}

/**
 * Construye el SessionBlock virtual que representa un set interválico
 * completo. Toma la zona maxima de los bloques work del set (o de todo el
 * set si no hay work) y el cadenceProfile del bloque dominante.
 */
function buildMacroBlock(setBlocks: readonly SessionBlock[], descriptor: string): SessionBlock {
  const candidates = setBlocks.filter((b) => b.phase === 'work');
  const pool = candidates.length > 0 ? candidates : [...setBlocks];
  const dominant = pool.reduce((best, b) => (b.zone > best.zone ? b : best), pool[0]!);
  const totalDuration = setBlocks.reduce((acc, b) => acc + b.durationSec, 0);
  return {
    id: `interval-set-${setBlocks[0]!.id}`,
    phase: 'work',
    zone: dominant.zone,
    cadenceProfile: dominant.cadenceProfile,
    durationSec: totalDuration,
    description: `Set interválico Z${dominant.zone} (${descriptor})`,
  };
}

/**
 * Patron A: secuencia de >=2 ciclos consecutivos de
 * [work corto Z>=4 + recovery|rest]. Devuelve el indice fin (exclusivo) del
 * set y el numero de ciclos detectados, o null si el patron no aplica desde
 * la posicion start.
 */
function detectPatternA(
  blocks: readonly SessionBlock[],
  start: number,
): { endExclusive: number; cycles: number } | null {
  let cycles = 0;
  let j = start;
  while (j + 1 < blocks.length) {
    if (!isShortWorkHigh(blocks[j]!)) break;
    if (!isRecoveryOrRest(blocks[j + 1]!)) break;
    cycles++;
    j += 2;
  }
  return cycles >= 2 ? { endExclusive: j, cycles } : null;
}

/**
 * Patron B: secuencia de >=4 bloques contiguos cortos (<180s) donde al menos
 * uno es work con zone >= 4. Captura sets interválicos multi-fase como
 * HIIT 10-20-30 que no encajan con el patron A.
 *
 * Cierra el set al encontrar un recovery/rest "largo" (>=90s) — eso indica
 * descanso entre series, no parte del estimulo continuo. Asi el HIIT
 * 10-20-30 con 2 min de recuperacion entre los 4 bloques se fusiona en 4
 * macrobloques separados, no en uno gigante: la musica suave puede sonar
 * en las pausas reales mientras los 30s "suaves" intra-serie siguen
 * tratandose como parte del intervalo Z6.
 */
function detectPatternB(
  blocks: readonly SessionBlock[],
  start: number,
): { endExclusive: number; blockCount: number } | null {
  let j = start;
  while (j < blocks.length && isShort(blocks[j]!)) {
    const b = blocks[j]!;
    if (isRecoveryOrRest(b) && b.durationSec >= LONG_RECOVERY_THRESHOLD_SEC) {
      break;
    }
    j++;
  }
  const window = blocks.slice(start, j);
  if (window.length < 4) return null;
  const hasWorkHigh = window.some(
    (b) => b.phase === 'work' && b.zone >= HIGH_ZONE_MIN,
  );
  if (!hasWorkHigh) return null;
  return { endExclusive: j, blockCount: window.length };
}

/**
 * Detecta sets interválicos en una lista de bloques y los sustituye por un
 * unico SessionBlock virtual con zona = la mayor del set y duracion = suma
 * de las duraciones del set.
 *
 * Resuelve el caso prohibido: que un track de zona baja (recovery) suene
 * durante un intervalo de zona alta. El macrobloque hace que el matcher
 * elija solo tracks de zona alta para todo el set, lo cual coincide con
 * como se programa la musica en una clase real de cycling indoor.
 *
 * Determinista, puro. No anida sets (top-down, primer match gana).
 */
export function detectIntervalSets(blocks: readonly SessionBlock[]): SessionBlock[] {
  const out: SessionBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const a = detectPatternA(blocks, i);
    if (a) {
      out.push(
        buildMacroBlock(
          blocks.slice(i, a.endExclusive),
          `${a.cycles} ciclo${a.cycles === 1 ? '' : 's'}`,
        ),
      );
      i = a.endExclusive;
      continue;
    }
    const b = detectPatternB(blocks, i);
    if (b) {
      out.push(
        buildMacroBlock(
          blocks.slice(i, b.endExclusive),
          `${b.blockCount} bloques cortos`,
        ),
      );
      i = b.endExclusive;
      continue;
    }
    out.push(blocks[i]!);
    i++;
  }
  return out;
}
