import { describe, it, expect } from 'vitest';
import { mergeData } from './merge';
import { emptySyncedData } from './schema';
import type { SyncedData } from './types';
import { EMPTY_USER_INPUTS } from '../user/userInputs';

function userInputsAt(weightKg: number, ts: string): SyncedData {
  const d = emptySyncedData();
  d.userInputs = { ...EMPTY_USER_INPUTS, weightKg };
  d._sectionMeta.userInputs = { updatedAt: ts };
  d.updatedAt = ts;
  return d;
}

describe('mergeData — atomic LWW por seccion', () => {
  it('local mas reciente gana en userInputs', () => {
    const local = userInputsAt(70, '2026-04-29T10:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T09:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(70);
  });

  it('remote mas reciente gana en userInputs', () => {
    const local = userInputsAt(70, '2026-04-29T09:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
  });

  it('en empate exacto wins remote y registra conflicto', () => {
    const ts = '2026-04-29T10:00:00Z';
    const local = userInputsAt(70, ts);
    const remote = userInputsAt(65, ts);
    const { merged, conflicts } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.section).toBe('userInputs');
  });

  it('seccion sin meta en un lado wins el otro', () => {
    const local = emptySyncedData();
    const remote = userInputsAt(65, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
  });

  it('updatedAt del merged es el max de los meta de secciones', () => {
    const local = userInputsAt(70, '2026-04-29T10:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T11:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.updatedAt).toBe('2026-04-29T11:00:00.000Z');
  });
});
