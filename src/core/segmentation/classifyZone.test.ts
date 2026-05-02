import { describe, it, expect } from 'vitest';
import { bikeSlopeFloorZone, classifyZone } from './classifyZone';
import type { ValidatedUserInputs } from '../user/userInputs';

const baseValidated: ValidatedUserInputs = {
  weightKg: 70,
  ftpWatts: 200,
  effectiveMaxHr: null,
  restingHeartRate: null,
  birthYear: null,
  sex: null,
  bikeWeightKg: 10,
  bikeType: 'gravel',
  hasFtp: true,
  hasHeartRateZones: false,
};

const withFtpRoad: ValidatedUserInputs = { ...baseValidated, bikeType: 'road' };
const withFtpGravel: ValidatedUserInputs = { ...baseValidated, bikeType: 'gravel' };
const withFtpMtb: ValidatedUserInputs = { ...baseValidated, bikeType: 'mtb' };

const withoutFtp: ValidatedUserInputs = { ...baseValidated, ftpWatts: null, hasFtp: false };

// FTP=200 -> Z1<110, Z2 110-150, Z3 150-180, Z4 180-210, Z5 210-240, Z6 >=240

describe('classifyZone: Coggan estricto en pendiente plana (floor inactivo)', () => {
  // En llano (slope 0) el floor es Z1 para las tres bicis, asi que Coggan manda.
  it('100 W (50% FTP) en llano -> Z1', () => {
    expect(classifyZone(100, 0, withFtpGravel)).toBe(1);
  });

  it('130 W (65% FTP) en llano -> Z2', () => {
    expect(classifyZone(130, 0, withFtpGravel)).toBe(2);
  });

  it('170 W (85% FTP) en llano -> Z3', () => {
    expect(classifyZone(170, 0, withFtpGravel)).toBe(3);
  });

  it('195 W (97.5% FTP) en llano -> Z4', () => {
    expect(classifyZone(195, 0, withFtpGravel)).toBe(4);
  });

  it('220 W (110% FTP) en llano -> Z5', () => {
    expect(classifyZone(220, 0, withFtpGravel)).toBe(5);
  });

  it('250 W (125% FTP) en llano -> Z6', () => {
    expect(classifyZone(250, 0, withFtpGravel)).toBe(6);
  });

  it('frontera 120% FTP (240 W) en llano -> Z6 (limite estricto >=120%)', () => {
    expect(classifyZone(240, 0, withFtpGravel)).toBe(6);
  });

  it('frontera 90% FTP (180 W) en llano -> Z4 (limite estricto >=90%)', () => {
    expect(classifyZone(180, 0, withFtpGravel)).toBe(4);
  });
});

describe('classifyZone sin FTP -> solo floor por pendiente', () => {
  it('llano sin FTP -> Z1 (sin info de potencia)', () => {
    expect(classifyZone(120, 0, { ...withoutFtp, bikeType: 'gravel' })).toBe(1);
  });

  it('5% en gravel sin FTP -> Z3 (floor manda, potencia ignorada)', () => {
    expect(classifyZone(80, 5, { ...withoutFtp, bikeType: 'gravel' })).toBe(3);
  });

  it('7% en MTB sin FTP -> Z5 (floor MTB entra en Z5 desde 7%)', () => {
    expect(classifyZone(0, 7, { ...withoutFtp, bikeType: 'mtb' })).toBe(5);
  });

  it('10% en MTB sin FTP -> Z6 (floor MTB entra en Z6 desde 10%)', () => {
    expect(classifyZone(50, 10, { ...withoutFtp, bikeType: 'mtb' })).toBe(6);
  });

  it('FTP nulo trata como sin FTP aunque hasFtp diga true', () => {
    const inconsistent: ValidatedUserInputs = { ...baseValidated, ftpWatts: null, hasFtp: true };
    expect(classifyZone(200, 0, inconsistent)).toBe(1);
  });

  it('FTP <= 0 trata como sin FTP (proteccion)', () => {
    const zeroFtp: ValidatedUserInputs = { ...baseValidated, ftpWatts: 0, hasFtp: true };
    expect(classifyZone(200, 5, { ...zeroFtp, bikeType: 'gravel' })).toBe(3);
  });
});

describe('classifyZone con FTP: max(Coggan, floor) en subida', () => {
  // Caso central del bug: gravel a 8% con velocidad GPX baja produce
  // potencia mecanica que da Z2-Z3, pero el esfuerzo cardiovascular es Z5+.
  it('gravel 8% con potencia baja (140 W = 70%FTP, Coggan Z2) -> Z5 por floor', () => {
    expect(classifyZone(140, 8, withFtpGravel)).toBe(5);
  });

  it('MTB 10% con potencia baja (140 W = 70%FTP, Coggan Z2) -> Z6 (MTB estricto, floor Z6 desde 10%)', () => {
    expect(classifyZone(140, 10, withFtpMtb)).toBe(6);
  });

  it('MTB 8% con potencia baja (140 W = 70%FTP, Coggan Z2) -> Z5 (floor MTB Z5 desde 7%)', () => {
    expect(classifyZone(140, 8, withFtpMtb)).toBe(5);
  });

  it('gravel 8% con potencia muy alta (260 W = 130%FTP, Coggan Z6) -> Z6 (Coggan manda)', () => {
    expect(classifyZone(260, 8, withFtpGravel)).toBe(6);
  });

  it('road 5% con potencia baja (130 W = 65%FTP, Coggan Z2) -> Z3 (floor road permisivo)', () => {
    expect(classifyZone(130, 5, withFtpRoad)).toBe(3);
  });

  it('road 5% con potencia alta (200 W = 100%FTP, Coggan Z4) -> Z4 (Coggan ya supera floor)', () => {
    expect(classifyZone(200, 5, withFtpRoad)).toBe(4);
  });

  it('MTB 5% con potencia baja (100 W = 50%FTP, Coggan Z1) -> Z4 (MTB estricto)', () => {
    expect(classifyZone(100, 5, withFtpMtb)).toBe(4);
  });
});

describe('classifyZone en bajada o llano: Coggan limpio (floor Z1)', () => {
  it('bajada -5% en gravel con 100 W -> Z1 (floor Z1, Coggan Z1)', () => {
    expect(classifyZone(100, -5, withFtpGravel)).toBe(1);
  });

  it('bajada -10% en MTB con sprint 250 W -> Z6 (Coggan manda en bajada)', () => {
    expect(classifyZone(250, -10, withFtpMtb)).toBe(6);
  });

  it('llano 1% en MTB con potencia baja 80 W -> Z1 (floor MTB no entra hasta 2%)', () => {
    expect(classifyZone(80, 1, withFtpMtb)).toBe(1);
  });
});

describe('bikeSlopeFloorZone: tabla por tipo de bici', () => {
  describe('road (mas permisivo)', () => {
    it('llano -> Z1', () => expect(bikeSlopeFloorZone(0, 'road')).toBe(1));
    it('2% -> Z1 (no entra hasta 3%)', () => expect(bikeSlopeFloorZone(2, 'road')).toBe(1));
    it('3% -> Z2', () => expect(bikeSlopeFloorZone(3, 'road')).toBe(2));
    it('5% -> Z3', () => expect(bikeSlopeFloorZone(5, 'road')).toBe(3));
    it('7% -> Z4', () => expect(bikeSlopeFloorZone(7, 'road')).toBe(4));
    it('9% -> Z5', () => expect(bikeSlopeFloorZone(9, 'road')).toBe(5));
    it('12% -> Z6', () => expect(bikeSlopeFloorZone(12, 'road')).toBe(6));
    it('20% -> Z6 (cap)', () => expect(bikeSlopeFloorZone(20, 'road')).toBe(6));
  });

  describe('gravel (intermedio)', () => {
    it('llano -> Z1', () => expect(bikeSlopeFloorZone(0, 'gravel')).toBe(1));
    it('2% -> Z2', () => expect(bikeSlopeFloorZone(2, 'gravel')).toBe(2));
    it('4% -> Z3', () => expect(bikeSlopeFloorZone(4, 'gravel')).toBe(3));
    it('6% -> Z4', () => expect(bikeSlopeFloorZone(6, 'gravel')).toBe(4));
    it('8% -> Z5', () => expect(bikeSlopeFloorZone(8, 'gravel')).toBe(5));
    it('11% -> Z6', () => expect(bikeSlopeFloorZone(11, 'gravel')).toBe(6));
  });

  describe('mtb (mas estricto)', () => {
    it('llano -> Z1', () => expect(bikeSlopeFloorZone(0, 'mtb')).toBe(1));
    it('2% -> Z2', () => expect(bikeSlopeFloorZone(2, 'mtb')).toBe(2));
    it('3% -> Z3', () => expect(bikeSlopeFloorZone(3, 'mtb')).toBe(3));
    it('5% -> Z4', () => expect(bikeSlopeFloorZone(5, 'mtb')).toBe(4));
    it('7% -> Z5', () => expect(bikeSlopeFloorZone(7, 'mtb')).toBe(5));
    it('10% -> Z6', () => expect(bikeSlopeFloorZone(10, 'mtb')).toBe(6));
  });

  describe('jerarquia road < gravel <= mtb a igual pendiente', () => {
    it('5% sostenido: road=Z3, gravel=Z3, mtb=Z4 (MTB lider)', () => {
      expect(bikeSlopeFloorZone(5, 'road')).toBe(3);
      expect(bikeSlopeFloorZone(5, 'gravel')).toBe(3);
      expect(bikeSlopeFloorZone(5, 'mtb')).toBe(4);
    });

    it('8% sostenido: road=Z4, gravel=Z5, mtb=Z5 (mtb empata con gravel a media-alta)', () => {
      expect(bikeSlopeFloorZone(8, 'road')).toBe(4);
      expect(bikeSlopeFloorZone(8, 'gravel')).toBe(5);
      expect(bikeSlopeFloorZone(8, 'mtb')).toBe(5);
    });

    it('10% sostenido: road=Z5, gravel=Z5, mtb=Z6 (mtb se separa hacia arriba en muros)', () => {
      expect(bikeSlopeFloorZone(10, 'road')).toBe(5);
      expect(bikeSlopeFloorZone(10, 'gravel')).toBe(5);
      expect(bikeSlopeFloorZone(10, 'mtb')).toBe(6);
    });
  });

  describe('robustez frente a entradas patologicas', () => {
    it('NaN -> Z1', () => expect(bikeSlopeFloorZone(NaN, 'gravel')).toBe(1));
    it('-Infinity -> Z1', () => expect(bikeSlopeFloorZone(-Infinity, 'gravel')).toBe(1));
    it('bajada -10% -> Z1 (floor solo aplica en subida)', () =>
      expect(bikeSlopeFloorZone(-10, 'mtb')).toBe(1));
  });
});
