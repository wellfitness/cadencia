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
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, durationSec: 300 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 240 } },
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
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, durationSec: 100 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 200 } },
        { type: 'block', block: { id: 'c', phase: 'cooldown', zone: 1, durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments[0]?.startSec).toBe(0);
    expect(segments[1]?.startSec).toBe(100);
    expect(segments[2]?.startSec).toBe(300);
  });

  it('cierra el bucle: la potencia sintetica de cada zona vuelve a clasificarse en la misma zona', () => {
    // Para cada zona Z1-Z5, generamos un bloque en esa zona y verificamos que
    // classifyZone() recupera la zona original a partir de la potencia sintetica.
    for (const zone of [1, 2, 3, 4, 5] as const) {
      const plan = expandSessionPlan({
        name: 'x',
        items: [{ type: 'block', block: { id: 'b', phase: 'work', zone, durationSec: 60 } }],
      });
      const segment = classifySessionPlan(plan, userWithFtp)[0];
      expect(segment).toBeDefined();
      const reclassified = classifyZone(segment!.avgPowerWatts, userWithFtp);
      expect(reclassified).toBe(zone);
    }
  });

  it('usa FTP estimado (2.5 W/kg) si el usuario no aporta FTP', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 2, durationSec: 60 } }],
    });
    const segments = classifySessionPlan(plan, userWithoutFtp);
    // FTP estimado = 2.5 * 70 = 175 W. Z2 midpoint = 65% → 113.75 W
    expect(segments[0]?.avgPowerWatts).toBeCloseTo(175 * 0.65, 1);
  });

  it('descarta bloques con duracion 0', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [
        { type: 'block', block: { id: 'a', phase: 'work', zone: 2, durationSec: 0 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 60 } },
      ],
    });
    const segments = classifySessionPlan(plan, userWithFtp);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.zone).toBe(4);
  });

  it('campos de geografia en 0 (sesion indoor sin coordenadas)', () => {
    const plan = expandSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 3, durationSec: 60 } }],
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
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, durationSec: 600 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 240 } },
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
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 3, durationSec: 60 } }],
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
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 2, durationSec: 100 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 200 } },
        { type: 'block', block: { id: 'c', phase: 'cooldown', zone: 1, durationSec: 50 } },
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
        { type: 'block', block: { id: 'a', phase: 'warmup', zone: 1, durationSec: 600 } },
        { type: 'block', block: { id: 'b', phase: 'work', zone: 5, durationSec: 60 } },
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
        expect(s.zone).toBeLessThanOrEqual(5);
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

  it('HIIT 10-20-30 suma 35 minutos (10 warmup + 4 × 5min + 5 cooldown)', () => {
    const hiit = SESSION_TEMPLATES.find((t) => t.id === 'hiit-10-20-30');
    expect(hiit).toBeDefined();
    const expanded = expandSessionPlan({ name: 'x', items: [...hiit!.items] });
    const total = expanded.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    // 10' warmup + 4 × (5 × (30 + 20 + 10)) + 5' cooldown
    // = 600 + 4 × 300 + 300 = 600 + 1200 + 300 = 2100 = 35 min
    expect(total).toBe(2100);
  });
});
