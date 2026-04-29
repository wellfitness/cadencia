import { describe, it, expect } from 'vitest';
import { mergeData } from './merge';
import { emptySyncedData } from './schema';
import type { SavedSession, SyncedData } from './types';
import { EMPTY_USER_INPUTS } from '../user/userInputs';

function session(
  id: string,
  name: string,
  updatedAt: string,
  deletedAt?: string,
): SavedSession {
  const s: SavedSession = {
    id,
    name,
    plan: { name, items: [] },
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt,
  };
  if (deletedAt !== undefined) s.deletedAt = deletedAt;
  return s;
}

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

describe('mergeData — savedSessions array merge', () => {
  it('union: items presentes en cualquiera aparecen en merged', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    local._sectionMeta.savedSessions = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.savedSessions = [session('b', 'B', '2026-04-29T11:00:00Z')];
    remote._sectionMeta.savedSessions = { updatedAt: '2026-04-29T11:00:00Z' };

    const { merged } = mergeData(local, remote);
    const ids = merged.savedSessions.map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('item con mismo id: LWW por updatedAt del item', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A-local', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [session('a', 'A-remote', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.name).toBe('A-remote');
  });

  it('tombstone gana sobre version sin borrar si su timestamp es mayor', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [
      session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('item resucitado: version sin deletedAt mas reciente que tombstone gana', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T12:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [
      session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBeUndefined();
  });
});
