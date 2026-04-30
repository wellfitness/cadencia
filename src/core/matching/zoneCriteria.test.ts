import { describe, it, expect } from 'vitest';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

describe('getZoneCriteria — bike: cadencia (excluyente) + ideales energy/valence (inclusivos)', () => {
  it('Z1 flat: cadencia 70-90 (rango profile flat), energy ideal 0.30', () => {
    const c = getZoneCriteria(1, 'flat', 'bike');
    expect(c.cadenceMin).toBe(70);
    expect(c.cadenceMax).toBe(90);
    expect(c.energyIdeal).toBe(0.3);
    expect(c.valenceIdeal).toBe(0.4);
  });

  it('Z2 flat: misma cadencia que Z1 flat (70-90), energy ideal 0.55', () => {
    const z1 = getZoneCriteria(1, 'flat', 'bike');
    const z2 = getZoneCriteria(2, 'flat', 'bike');
    expect(z2.cadenceMin).toBe(z1.cadenceMin);
    expect(z2.cadenceMax).toBe(z1.cadenceMax);
    expect(z2.energyIdeal).toBe(0.55);
  });

  it('Z3 flat / climb: cadencia distinta segun profile (flat 70-90 vs climb 55-80)', () => {
    const flat = getZoneCriteria(3, 'flat', 'bike');
    const climb = getZoneCriteria(3, 'climb', 'bike');
    expect(flat.cadenceMin).toBe(70);
    expect(flat.cadenceMax).toBe(90);
    expect(climb.cadenceMin).toBe(55);
    expect(climb.cadenceMax).toBe(80);
    // Misma zona = mismos ideales (lo que cambia es la cadencia).
    expect(flat.energyIdeal).toBe(climb.energyIdeal);
    expect(flat.valenceIdeal).toBe(climb.valenceIdeal);
  });

  it('Z5 climb: cadencia 55-80, energy ideal 0.90', () => {
    const c = getZoneCriteria(5, 'climb', 'bike');
    expect(c.cadenceMin).toBe(55);
    expect(c.cadenceMax).toBe(80);
    expect(c.energyIdeal).toBe(0.9);
  });

  it('Z6 sprint: cadencia 90-115 (exclusiva), energy ideal 0.95', () => {
    const c = getZoneCriteria(6, 'sprint', 'bike');
    expect(c.cadenceMin).toBe(90);
    expect(c.cadenceMax).toBe(115);
    expect(c.energyIdeal).toBe(0.95);
  });

  it('flat y climb se solapan en 70-80 rpm (intencional)', () => {
    const flat = getZoneCriteria(3, 'flat', 'bike');
    const climb = getZoneCriteria(3, 'climb', 'bike');
    const overlap =
      Math.min(flat.cadenceMax, climb.cadenceMax) - Math.max(flat.cadenceMin, climb.cadenceMin);
    expect(overlap).toBeGreaterThan(0);
  });

  it('combinacion invalida (Z1 + climb) cae al default flat', () => {
    const c = getZoneCriteria(1, 'climb', 'bike');
    expect(c.cadenceProfile).toBe('flat');
    expect(c.cadenceMin).toBe(70);
  });

  it('combinacion invalida (Z5 + flat) cae al default climb', () => {
    const c = getZoneCriteria(5, 'flat', 'bike');
    expect(c.cadenceProfile).toBe('climb');
    expect(c.cadenceMin).toBe(55);
  });

  it('combinacion invalida (Z6 + flat) cae al default sprint', () => {
    const c = getZoneCriteria(6, 'flat', 'bike');
    expect(c.cadenceProfile).toBe('sprint');
  });
});

describe('getZoneCriteria — run: cadencia por zona (spm) ignorando profile', () => {
  it('Z1 run: cadencia 150-162 spm, sport y profile coherentes', () => {
    const c = getZoneCriteria(1, 'flat', 'run');
    expect(c.sport).toBe('run');
    expect(c.cadenceMin).toBe(150);
    expect(c.cadenceMax).toBe(162);
    expect(c.cadenceProfile).toBe('flat');
  });

  it('Z3 run: cadencia 165-178 spm', () => {
    const c = getZoneCriteria(3, 'climb', 'run');
    expect(c.cadenceMin).toBe(165);
    expect(c.cadenceMax).toBe(178);
    // El profile en run es informativo, el matcher lo ignora — pero seguimos
    // devolviendo 'flat' como placeholder (no 'climb').
    expect(c.cadenceProfile).toBe('flat');
  });

  it('Z6 run: cadencia 180-200 spm (rango mas alto)', () => {
    const c = getZoneCriteria(6, 'sprint', 'run');
    expect(c.cadenceMin).toBe(180);
    expect(c.cadenceMax).toBe(200);
  });

  it('mismo zone, distinto sport → rangos completamente distintos (regresion C1)', () => {
    const bikeZ4 = getZoneCriteria(4, 'flat', 'bike');
    const runZ4 = getZoneCriteria(4, 'flat', 'run');
    // bike Z4 flat = 70-90 rpm; run Z4 = 170-185 spm. No deben coincidir.
    expect(bikeZ4.cadenceMin).not.toBe(runZ4.cadenceMin);
    expect(bikeZ4.cadenceMax).not.toBe(runZ4.cadenceMax);
  });
});

describe('ZONE_MUSIC_CRITERIA (compat: profile default por zona, bike implicito)', () => {
  it('expone los criterios del profile default de cada zona', () => {
    expect(ZONE_MUSIC_CRITERIA[1].cadenceProfile).toBe('flat');
    expect(ZONE_MUSIC_CRITERIA[5].cadenceProfile).toBe('climb');
    expect(ZONE_MUSIC_CRITERIA[6].cadenceProfile).toBe('sprint');
  });
});

describe('applyAllEnergetic', () => {
  it('sin toggle no cambia los criterios', () => {
    const z1 = getZoneCriteria(1, 'flat', 'bike');
    expect(applyAllEnergetic(z1, false)).toEqual(z1);
  });

  it('con toggle sube energyIdeal a 0.70 en Z1 (de 0.30)', () => {
    const z1Energetic = applyAllEnergetic(getZoneCriteria(1, 'flat', 'bike'), true);
    expect(z1Energetic.energyIdeal).toBe(0.7);
    // La cadencia no se toca.
    expect(z1Energetic.cadenceMin).toBe(70);
    expect(z1Energetic.cadenceMax).toBe(90);
  });

  it('con toggle sube energyIdeal de Z3 (0.70 → 0.70, sin cambio)', () => {
    expect(applyAllEnergetic(getZoneCriteria(3, 'flat', 'bike'), true).energyIdeal).toBe(0.7);
  });

  it('con toggle no baja energyIdeal de Z5 (sigue en 0.90)', () => {
    expect(applyAllEnergetic(getZoneCriteria(5, 'climb', 'bike'), true).energyIdeal).toBe(0.9);
  });

  it('con toggle no baja energyIdeal de Z6 (sigue en 0.95)', () => {
    expect(applyAllEnergetic(getZoneCriteria(6, 'sprint', 'bike'), true).energyIdeal).toBe(0.95);
  });
});
