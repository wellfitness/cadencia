import { describe, it, expect } from 'vitest';
import { calculatePowerZones } from './coggan';

describe('calculatePowerZones', () => {
  it('devuelve 6 zonas Z1..Z6', () => {
    const zones = calculatePowerZones(250);
    expect(zones).toHaveLength(6);
    expect(zones.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Z1 va de 0 a 55% FTP', () => {
    const zones = calculatePowerZones(250);
    expect(zones[0]!.minWatts).toBe(0);
    expect(zones[0]!.maxWatts).toBeCloseTo(137.5, 5);
  });

  it('Z2..Z5 son contiguas', () => {
    const zones = calculatePowerZones(250);
    for (let i = 1; i < 5; i++) {
      expect(zones[i]!.minWatts).toBeCloseTo(zones[i - 1]!.maxWatts, 5);
    }
  });

  it('Z6 (supramaxima) va de 120% FTP a Infinity', () => {
    const zones = calculatePowerZones(250);
    expect(zones[5]!.minWatts).toBeCloseTo(300, 5);
    expect(zones[5]!.maxWatts).toBe(Infinity);
  });

  it('escala lineal con FTP', () => {
    const z200 = calculatePowerZones(200);
    const z400 = calculatePowerZones(400);
    expect(z400[3]!.minWatts).toBeCloseTo(z200[3]!.minWatts * 2, 5);
    expect(z400[3]!.maxWatts).toBeCloseTo(z200[3]!.maxWatts * 2, 5);
  });

  it.each([[0], [-50], [NaN], [Infinity]])('lanza RangeError con FTP invalida (%p)', (ftp) => {
    expect(() => calculatePowerZones(ftp)).toThrow(RangeError);
  });
});
