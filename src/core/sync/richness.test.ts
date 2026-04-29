import { describe, it, expect } from 'vitest';
import { calculateDataRichness, isEmptyData } from './richness';
import { emptySyncedData } from './schema';
import type { SavedSession } from './types';
import { EMPTY_USER_INPUTS } from '../user/userInputs';

describe('isEmptyData', () => {
  it('true para emptySyncedData', () => {
    expect(isEmptyData(emptySyncedData())).toBe(true);
  });

  it('false si hay userInputs con al menos un campo', () => {
    const d = emptySyncedData();
    d.userInputs = { ...EMPTY_USER_INPUTS, weightKg: 70 };
    expect(isEmptyData(d)).toBe(false);
  });

  it('false si hay savedSessions vivas', () => {
    const d = emptySyncedData();
    const s: SavedSession = {
      id: 'a',
      name: 'A',
      plan: { name: 'A', items: [] },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    };
    d.savedSessions = [s];
    expect(isEmptyData(d)).toBe(false);
  });

  it('true si savedSessions solo tiene tombstones', () => {
    const d = emptySyncedData();
    const s: SavedSession = {
      id: 'a',
      name: 'A',
      plan: { name: 'A', items: [] },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
      deletedAt: '2026-04-29T00:00:00Z',
    };
    d.savedSessions = [s];
    expect(isEmptyData(d)).toBe(true);
  });
});

describe('calculateDataRichness', () => {
  it('0 para empty', () => {
    expect(calculateDataRichness(emptySyncedData())).toBe(0);
  });

  it('cuenta campos no null de userInputs', () => {
    const d = emptySyncedData();
    d.userInputs = { ...EMPTY_USER_INPUTS, weightKg: 70, ftpWatts: 200 };
    expect(calculateDataRichness(d)).toBe(2);
  });

  it('cuenta sesiones vivas pero ignora tombstones', () => {
    const d = emptySyncedData();
    const live: SavedSession = {
      id: 'a',
      name: 'A',
      plan: { name: 'A', items: [] },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    };
    const dead: SavedSession = {
      id: 'b',
      name: 'B',
      plan: { name: 'B', items: [] },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
      deletedAt: '2026-04-29T00:00:00Z',
    };
    d.savedSessions = [live, dead];
    expect(calculateDataRichness(d)).toBe(1);
  });
});
