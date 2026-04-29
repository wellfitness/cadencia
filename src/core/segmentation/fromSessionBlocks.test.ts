import { describe, expect, it } from 'vitest';
import type { ValidatedUserInputs } from '../user/userInputs';
import { classifyZone } from './classifyZone';
import { buildSessionRouteMeta, classifySessionPlan } from './fromSessionBlocks';
import { expandSessionPlan, type EditableSessionPlan } from './sessionPlan';
import { SESSION_TEMPLATES } from './sessionTemplates';

const userWithFtp: ValidatedUserInputs = {
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

const userWithoutFtp: ValidatedUserInputs = {
  ...userWithFtp,
  ftpWatts: null,
  hasFtp: false,
};

describe('classifySessionPlan', () => {
  it('genera un ClassifiedSegment por cada bloque', () => {
    const plan = expandSessionPlan({
      name: 'test',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 300 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 240 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.zone).toBe(2);
    expect(segments[1]?.zone).toBe(4);
  });

  it('startSec se acumula correctamente', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 100 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 200 } },
        { type: 'block', block: { id: 'c', phase: 'cooldown', zone: 1, cadenceProfile: 'flat', durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments[0]?.startSec).toBe(0);
    expect(segments[1]?.startSec).toBe(100);
    expect(segments[2]?.startSec).toBe(300);
  });

  it('cierra el bucle: la potencia sintetica de cada zona vuelve a clasificarse en la misma zona', () => {
    // Para cada zona Z1-Z6, generamos un bloque en esa zona y verificamos que
    // classifyZone() recupera la zona original a partir de la potencia sintetica.
    const profileFor: Record<1 | 2 | 3 | 4 | 5 | 6, 'flat' | 'climb' | 'sprint'> = {
      1: 'flat', 2: 'flat', 3: 'flat', 4: 'flat', 5: 'climb', 6: 'sprint',
    };
    for (const zone of [1, 2, 3, 4, 5, 6] as const) {
      const plan = expandSessionPlan({
        name: 'x',
        items: [{ type: 'block', block: { id: 'b', phase: 'work', zone, cadenceProfile: profileFor[zone], durationSec: 60 } }],
      });
      const segment = classifySessionPlan(plan, userWithFtp)[0];
      expect(segment).toBeDefined();
      const reclassified = classifyZone(segment!.avgPowerWatts, userWithFtp);
      expect(reclassified).toBe(zone);
    }
  });

  it('propaga cadenceProfile del SessionBlock al ClassifiedSegment', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'work', zone: 4, cadenceProfile: 'climb', durationSec: 60 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 6, cadenceProfile: 'sprint', durationSec: 30 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments[0]?.cadenceProfile).toBe('climb');
    expect(segments[1]?.cadenceProfile).toBe('sprint');
  });

  it('usa FTP estimado (2.5 W/kg) si el usuario no aporta FTP', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 2, cadenceProfile: 'flat', durationSec: 60 } }],
    });
    const segments = classifySessionPlan(plan, userWithoutFtp);
    // FTP estimado = 2.5 * 70 = 175 W. Z2 midpoint = 65% → 113.75 W
    expect(segments[0]?.avgPowerWatts).toBeCloseTo(175 * 0.65, 1);
  });

  it('descarta bloques con duracion 0', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'work', zone: 2, cadenceProfile: 'flat', durationSec: 0 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.zone).toBe(4);
  });

  it('campos de geografia en 0 (sesion indoor sin coordenadas)', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 3, cadenceProfile: 'flat', durationSec: 60 } }],
    });
    const segment = classifySessionPlan(plan, userWithFtp)[0];
    expect(segment?.startDistanceMeters).toBe(0);
    expect(segment?.endDistanceMeters).toBe(0);
    expect(segment?.startElevationMeters).toBe(0);
    expect(segment?.endElevationMeters).toBe(0);
    expect(segment?.startLat).toBe(0);
    expect(segment?.startLon).toBe(0);
  });
});

describe('buildSessionRouteMeta', () => {
  it('totalDurationSec coincide con la suma de durationSec de los bloques', () => {
    const plan: EditableSessionPlan = {
      name: 'mi sesion',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 600 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 240 } },
      ],
    };
    const expanded = expandSessionPlan(plan);
    const segments = classifySessionPlan(expanded, userWithFtp);
    const meta = buildSessionRouteMeta(expanded, segments);
    expect(meta.totalDurationSec).toBe(840);
    expect(meta.name).toBe('mi sesion');
  });

  it('campos de geografia en 0 y hadRealTimestamps en false', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 3, cadenceProfile: 'flat', durationSec: 60 } }],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    const meta = buildSessionRouteMeta(plan, segments);
    expect(meta.totalDistanceMeters).toBe(0);
    expect(meta.totalElevationGainMeters).toBe(0);
    expect(meta.totalElevationLossMeters).toBe(0);
    expect(meta.hadRealTimestamps).toBe(false);
  });

  it('zoneDurationsSec suman totalDurationSec', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 100 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 200 } },
        { type: 'block', block: { id: 'c', phase: 'cooldown', zone: 1, cadenceProfile: 'flat', durationSec: 50 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    const meta = buildSessionRouteMeta(plan, segments);
    const sumZones = Object.values(meta.zoneDurationsSec).reduce((a, b) => a + b, 0);
    expect(sumZones).toBe(meta.totalDurationSec);
    expect(meta.zoneDurationsSec[2]).toBe(100);
    expect(meta.zoneDurationsSec[4]).toBe(200);
    expect(meta.zoneDurationsSec[1]).toBe(50);
  });

  it('NP >= averagePower', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 1, cadenceProfile: 'flat', durationSec: 600 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 5, cadenceProfile: 'climb', durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    const meta = buildSessionRouteMeta(plan, segments);
    expect(meta.normalizedPowerWatts).toBeGreaterThanOrEqual(meta.averagePowerWatts - 0.001);
  });
});

describe('SESSION_TEMPLATES integracion', () => {
  it('cada plantilla expandida produce ClassifiedSegment[] valido', () => {
    for (const template of SESSION_TEMPLATES) {
      const expanded = expandSessionPlan({ name: template.name, items: [...template.items] });
      const segments = classifySessionPlan(expanded, userWithFtp);
      expect(segments.length).toBeGreaterThan(0);
      for (const s of segments) {
        expect(s.durationSec).toBeGreaterThan(0);
        expect(s.zone).toBeGreaterThanOrEqual(1);
        expect(s.zone).toBeLessThanOrEqual(6);
        // cadenceProfile siempre se propaga
        expect(['flat', 'climb', 'sprint']).toContain(s.cadenceProfile);
      }
    }
  });

  it('SIT suma ~37 minutos', () => {
    const sit = SESSION_TEMPLATES.find((t) => t.id === 'sit');
    expect(sit).toBeDefined();
    const expanded = expandSessionPlan({ name: 'x', items: [...sit!.items] });
    const total = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    // 5' warmup + 6 × (30s + 4') + 5' cooldown = 300 + 6 × 270 + 300 = 2220 = 37 min
    expect(total).toBe(2220);
  });

  it('Noruego 4×4 suma ~48 minutos', () => {
    const nor = SESSION_TEMPLATES.find((t) => t.id === 'noruego-4x4');
    expect(nor).toBeDefined();
    const expanded = expandSessionPlan({ name: 'x', items: [...nor!.items] });
    const total = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    // 10' + 4 × (4' + 3') + 10' = 600 + 4 × 420 + 600 = 2880 = 48 min
    expect(total).toBe(2880);
  });

  it('Zona 2 continuo suma 80 minutos', () => {
    const z2 = SESSION_TEMPLATES.find((t) => t.id === 'zona2-continuo');
    expect(z2).toBeDefined();
    const expanded = expandSessionPlan({ name: 'x', items: [...z2!.items] });
    const total = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    expect(total).toBe(80 * 60);
  });

  it('HIIT 10-20-30 suma 43 minutos (10 warmup + 4 × (5min + 2min recovery) + 5 cooldown)', () => {
    const hiit = SESSION_TEMPLATES.find((t) => t.id === 'hiit-10-20-30');
    expect(hiit).toBeDefined();
    const expanded = expandSessionPlan({ name: 'x', items: [...hiit!.items] });
    const total = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    // 10' warmup + 4 × (5 × (30 + 20 + 10) + 120) + 5' cooldown
    // = 600 + 4 × 420 + 300 = 600 + 1680 + 300 = 2580 = 43 min
    expect(total).toBe(2580);
  });
});

/**
 * Tests del preprocesado coalescing + detectIntervalSets aplicado dentro de
 * classifySessionPlan. Garantiza que las plantillas interválicas se reducen
 * a macrobloques de zona alta (resolviendo el caso "track de recuperacion
 * sonando en intervalo Z4/Z5/Z6") y que las plantillas no interválicas
 * conservan su estructura original.
 *
 * La duracion total del plan SIEMPRE debe preservarse (los preprocesados
 * suman, nunca descartan tiempo).
 */
describe('classifySessionPlan — preprocesado para plantillas reales', () => {
  it('SIT: el set se fusiona en 1 macrobloque Z6 sprint, warmup y cooldown intactos', () => {
    const sit = SESSION_TEMPLATES.find((t) => t.id === 'sit')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...sit.items] });
    const totalOriginal = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);

    const segments = classifySessionPlan(expanded, userWithFtp);

    expect(segments).toHaveLength(3);
    expect(segments[0]?.zone).toBe(2); // warmup
    expect(segments[1]?.zone).toBe(6); // macrobloque
    expect(segments[1]?.cadenceProfile).toBe('sprint');
    expect(segments[1]?.durationSec).toBe(6 * (30 + 4 * 60)); // 1620
    expect(segments[2]?.zone).toBe(1); // cooldown

    const totalClassified = segments.reduce((acc, s) => acc + s.durationSec, 0);
    expect(totalClassified).toBe(totalOriginal);
  });

  it('HIIT 10-20-30: cada bloque se fusiona en un macrobloque Z6 sprint, separados por recoveries Z2', () => {
    const hiit = SESSION_TEMPLATES.find((t) => t.id === 'hiit-10-20-30')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...hiit.items] });
    const totalOriginal = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);

    const segments = classifySessionPlan(expanded, userWithFtp);

    // warmup + 4 × (macrobloque Z6 + recovery Z2) + cooldown = 10 segmentos
    expect(segments).toHaveLength(10);
    expect(segments[0]?.zone).toBe(2); // warmup
    expect(segments[9]?.zone).toBe(1); // cooldown

    // 4 macrobloques Z6 sprint en posiciones impares 1, 3, 5, 7
    for (const i of [1, 3, 5, 7]) {
      expect(segments[i]?.zone, `segmento ${i} debe ser Z6`).toBe(6);
      expect(segments[i]?.cadenceProfile, `segmento ${i} debe ser sprint`).toBe('sprint');
      expect(segments[i]?.durationSec, `segmento ${i} dura 5 min`).toBe(5 * (30 + 20 + 10)); // 300
    }
    // 4 recoveries Z2 flat de 2 min en posiciones 2, 4, 6, 8 (incluye el ultimo
    // del grupo × 4, antes del cooldown — convencion compartida con Noruego/etc).
    for (const i of [2, 4, 6, 8]) {
      expect(segments[i]?.zone, `segmento ${i} debe ser Z2`).toBe(2);
      expect(segments[i]?.cadenceProfile, `segmento ${i} debe ser flat`).toBe('flat');
      expect(segments[i]?.durationSec, `segmento ${i} dura 2 min`).toBe(120);
    }

    const totalClassified = segments.reduce((acc, s) => acc + s.durationSec, 0);
    expect(totalClassified).toBe(totalOriginal);
  });

  it('VO2max Cortos: el set se fusiona en 1 macrobloque Z5 climb', () => {
    const vo2 = SESSION_TEMPLATES.find((t) => t.id === 'vo2max-cortos')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...vo2.items] });
    const totalOriginal = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);

    const segments = classifySessionPlan(expanded, userWithFtp);

    expect(segments).toHaveLength(3);
    expect(segments[0]?.zone).toBe(2); // warmup
    expect(segments[1]?.zone).toBe(5); // macrobloque climb
    expect(segments[1]?.cadenceProfile).toBe('climb');
    expect(segments[1]?.durationSec).toBe(6 * (2 * 60 + 90)); // 1260
    expect(segments[2]?.zone).toBe(1); // cooldown

    const totalClassified = segments.reduce((acc, s) => acc + s.durationSec, 0);
    expect(totalClassified).toBe(totalOriginal);
  });

  it('Noruego 4×4: NO se fusiona (work=240 ≥ 180), conserva estructura alterna', () => {
    const nor = SESSION_TEMPLATES.find((t) => t.id === 'noruego-4x4')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...nor.items] });

    const segments = classifySessionPlan(expanded, userWithFtp);

    // 1 warmup + 4 × (work + recovery) + 1 cooldown = 10 segments
    expect(segments).toHaveLength(10);
    // Alternancia Z4/Z2 dentro del set
    expect(segments[1]?.zone).toBe(4);
    expect(segments[2]?.zone).toBe(2);
    expect(segments[3]?.zone).toBe(4);
    expect(segments[4]?.zone).toBe(2);
  });

  it('Tempo MLSS: NO se fusiona (Z3 < 4 y work=720 ≥ 180)', () => {
    const tempo = SESSION_TEMPLATES.find((t) => t.id === 'tempo-mlss')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...tempo.items] });

    const segments = classifySessionPlan(expanded, userWithFtp);

    // 1 warmup + 3 × (work + recovery) + 1 cooldown = 8 segments
    expect(segments).toHaveLength(8);
    expect(segments[1]?.zone).toBe(3);
    expect(segments[2]?.zone).toBe(2);
  });

  it('Umbral Progresivo: NO se fusiona (work=300 ≥ 180)', () => {
    const umbral = SESSION_TEMPLATES.find((t) => t.id === 'umbral-progresivo')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...umbral.items] });

    const segments = classifySessionPlan(expanded, userWithFtp);

    // 1 warmup + 5 × (work + recovery) + 1 cooldown = 12 segments
    expect(segments).toHaveLength(12);
    expect(segments[1]?.zone).toBe(4);
    expect(segments[2]?.zone).toBe(2);
  });

  it('Z2 Continuo: NO se fusiona, conserva 3 bloques', () => {
    const z2 = SESSION_TEMPLATES.find((t) => t.id === 'zona2-continuo')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...z2.items] });

    const segments = classifySessionPlan(expanded, userWithFtp);

    expect(segments).toHaveLength(3);
    expect(segments[1]?.zone).toBe(2);
    expect(segments[1]?.durationSec).toBe(60 * 60);
  });

  it('Recuperacion Activa: NO se fusiona, conserva 3 bloques', () => {
    const recup = SESSION_TEMPLATES.find((t) => t.id === 'recuperacion-activa')!;
    const expanded = expandSessionPlan({ name: 'x', items: [...recup.items] });

    const segments = classifySessionPlan(expanded, userWithFtp);

    expect(segments).toHaveLength(3);
  });

  it('coalescing: 3 bloques contiguos Z2 flat warmup → 1 segmento Z2 flat', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 60 } },
        { type: 'block', block: { id: 'b', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 60 } },
        { type: 'block', block: { id: 'c', phase: 'warmup', zone: 2, cadenceProfile: 'flat', durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.durationSec).toBe(180);
    expect(segments[0]?.zone).toBe(2);
  });
});
