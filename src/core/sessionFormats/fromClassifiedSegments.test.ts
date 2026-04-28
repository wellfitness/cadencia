import { describe, it, expect } from 'vitest';
import { gpxToEditableSessionPlan } from './fromClassifiedSegments';
import { exportZwo } from './zwo';
import type { ClassifiedSegment } from '../segmentation/types';
import type { CadenceProfile } from '../segmentation/sessionPlan';
import type { HeartRateZone } from '../physiology/karvonen';

function seg(zone: HeartRateZone, cadence: CadenceProfile, durationSec: number): ClassifiedSegment {
  return {
    startSec: 0,
    durationSec,
    avgPowerWatts: 200,
    zone,
    cadenceProfile: cadence,
    startDistanceMeters: 0,
    endDistanceMeters: 0,
    startElevationMeters: 0,
    endElevationMeters: 0,
    startLat: 0,
    startLon: 0,
  };
}

describe('gpxToEditableSessionPlan', () => {
  it('vacío → plan vacío con name', () => {
    const plan = gpxToEditableSessionPlan([], 'Mi ruta');
    expect(plan.name).toBe('Mi ruta');
    expect(plan.items).toEqual([]);
  });

  it('un único segmento → un único item block', () => {
    const plan = gpxToEditableSessionPlan([seg(3, 'flat', 60)], 'Test');
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0]!;
    expect(item.type).toBe('block');
    if (item.type === 'block') {
      expect(item.block.zone).toBe(3);
      expect(item.block.cadenceProfile).toBe('flat');
      expect(item.block.durationSec).toBe(60);
    }
  });

  it('tres segmentos consecutivos misma (zona, cadenceProfile) se mergean', () => {
    const segments = [seg(2, 'flat', 60), seg(2, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0]!;
    expect(item.type).toBe('block');
    if (item.type === 'block') {
      expect(item.block.durationSec).toBe(180);
      expect(item.block.zone).toBe(2);
    }
  });

  it('cambio de zona rompe el merge', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(3);
  });

  it('cambio de cadenceProfile (mismo zone) rompe el merge', () => {
    const segments = [seg(3, 'flat', 60), seg(3, 'climb', 60), seg(3, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(3);
  });

  it('primer bloque Z1-Z2 se etiqueta como warmup', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const first = plan.items[0]!;
    expect(first.type).toBe('block');
    if (first.type === 'block') expect(first.block.phase).toBe('warmup');
  });

  it('último bloque Z1-Z2 se etiqueta como cooldown', () => {
    const segments = [seg(4, 'flat', 60), seg(1, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const last = plan.items[plan.items.length - 1]!;
    expect(last.type).toBe('block');
    if (last.type === 'block') expect(last.block.phase).toBe('cooldown');
  });

  it('Z1-Z2 intermedio se etiqueta como recovery', () => {
    const segments = [seg(4, 'flat', 60), seg(2, 'flat', 60), seg(4, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const middle = plan.items[1]!;
    expect(middle.type).toBe('block');
    if (middle.type === 'block') expect(middle.block.phase).toBe('recovery');
  });

  it('Z3-Z6 intermedio se etiqueta como work', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const middle = plan.items[1]!;
    expect(middle.type).toBe('block');
    if (middle.type === 'block') expect(middle.block.phase).toBe('work');
  });

  it('IDs únicos y estables', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const ids = plan.items.map((it) => (it.type === 'block' ? it.block.id : ''));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('gpx-0');
    expect(ids[1]).toBe('gpx-1');
    expect(ids[2]).toBe('gpx-2');
  });

  it('round-trip via exportZwo no lanza y produce XML válido', () => {
    const segments = [
      seg(2, 'flat', 120),
      seg(4, 'flat', 180),
      seg(5, 'climb', 60),
      seg(2, 'flat', 120),
    ];
    const plan = gpxToEditableSessionPlan(segments, 'Mi ruta del domingo');
    const xml = exportZwo(plan);
    expect(xml).toContain('<workout_file>');
    expect(xml).toContain('<name>Mi ruta del domingo</name>');
    expect(xml).toContain('<SteadyState');
  });

  it('duración fraccionaria se redondea (ZWO solo acepta enteros)', () => {
    const plan = gpxToEditableSessionPlan([seg(3, 'flat', 59.7)], 'Test');
    const item = plan.items[0]!;
    if (item.type === 'block') expect(item.block.durationSec).toBe(60);
  });
});
