import { describe, it, expect } from 'vitest';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

describe('getZoneCriteria — cadencia (excluyente) + ideales energy/valence (inclusivos)', () => {
  it('Z1 flat: cadencia 70-90 (rango profile flat), energy ideal 0.30', () => {
    const c = getZoneCriteria(1, 'flat');
    expect(c.cadenceMin).toBe(70);
    expect(c.cadenceMax).toBe(90);
    expect(c.energyIdeal).toBe(0.3);
    expect(c.valenceIdeal).toBe(0.4);
  });

  it('Z2 flat: misma cadencia que Z1 flat (70-90), energy ideal 0.55', () => {
    const z1 = getZoneCriteria(1, 'flat');
    const z2 = getZoneCriteria(2, 'flat');
    expect(z2.cadenceMin).toBe(z1.cadenceMin);
    expect(z2.cadenceMax).toBe(z1.cadenceMax);
    expect(z2.energyIdeal).toBe(0.55);
  });

  it('Z3 flat / climb: cadencia distinta segun profile (flat 70-90 vs climb 60-80)', () => {
    const flat = getZoneCriteria(3, 'flat');
    const climb = getZoneCriteria(3, 'climb');
    expect(flat.cadenceMin).toBe(70);
    expect(flat.cadenceMax).toBe(90);
    expect(climb.cadenceMin).toBe(60);
    expect(climb.cadenceMax).toBe(80);
    // Misma zona = mismos ideales (lo que cambia es la cadencia).
    expect(flat.energyIdeal).toBe(climb.energyIdeal);
    expect(flat.valenceIdeal).toBe(climb.valenceIdeal);
  });

  it('Z5 climb: cadencia 60-80, energy ideal 0.90', () => {
    const c = getZoneCriteria(5, 'climb');
    expect(c.cadenceMin).toBe(60);
    expect(c.cadenceMax).toBe(80);
    expect(c.energyIdeal).toBe(0.9);
  });

  it('Z6 sprint: cadencia 90-110 (exclusiva), energy ideal 0.95', () => {
    const c = getZoneCriteria(6, 'sprint');
    expect(c.cadenceMin).toBe(90);
    expect(c.cadenceMax).toBe(110);
    expect(c.energyIdeal).toBe(0.95);
  });

  it('flat y climb se solapan en 70-80 rpm (intencional)', () => {
    const flat = getZoneCriteria(3, 'flat');
    const climb = getZoneCriteria(3, 'climb');
    const overlap =
      Math.min(flat.cadenceMax, climb.cadenceMax) - Math.max(flat.cadenceMin, climb.cadenceMin);
    expect(overlap).toBeGreaterThan(0);
  });

  it('combinacion invalida (Z1 + climb) cae al default flat', () => {
    const c = getZoneCriteria(1, 'climb');
    expect(c.cadenceProfile).toBe('flat');
    expect(c.cadenceMin).toBe(70);
  });

  it('combinacion invalida (Z5 + flat) cae al default climb', () => {
    const c = getZoneCriteria(5, 'flat');
    expect(c.cadenceProfile).toBe('climb');
    expect(c.cadenceMin).toBe(60);
  });

  it('combinacion invalida (Z6 + flat) cae al default sprint', () => {
    const c = getZoneCriteria(6, 'flat');
    expect(c.cadenceProfile).toBe('sprint');
  });
});

describe('ZONE_MUSIC_CRITERIA (compat: profile default por zona)', () => {
  it('expone los criterios del profile default de cada zona', () => {
    expect(ZONE_MUSIC_CRITERIA[1].cadenceProfile).toBe('flat');
    expect(ZONE_MUSIC_CRITERIA[5].cadenceProfile).toBe('climb');
    expect(ZONE_MUSIC_CRITERIA[6].cadenceProfile).toBe('sprint');
  });
});

describe('applyAllEnergetic', () => {
  it('sin toggle no cambia los criterios', () => {
    const z1 = getZoneCriteria(1, 'flat');
    expect(applyAllEnergetic(z1, false)).toEqual(z1);
  });

  it('con toggle sube energyIdeal a 0.70 en Z1 (de 0.30)', () => {
    const z1Energetic = applyAllEnergetic(getZoneCriteria(1, 'flat'), true);
    expect(z1Energetic.energyIdeal).toBe(0.7);
    // La cadencia no se toca.
    expect(z1Energetic.cadenceMin).toBe(70);
    expect(z1Energetic.cadenceMax).toBe(90);
  });

  it('con toggle sube energyIdeal de Z3 (0.70 → 0.70, sin cambio)', () => {
    expect(applyAllEnergetic(getZoneCriteria(3, 'flat'), true).energyIdeal).toBe(0.7);
  });

  it('con toggle no baja energyIdeal de Z5 (sigue en 0.90)', () => {
    expect(applyAllEnergetic(getZoneCriteria(5, 'climb'), true).energyIdeal).toBe(0.9);
  });

  it('con toggle no baja energyIdeal de Z6 (sigue en 0.95)', () => {
    expect(applyAllEnergetic(getZoneCriteria(6, 'sprint'), true).energyIdeal).toBe(0.95);
  });
});
