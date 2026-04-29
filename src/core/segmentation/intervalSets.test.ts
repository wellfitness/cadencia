import { describe, expect, it } from 'vitest';
import type { CadenceProfile, Phase, SessionBlock } from './sessionPlan';
import type { HeartRateZone } from '../physiology/karvonen';
import { detectIntervalSets } from './intervalSets';

function makeBlock(
  id: string,
  zone: HeartRateZone,
  cadenceProfile: CadenceProfile,
  durationSec: number,
  phase: Phase = 'work',
): SessionBlock {
  return { id, phase, zone, cadenceProfile, durationSec };
}

describe('detectIntervalSets', () => {
  it('lista vacia → lista vacia', () => {
    expect(detectIntervalSets([])).toEqual([]);
  });

  describe('Patron A: work corto Z>=4 + recovery|rest, >=2 ciclos', () => {
    it('SIT canonico 6 ciclos → 1 macrobloque Z6 sprint 1620s', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 6; i++) {
        blocks.push(makeBlock(`s-${i}`, 6, 'sprint', 30, 'work'));
        blocks.push(makeBlock(`r-${i}`, 1, 'flat', 240, 'recovery'));
      }
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]!.zone).toBe(6);
      expect(result[0]!.cadenceProfile).toBe('sprint');
      expect(result[0]!.durationSec).toBe(1620);
      expect(result[0]!.phase).toBe('work');
    });

    it('VO2max Cortos 6 ciclos → 1 macrobloque Z5 climb 1260s', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 6; i++) {
        blocks.push(makeBlock(`w-${i}`, 5, 'climb', 120, 'work'));
        blocks.push(makeBlock(`r-${i}`, 1, 'flat', 90, 'recovery'));
      }
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]!.zone).toBe(5);
      expect(result[0]!.cadenceProfile).toBe('climb');
      expect(result[0]!.durationSec).toBe(1260);
    });

    it('1 ciclo solo → no aplica patron, devuelve igual', () => {
      const blocks: SessionBlock[] = [
        makeBlock('s', 6, 'sprint', 30, 'work'),
        makeBlock('r', 1, 'flat', 240, 'recovery'),
      ];
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('work no corto (240s) → patron A NO aplica (Noruego 4x4)', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 4; i++) {
        blocks.push(makeBlock(`w-${i}`, 4, 'flat', 240, 'work'));
        blocks.push(makeBlock(`r-${i}`, 2, 'flat', 180, 'recovery'));
      }
      const result = detectIntervalSets(blocks);
      expect(result).toEqual(blocks);
    });

    it('work zone < 4 → patron A NO aplica (Tempo MLSS)', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 3; i++) {
        blocks.push(makeBlock(`w-${i}`, 3, 'flat', 720, 'work'));
        blocks.push(makeBlock(`r-${i}`, 2, 'flat', 240, 'recovery'));
      }
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('work corto pero zone < 4 → patron A NO aplica', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 4; i++) {
        blocks.push(makeBlock(`w-${i}`, 3, 'flat', 60, 'work'));
        blocks.push(makeBlock(`r-${i}`, 2, 'flat', 60, 'recovery'));
      }
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('exactamente 180s no es corto (> = umbral)', () => {
      const blocks: SessionBlock[] = [];
      for (let i = 0; i < 4; i++) {
        blocks.push(makeBlock(`w-${i}`, 5, 'climb', 180, 'work'));
        blocks.push(makeBlock(`r-${i}`, 1, 'flat', 60, 'recovery'));
      }
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('zona maxima del set determina la zona del macrobloque', () => {
      // Mezcla Z4 y Z6 en los work
      const blocks: SessionBlock[] = [
        makeBlock('w0', 4, 'flat', 60, 'work'),
        makeBlock('r0', 1, 'flat', 60, 'recovery'),
        makeBlock('w1', 6, 'sprint', 30, 'work'),
        makeBlock('r1', 1, 'flat', 60, 'recovery'),
      ];
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]!.zone).toBe(6);
      expect(result[0]!.cadenceProfile).toBe('sprint');
      expect(result[0]!.durationSec).toBe(60 + 60 + 30 + 60);
    });
  });

  describe('Patron B: >=4 bloques cortos contiguos con al menos un work Z>=4', () => {
    it('HIIT 10-20-30 (4 sets x 5 sub-ciclos) → 1 macrobloque Z6 sprint 1200s', () => {
      const blocks: SessionBlock[] = [];
      for (let r = 0; r < 4; r++) {
        for (const s of ['a', 'b', 'c', 'd', 'e']) {
          blocks.push(makeBlock(`easy-${r}-${s}`, 2, 'flat', 30, 'recovery'));
          blocks.push(makeBlock(`tempo-${r}-${s}`, 3, 'flat', 20, 'work'));
          blocks.push(makeBlock(`sprint-${r}-${s}`, 6, 'sprint', 10, 'work'));
        }
      }
      expect(blocks).toHaveLength(60);
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]!.zone).toBe(6);
      expect(result[0]!.cadenceProfile).toBe('sprint');
      expect(result[0]!.durationSec).toBe(1200);
    });

    it('exactamente 3 bloques cortos no aplica (necesita >=4)', () => {
      const blocks: SessionBlock[] = [
        makeBlock('a', 2, 'flat', 30, 'recovery'),
        makeBlock('b', 6, 'sprint', 10, 'work'),
        makeBlock('c', 2, 'flat', 30, 'recovery'),
      ];
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('4 bloques cortos pero sin work Z>=4 → no aplica', () => {
      const blocks: SessionBlock[] = [
        makeBlock('a', 2, 'flat', 60, 'warmup'),
        makeBlock('b', 2, 'flat', 60, 'warmup'),
        makeBlock('c', 2, 'flat', 60, 'warmup'),
        makeBlock('d', 2, 'flat', 60, 'warmup'),
      ];
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('4 bloques cortos con un work Z6 → aplica', () => {
      const blocks: SessionBlock[] = [
        makeBlock('a', 2, 'flat', 30, 'recovery'),
        makeBlock('b', 3, 'flat', 20, 'work'),
        makeBlock('c', 6, 'sprint', 10, 'work'),
        makeBlock('d', 2, 'flat', 30, 'recovery'),
      ];
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]!.zone).toBe(6);
      expect(result[0]!.durationSec).toBe(90);
    });
  });

  describe('Casos sin patron', () => {
    it('Z2 Continuo → entrada == salida', () => {
      const blocks: SessionBlock[] = [
        makeBlock('w', 1, 'flat', 600, 'warmup'),
        makeBlock('m', 2, 'flat', 3600, 'main'),
        makeBlock('c', 1, 'flat', 600, 'cooldown'),
      ];
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });

    it('Sprint Z6 aislado entre warmup y cooldown → entrada == salida', () => {
      const blocks: SessionBlock[] = [
        makeBlock('w', 2, 'flat', 600, 'warmup'),
        makeBlock('s', 6, 'sprint', 30, 'work'),
        makeBlock('c', 2, 'flat', 300, 'cooldown'),
      ];
      expect(detectIntervalSets(blocks)).toEqual(blocks);
    });
  });

  describe('Composicion: warmup + set + cooldown', () => {
    it('Patron A entre warmup y cooldown → solo el set se fusiona', () => {
      const blocks: SessionBlock[] = [
        makeBlock('warmup', 2, 'flat', 300, 'warmup'),
      ];
      for (let i = 0; i < 6; i++) {
        blocks.push(makeBlock(`s-${i}`, 6, 'sprint', 30, 'work'));
        blocks.push(makeBlock(`r-${i}`, 1, 'flat', 240, 'recovery'));
      }
      blocks.push(makeBlock('cooldown', 1, 'flat', 300, 'cooldown'));
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('warmup');
      expect(result[0]!.phase).toBe('warmup');
      expect(result[1]!.zone).toBe(6);
      expect(result[1]!.durationSec).toBe(1620);
      expect(result[2]!.id).toBe('cooldown');
    });

    it('Patron B entre warmup y cooldown → solo el set se fusiona (HIIT canonico completo)', () => {
      const blocks: SessionBlock[] = [
        makeBlock('warmup', 2, 'flat', 600, 'warmup'),
      ];
      for (let r = 0; r < 4; r++) {
        for (const s of ['a', 'b', 'c', 'd', 'e']) {
          blocks.push(makeBlock(`easy-${r}-${s}`, 2, 'flat', 30, 'recovery'));
          blocks.push(makeBlock(`tempo-${r}-${s}`, 3, 'flat', 20, 'work'));
          blocks.push(makeBlock(`sprint-${r}-${s}`, 6, 'sprint', 10, 'work'));
        }
      }
      blocks.push(makeBlock('cooldown', 1, 'flat', 300, 'cooldown'));
      const result = detectIntervalSets(blocks);
      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('warmup');
      expect(result[1]!.zone).toBe(6);
      expect(result[1]!.durationSec).toBe(1200);
      expect(result[2]!.id).toBe('cooldown');
    });
  });

  it('determinista: misma entrada → misma salida', () => {
    const blocks: SessionBlock[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push(makeBlock(`s-${i}`, 6, 'sprint', 30, 'work'));
      blocks.push(makeBlock(`r-${i}`, 1, 'flat', 240, 'recovery'));
    }
    expect(detectIntervalSets(blocks)).toEqual(detectIntervalSets(blocks));
  });

  it('no muta el array de entrada', () => {
    const blocks: SessionBlock[] = [
      makeBlock('s0', 6, 'sprint', 30, 'work'),
      makeBlock('r0', 1, 'flat', 240, 'recovery'),
      makeBlock('s1', 6, 'sprint', 30, 'work'),
      makeBlock('r1', 1, 'flat', 240, 'recovery'),
    ];
    const snapshot = blocks.map((b) => ({ ...b }));
    detectIntervalSets(blocks);
    expect(blocks).toEqual(snapshot);
  });
});
