import { describe, it, expect } from 'vitest';
import {
  ftpFromRampMap,
  vo2maxFromMap5,
  cpFrom3MT,
  maxHrFromPeak,
  lthrFrom5MinMeanHr,
  vMasFromBuchheitStage,
} from './tests';

/**
 * Tests de las formulas de derivacion de los 6 protocolos cientificos:
 * rampa, MAP-5min, 3MT (bike); FCmax Daniels, 5min run, 30-15 IFT (run).
 *
 * Cada describe lleva la cita del paper que define o valida la formula.
 */

describe('ftpFromRampMap (rampa lineal → FTP, factor 0.75)', () => {
  // Convencion industria (Zwift/TrainerRoad). Respaldo cientifico de la
  // rampa: Michalik 2019 — 10.23736/S0022-4707.19.09126-6.
  it('300 W MAP -> 225 W FTP', () => {
    expect(ftpFromRampMap(300)).toBe(225);
  });

  it('400 W MAP -> 300 W FTP', () => {
    expect(ftpFromRampMap(400)).toBe(300);
  });

  it('redondea a entero (250 W -> 188 W)', () => {
    // 0.75 * 250 = 187.5 → 188 (Math.round redondea 0.5 hacia arriba)
    expect(ftpFromRampMap(250)).toBe(188);
  });

  it.each([0, -10, NaN, Infinity])('throws on invalid MAP %p', (map) => {
    expect(() => ftpFromRampMap(map)).toThrow(RangeError);
  });
});

describe('vo2maxFromMap5 (test 5-min PAM ciclismo)', () => {
  // Sitko 2021 — 10.1123/ijspp.2020-0923.
  // VO2max (mL/kg/min) = 16.6 + 8.87 * (P5min / weight).
  it('280 W / 70 kg -> 52.08 mL/kg/min', () => {
    // P_rel = 4.0 W/kg → 16.6 + 8.87*4 = 52.08
    expect(vo2maxFromMap5(280, 70)).toBeCloseTo(52.08, 2);
  });

  it('5 W/kg (350 W / 70 kg) -> 60.95 mL/kg/min', () => {
    // 16.6 + 8.87*5 = 60.95
    expect(vo2maxFromMap5(350, 70)).toBeCloseTo(60.95, 2);
  });

  it('mas potencia relativa -> mas VO2max', () => {
    expect(vo2maxFromMap5(300, 70)).toBeGreaterThan(vo2maxFromMap5(200, 70));
  });

  it.each([0, -1, NaN, Infinity])('throws on invalid power %p', (p) => {
    expect(() => vo2maxFromMap5(p, 70)).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity])('throws on invalid weight %p', (w) => {
    expect(() => vo2maxFromMap5(280, w)).toThrow(RangeError);
  });
});

describe('cpFrom3MT (Vanhatalo 3-min all-out → CP + W′)', () => {
  // Vanhatalo 2007 — 10.1249/mss.0b013e31802dd3e6.
  // CP = potencia media de los ultimos 30 s. W' = trabajo total - CP*180.
  it('CP = potencia media ultimos 30 s', () => {
    const { cp } = cpFrom3MT(287, 70900);
    expect(cp).toBe(287);
  });

  it("W' = total work - CP * 180 s", () => {
    // 70900 - 287*180 = 70900 - 51660 = 19240 J
    const { wPrime } = cpFrom3MT(287, 70900);
    expect(wPrime).toBe(19240);
  });

  it("W' se clampa a 0 si total work < CP*180 (entrada inconsistente)", () => {
    // CP 300 * 180 = 54000. Si total work = 50000 < 54000, no rompemos: 0.
    const { wPrime } = cpFrom3MT(300, 50000);
    expect(wPrime).toBe(0);
  });

  it.each([0, -1, NaN])('throws on invalid mean power %p', (p) => {
    expect(() => cpFrom3MT(p, 70000)).toThrow(RangeError);
  });

  it.each([0, -1, NaN])('throws on invalid total work %p', (w) => {
    expect(() => cpFrom3MT(287, w)).toThrow(RangeError);
  });
});

describe('maxHrFromPeak (Daniels FCmax: passthrough con validacion)', () => {
  it('192 bpm -> 192 bpm', () => {
    expect(maxHrFromPeak(192)).toBe(192);
  });

  it('178.4 bpm -> 178 bpm (redondea)', () => {
    expect(maxHrFromPeak(178.4)).toBe(178);
  });

  it.each([99, 231, 0, NaN, -10])('throws on out-of-range %p', (hr) => {
    expect(() => maxHrFromPeak(hr)).toThrow(RangeError);
  });
});

describe('lthrFrom5MinMeanHr (FC umbral aproximada del 5-min run)', () => {
  // FC media del all-out de 5 min ≈ LTHR (92-95 % FCmax tipicamente).
  it('178 bpm -> 178 bpm', () => {
    expect(lthrFrom5MinMeanHr(178)).toBe(178);
  });

  it('redondea (180.6 -> 181)', () => {
    expect(lthrFrom5MinMeanHr(180.6)).toBe(181);
  });

  it.each([99, 231, 0, NaN])('throws on out-of-range %p', (hr) => {
    expect(() => lthrFrom5MinMeanHr(hr)).toThrow(RangeError);
  });
});

describe('vMasFromBuchheitStage (30-15 IFT → vMAS km/h)', () => {
  // Buchheit 2011 — 10.1519/JSC.0b013e3181d686b7.
  // Stage 1 = 8 km/h; cada stage suma 0.5 km/h.
  it('stage 1 -> 8.0 km/h', () => {
    expect(vMasFromBuchheitStage(1)).toBe(8.0);
  });

  it('stage 2 -> 8.5 km/h', () => {
    expect(vMasFromBuchheitStage(2)).toBe(8.5);
  });

  it('stage 17 -> 16.0 km/h (recreativo medio-alto)', () => {
    expect(vMasFromBuchheitStage(17)).toBe(16.0);
  });

  it('stage 25 -> 20.0 km/h (elite)', () => {
    expect(vMasFromBuchheitStage(25)).toBe(20.0);
  });

  it.each([0, -1, 51, NaN])('throws on out-of-range %p', (s) => {
    expect(() => vMasFromBuchheitStage(s)).toThrow(RangeError);
  });
});
