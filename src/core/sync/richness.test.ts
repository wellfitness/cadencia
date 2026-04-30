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

describe('calculateDataRichness (normalizada por seccion)', () => {
  it('0 para empty', () => {
    expect(calculateDataRichness(emptySyncedData())).toBe(0);
  });

  it('userInputs aporta proporcion campos rellenos / total', () => {
    const d = emptySyncedData();
    // 2 campos rellenos sobre 9 posibles → 2/9.
    d.userInputs = { ...EMPTY_USER_INPUTS, weightKg: 70, ftpWatts: 200 };
    expect(calculateDataRichness(d)).toBeCloseTo(2 / 9, 5);
  });

  it('cuenta sesiones vivas pero ignora tombstones (regresion log-richness)', () => {
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
    // 1 sesion viva → log2(2)/log2(11) ≈ 0.289.
    const r = calculateDataRichness(d);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(0.5);
  });

  it('escala log: 50 sesiones aportan ~3x lo que aporta 1, no 50x', () => {
    const mkSession = (id: string): SavedSession => ({
      id,
      name: id,
      plan: { name: id, items: [] },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    });
    const d1 = emptySyncedData();
    d1.savedSessions = [mkSession('1')];
    const d50 = emptySyncedData();
    d50.savedSessions = Array.from({ length: 50 }, (_, i) => mkSession(`${i}`));
    const r1 = calculateDataRichness(d1);
    const r50 = calculateDataRichness(d50);
    // log2(51)/log2(11) ≈ 1.638; log2(2)/log2(11) ≈ 0.289 → ratio ~5.6,
    // pero ambos cap a 1 → r50=1, r1≈0.289. Ratio 3.5.
    expect(r50 / r1).toBeLessThan(10);
    expect(r50 / r1).toBeGreaterThan(2);
  });

  it('perfil completo + 1 sesion gana en richness a 50 dismissedTrackUris (regresion M7)', () => {
    // El bug original: 50 dismissed tracks daban richness 50, perfil
    // completo + 1 sesion daba ~10. Ahora cada seccion contribuye <=1.
    const dPerfil = emptySyncedData();
    dPerfil.userInputs = {
      sport: 'bike',
      weightKg: 70,
      ftpWatts: 200,
      maxHeartRate: 185,
      restingHeartRate: 60,
      birthYear: 1985,
      sex: 'female',
      bikeWeightKg: 9,
      bikeType: 'road',
    };
    dPerfil.savedSessions = [
      {
        id: 'a',
        name: 'A',
        plan: { name: 'A', items: [] },
        createdAt: '2026-04-29T00:00:00Z',
        updatedAt: '2026-04-29T00:00:00Z',
      },
    ];
    dPerfil.musicPreferences = { preferredGenres: [], allEnergetic: false };

    const dDismissed = emptySyncedData();
    dDismissed.dismissedTrackUris = Array.from({ length: 50 }, (_, i) => `spotify:track:${i}`);

    expect(calculateDataRichness(dPerfil)).toBeGreaterThan(calculateDataRichness(dDismissed));
  });
});
