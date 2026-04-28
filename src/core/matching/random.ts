/**
 * PRNG determinista para introducir variedad controlada en la seleccion de
 * tracks por segmento. La función `matchTracksToSegments` sigue siendo pura
 * dada una semilla: misma `(segmentos, tracks, preferences, seed)` -> mismo
 * resultado. Sin semilla, comportamiento legacy (top-1, totalmente
 * determinista) — los tests historicos siguen pasando intactos.
 *
 * Algoritmo: mulberry32. Pequeño (5 lineas), distribucion uniforme, periodo
 * 2^32 (suficiente para una playlist de cientos de slots).
 *
 * Por slot usamos una sub-semilla `hashSeed(seed, slotIndex)` para que dos
 * sesiones con la misma semilla produzcan exactamente la misma asignacion
 * tramo a tramo, pero los streams de cada tramo sean independientes — no
 * basta con avanzar el mismo PRNG porque los slots tienen distintos pools
 * de candidatos y avanzariamos a diferente ritmo.
 */

export type Prng = () => number;

export function mulberry32(seed: number): Prng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mezcla seed + slotIndex en una sub-semilla descorrelada. Constante
 * 2654435761 = 0x9E3779B1, golden-ratio hash de Knuth, distribuye bien.
 */
export function hashSeed(seed: number, slotIndex: number): number {
  return (Math.imul(seed ^ slotIndex, 2654435761) ^ (slotIndex << 13)) >>> 0;
}

/**
 * Sampling ponderado por score entre los top-K candidatos (ya ordenados
 * desc). Los pesos se normalizan a `score - minScore + epsilon` para que
 * incluso en empates a score=0 cada candidato tenga probabilidad no nula.
 */
export function pickWeightedFromTopK<T extends { score: number }>(
  candidates: readonly T[],
  prng: Prng,
  k: number,
): T | null {
  if (candidates.length === 0) return null;
  const top = candidates.slice(0, Math.min(k, candidates.length));
  const minScore = Math.min(...top.map((c) => c.score));
  const epsilon = 0.01;
  const weights = top.map((c) => c.score - minScore + epsilon);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = prng() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return top[i]!;
  }
  return top[top.length - 1] ?? null;
}
