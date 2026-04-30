import { describe, it, expect } from 'vitest';
import { getZoneFeeling, formatRpeRange } from './zoneFeeling';
import type { HeartRateZone } from './karvonen';

describe('getZoneFeeling', () => {
  it('devuelve un ZoneFeeling para cada una de las 6 zonas', () => {
    const zones: HeartRateZone[] = [1, 2, 3, 4, 5, 6];
    for (const z of zones) {
      const feeling = getZoneFeeling(z);
      expect(feeling.rpeMin).toBeGreaterThanOrEqual(1);
      expect(feeling.rpeMax).toBeLessThanOrEqual(10);
      expect(feeling.rpeMin).toBeLessThanOrEqual(feeling.rpeMax);
      expect(feeling.sensation.length).toBeGreaterThan(0);
    }
  });

  it('Z1 es la zona mas suave (rpe minimo)', () => {
    expect(getZoneFeeling(1).rpeMin).toBe(2);
    expect(getZoneFeeling(1).rpeMax).toBe(3);
  });

  it('Z6 es la zona maxima (rpe 10 fijo)', () => {
    const feeling = getZoneFeeling(6);
    expect(feeling.rpeMin).toBe(10);
    expect(feeling.rpeMax).toBe(10);
  });

  it('el rpe es monotono creciente Z1 → Z6', () => {
    let prevMax = 0;
    for (const z of [1, 2, 3, 4, 5, 6] as const) {
      const feeling = getZoneFeeling(z);
      expect(feeling.rpeMin).toBeGreaterThanOrEqual(prevMax);
      prevMax = feeling.rpeMax;
    }
  });

  it('todas las sensaciones llevan acentos correctos (no ASCII degradado)', () => {
    // Sanity check del copy: si alguien sustituye "cómodo" por "comodo" sin
    // querer, este test lo pilla. Acentos esperados en Z2 (cómodo) y Z5
    // (monosílabos), Z6 (máximo).
    expect(getZoneFeeling(2).sensation).toContain('ó');
    expect(getZoneFeeling(5).sensation).toContain('í');
    expect(getZoneFeeling(6).sensation).toContain('á');
  });
});

describe('formatRpeRange', () => {
  it('formatea singular cuando rpeMin === rpeMax', () => {
    expect(formatRpeRange({ rpeMin: 7, rpeMax: 7, sensation: '' })).toBe('RPE 7');
    expect(formatRpeRange({ rpeMin: 10, rpeMax: 10, sensation: '' })).toBe('RPE 10');
  });

  it('formatea rango cuando rpeMin !== rpeMax', () => {
    expect(formatRpeRange({ rpeMin: 2, rpeMax: 3, sensation: '' })).toBe('RPE 2-3');
    expect(formatRpeRange({ rpeMin: 8, rpeMax: 9, sensation: '' })).toBe('RPE 8-9');
  });

  it('integra con getZoneFeeling: Z4 → singular, Z5 → rango', () => {
    expect(formatRpeRange(getZoneFeeling(4))).toBe('RPE 7');
    expect(formatRpeRange(getZoneFeeling(5))).toBe('RPE 8-9');
  });
});
