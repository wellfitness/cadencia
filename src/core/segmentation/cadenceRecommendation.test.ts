import { describe, expect, it } from 'vitest';
import type { HeartRateZone } from '../physiology/karvonen';
import { getRecommendedCadence } from './cadenceRecommendation';
import { getValidProfiles } from './sessionPlan';

const ALL_ZONES: readonly HeartRateZone[] = [1, 2, 3, 4, 5, 6] as const;

describe('getRecommendedCadence', () => {
  it('devuelve un rango con min < max para todos los pares (zona, profile) validos', () => {
    for (const zone of ALL_ZONES) {
      for (const profile of getValidProfiles(zone)) {
        const range = getRecommendedCadence(zone, profile);
        expect(range.min).toBeLessThan(range.max);
        // Cordura: ninguna recomendacion debe salirse del rango fisiologico
        // razonable (40 rpm muy lento, 150 rpm muy rapido sostenido).
        expect(range.min).toBeGreaterThanOrEqual(40);
        expect(range.max).toBeLessThanOrEqual(150);
      }
    }
  });

  it('reconcilia profiles invalidos al default de la zona', () => {
    // Z6 solo permite sprint; pasar 'flat' o 'climb' debe devolver el rango
    // de sprint. Mismo contrato que getZoneCriteria via reconcileCadenceProfile.
    const sprintRange = getRecommendedCadence(6, 'sprint');
    expect(getRecommendedCadence(6, 'flat')).toEqual(sprintRange);
    expect(getRecommendedCadence(6, 'climb')).toEqual(sprintRange);

    // Z5 solo permite climb; flat y sprint reconcilian a climb.
    const z5ClimbRange = getRecommendedCadence(5, 'climb');
    expect(getRecommendedCadence(5, 'flat')).toEqual(z5ClimbRange);
    expect(getRecommendedCadence(5, 'sprint')).toEqual(z5ClimbRange);

    // Z1-Z2 solo permiten flat; climb y sprint reconcilian a flat.
    const z1FlatRange = getRecommendedCadence(1, 'flat');
    expect(getRecommendedCadence(1, 'climb')).toEqual(z1FlatRange);
    expect(getRecommendedCadence(1, 'sprint')).toEqual(z1FlatRange);
  });

  // Snapshot: cualquier ajuste a la tabla pasa por revisar este test, lo
  // que obliga a discutir el cambio de rangos en el PR. Si la evidencia
  // futura justifica modificar un rango, este test se actualiza junto con
  // la tabla y la justificacion en el comentario JSDoc del modulo.
  it('snapshots de los rangos exactos por par (zona, profile) valido', () => {
    expect(getRecommendedCadence(1, 'flat')).toEqual({ min: 80, max: 95 });
    expect(getRecommendedCadence(2, 'flat')).toEqual({ min: 80, max: 95 });
    expect(getRecommendedCadence(3, 'flat')).toEqual({ min: 85, max: 95 });
    expect(getRecommendedCadence(3, 'climb')).toEqual({ min: 65, max: 75 });
    expect(getRecommendedCadence(4, 'flat')).toEqual({ min: 80, max: 90 });
    expect(getRecommendedCadence(4, 'climb')).toEqual({ min: 65, max: 75 });
    expect(getRecommendedCadence(5, 'climb')).toEqual({ min: 55, max: 70 });
    expect(getRecommendedCadence(6, 'sprint')).toEqual({ min: 100, max: 120 });
  });
});
