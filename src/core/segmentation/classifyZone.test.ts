import { describe, it, expect } from 'vitest';
import { classifyZone } from './classifyZone';
import type { ValidatedUserInputs } from '../user/userInputs';

const withFtp: ValidatedUserInputs = {
  weightKg: 70,
  ftpWatts: 200,
  effectiveMaxHr: null,
  restingHeartRate: null,
  birthYear: null,
  bikeWeightKg: 10,
  bikeType: 'gravel',
  hasFtp: true,
  hasHeartRateZones: false,
};

const withoutFtp: ValidatedUserInputs = {
  ...withFtp,
  ftpWatts: null,
  hasFtp: false,
};

describe('classifyZone con FTP (Coggan estricto, 6 zonas)', () => {
  // FTP=200, asi que:
  //   Z1<110, Z2 110-150, Z3 150-180, Z4 180-210, Z5 210-240, Z6 >=240
  it('100 W (50% FTP) -> Z1', () => {
    expect(classifyZone(100, withFtp)).toBe(1);
  });

  it('130 W (65% FTP) -> Z2', () => {
    expect(classifyZone(130, withFtp)).toBe(2);
  });

  it('170 W (85% FTP) -> Z3', () => {
    expect(classifyZone(170, withFtp)).toBe(3);
  });

  it('195 W (97.5% FTP) -> Z4', () => {
    expect(classifyZone(195, withFtp)).toBe(4);
  });

  it('220 W (110% FTP) -> Z5 (muros / VT2)', () => {
    expect(classifyZone(220, withFtp)).toBe(5);
  });

  it('250 W (125% FTP) -> Z6 (supramaxima / sprint)', () => {
    expect(classifyZone(250, withFtp)).toBe(6);
  });

  it('frontera exacta 120% FTP (240 W) -> Z6 (limite estricto >=120%)', () => {
    expect(classifyZone(240, withFtp)).toBe(6);
  });

  it('frontera exacta 90% FTP (180 W) -> Z4 (limite estricto >=90%)', () => {
    expect(classifyZone(180, withFtp)).toBe(4);
  });
});

describe('classifyZone sin FTP (fallback 2.5 W/kg estimado)', () => {
  // 70 kg * 2.5 = 175 W estimado FTP
  // Z1<96.25, Z2<131.25, Z3<157.5, Z4<183.75, Z5<210, Z6>=210
  it('80 W (~46% estimado) -> Z1', () => {
    expect(classifyZone(80, withoutFtp)).toBe(1);
  });

  it('120 W (~69% estimado) -> Z2', () => {
    expect(classifyZone(120, withoutFtp)).toBe(2);
  });

  it('200 W (~114% estimado) -> Z5', () => {
    expect(classifyZone(200, withoutFtp)).toBe(5);
  });

  it('230 W (>120% estimado) -> Z6', () => {
    expect(classifyZone(230, withoutFtp)).toBe(6);
  });
});
