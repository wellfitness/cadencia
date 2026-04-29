import { describe, it, expect } from 'vitest';
import { cleanExpiredTombstones } from './tombstones';
import { emptySyncedData } from './schema';
import type { SavedSession } from './types';

describe('cleanExpiredTombstones', () => {
  it('quita tombstones con deletedAt mayor a 30 dias', () => {
    const data = emptySyncedData();
    const now = new Date('2026-04-29T00:00:00Z').getTime();
    const old: SavedSession = {
      id: 'old',
      name: 'old',
      plan: { name: 'old', items: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      deletedAt: '2026-01-01T00:00:00Z',
    };
    const recent: SavedSession = {
      id: 'recent',
      name: 'recent',
      plan: { name: 'recent', items: [] },
      createdAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      deletedAt: '2026-04-20T00:00:00Z',
    };
    data.savedSessions = [old, recent];
    const cleaned = cleanExpiredTombstones(data, now);
    expect(cleaned.savedSessions.map((s) => s.id)).toEqual(['recent']);
  });

  it('preserva items vivos', () => {
    const data = emptySyncedData();
    const live: SavedSession = {
      id: 'live',
      name: 'live',
      plan: { name: 'live', items: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    data.savedSessions = [live];
    const cleaned = cleanExpiredTombstones(data, Date.now());
    expect(cleaned.savedSessions).toHaveLength(1);
    expect(cleaned.savedSessions[0]?.id).toBe('live');
  });

  it('devuelve el mismo objeto si no hay cambios (referencial)', () => {
    const data = emptySyncedData();
    const cleaned = cleanExpiredTombstones(data, Date.now());
    expect(cleaned).toBe(data);
  });
});
