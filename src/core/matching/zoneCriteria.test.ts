import { describe, it, expect } from 'vitest';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

describe('ZONE_MUSIC_CRITERIA', () => {
  it('coincide con la tabla de CLAUDE.md', () => {
    // Z1: BPM 90-110, Energy 0.40, valencia cualquiera
    expect(ZONE_MUSIC_CRITERIA[1]).toMatchObject({
      bpmMin: 90,
      bpmMax: 110,
      energyMin: 0.4,
      valenceMin: null,
    });
    // Z3: BPM 120-130, Energy 0.70, Valence > 0.50
    expect(ZONE_MUSIC_CRITERIA[3]).toMatchObject({
      bpmMin: 120,
      bpmMax: 130,
      energyMin: 0.7,
      valenceMin: 0.5,
    });
    // Z5: BPM 145-175, Energy 0.90, Valence > 0.70
    expect(ZONE_MUSIC_CRITERIA[5]).toMatchObject({
      bpmMin: 145,
      bpmMax: 175,
      energyMin: 0.9,
      valenceMin: 0.7,
    });
  });
});

describe('applyAllEnergetic', () => {
  it('sin toggle no cambia los criterios', () => {
    expect(applyAllEnergetic(ZONE_MUSIC_CRITERIA[1], false)).toEqual(ZONE_MUSIC_CRITERIA[1]);
  });

  it('con toggle sube Energy minima a 0.70 en Z1', () => {
    const z1Energetic = applyAllEnergetic(ZONE_MUSIC_CRITERIA[1], true);
    expect(z1Energetic.energyMin).toBe(0.7);
    expect(z1Energetic.bpmMin).toBe(90); // BPM no se toca
  });

  it('con toggle no afecta a Z3 (ya esta en 0.70)', () => {
    expect(applyAllEnergetic(ZONE_MUSIC_CRITERIA[3], true).energyMin).toBe(0.7);
  });

  it('con toggle no baja Energy minima de Z5 (sigue en 0.90)', () => {
    expect(applyAllEnergetic(ZONE_MUSIC_CRITERIA[5], true).energyMin).toBe(0.9);
  });
});
