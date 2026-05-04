import type { SessionBlock } from './sessionPlan';

/**
 * Fusiona runs contiguos de bloques con misma (zone, cadenceProfile, phase).
 * El bloque resultante hereda los campos del primer bloque del run, suma
 * durationSec y recibe el sufijo `-coalesced` en el id.
 *
 * Se exige que la phase tambien coincida para preservar la semantica que el
 * detector de patrones interválicos usa aguas abajo (work, recovery, etc.).
 *
 * Determinista, puro, sin acceso a tipos de UI.
 */
export function coalesceContiguousBlocks(blocks: readonly SessionBlock[]): SessionBlock[] {
  if (blocks.length === 0) return [];
  const out: SessionBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const first = blocks[i]!;
    let j = i + 1;
    while (
      j < blocks.length &&
      blocks[j]!.zone === first.zone &&
      blocks[j]!.cadenceProfile === first.cadenceProfile &&
      blocks[j]!.phase === first.phase
    ) {
      j++;
    }
    if (j - i === 1) {
      out.push(first);
    } else {
      const totalDuration = blocks
        .slice(i, j)
        .reduce((acc, b) => acc + Math.max(0, b.durationSec), 0);
      out.push({
        ...first,
        id: `${first.id}-coalesced`,
        durationSec: totalDuration,
      });
    }
    i = j;
  }
  return out;
}
