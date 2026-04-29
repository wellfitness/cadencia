import { describe, expect, it } from 'vitest';
import type { CadenceProfile, Phase, SessionBlock } from './sessionPlan';
import type { HeartRateZone } from '../physiology/karvonen';
import { coalesceContiguousBlocks } from './coalesceBlocks';

function makeBlock(
  id: string,
  zone: HeartRateZone,
  cadenceProfile: CadenceProfile,
  durationSec: number,
  phase: Phase = 'work',
): SessionBlock {
  return { id, phase, zone, cadenceProfile, durationSec };
}

describe('coalesceContiguousBlocks', () => {
  it('lista vacia → lista vacia', () => {
    expect(coalesceContiguousBlocks([])).toEqual([]);
  });

  it('un solo bloque → mismo bloque (sin sufijo)', () => {
    const block = makeBlock('a', 2, 'flat', 60);
    expect(coalesceContiguousBlocks([block])).toEqual([block]);
  });

  it('run de 3 bloques con (zone, profile, phase) iguales → 1 bloque sumado', () => {
    const blocks = [
      makeBlock('a', 2, 'flat', 60, 'warmup'),
      makeBlock('b', 2, 'flat', 60, 'warmup'),
      makeBlock('c', 2, 'flat', 60, 'warmup'),
    ];
    const result = coalesceContiguousBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0]!.zone).toBe(2);
    expect(result[0]!.cadenceProfile).toBe('flat');
    expect(result[0]!.phase).toBe('warmup');
    expect(result[0]!.durationSec).toBe(180);
    expect(result[0]!.id).toBe('a-coalesced');
  });

  it('cadenceProfile distinto con misma zone → NO fusiona', () => {
    const blocks = [
      makeBlock('a', 3, 'flat', 60),
      makeBlock('b', 3, 'climb', 60),
    ];
    expect(coalesceContiguousBlocks(blocks)).toEqual(blocks);
  });

  it('zone distinta con mismo profile → NO fusiona', () => {
    const blocks = [
      makeBlock('a', 2, 'flat', 60),
      makeBlock('b', 3, 'flat', 60),
    ];
    expect(coalesceContiguousBlocks(blocks)).toEqual(blocks);
  });

  it('phase distinta con misma zone+profile → NO fusiona (preserva semantica de phase)', () => {
    const blocks = [
      makeBlock('a', 2, 'flat', 60, 'warmup'),
      makeBlock('b', 2, 'flat', 60, 'work'),
    ];
    expect(coalesceContiguousBlocks(blocks)).toEqual(blocks);
  });

  it('mezcla de runs y aislados intercalados', () => {
    const blocks = [
      makeBlock('w1', 2, 'flat', 60, 'warmup'),
      makeBlock('w2', 2, 'flat', 60, 'warmup'),
      makeBlock('s1', 6, 'sprint', 30, 'work'),
      makeBlock('r1', 1, 'flat', 120, 'recovery'),
      makeBlock('r2', 1, 'flat', 120, 'recovery'),
      makeBlock('c1', 2, 'flat', 60, 'cooldown'),
    ];
    const result = coalesceContiguousBlocks(blocks);
    expect(result).toHaveLength(4);
    expect(result[0]!.durationSec).toBe(120); // run warmup
    expect(result[0]!.id).toBe('w1-coalesced');
    expect(result[1]!.id).toBe('s1'); // sprint aislado
    expect(result[1]!.durationSec).toBe(30);
    expect(result[2]!.durationSec).toBe(240); // run recovery
    expect(result[2]!.id).toBe('r1-coalesced');
    expect(result[3]!.id).toBe('c1'); // cooldown aislado
  });

  it('determinista: misma entrada → misma salida', () => {
    const blocks = [
      makeBlock('a', 2, 'flat', 60),
      makeBlock('b', 2, 'flat', 60),
    ];
    const r1 = coalesceContiguousBlocks(blocks);
    const r2 = coalesceContiguousBlocks(blocks);
    expect(r1).toEqual(r2);
  });

  it('no muta el array de entrada', () => {
    const blocks = [
      makeBlock('a', 2, 'flat', 60),
      makeBlock('b', 2, 'flat', 60),
    ];
    const snapshot = blocks.map((b) => ({ ...b }));
    coalesceContiguousBlocks(blocks);
    expect(blocks).toEqual(snapshot);
  });
});
