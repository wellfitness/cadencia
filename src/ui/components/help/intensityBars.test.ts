import { describe, it, expect } from 'vitest';
import { findTemplate, SESSION_TEMPLATES } from '@core/segmentation';
import { buildIntensityBars } from './intensityBars';

describe('buildIntensityBars — patrones manuales', () => {
  it.each([8, 24] as const)('todas las plantillas devuelven exactamente N=%i barras', (n) => {
    for (const template of SESSION_TEMPLATES) {
      const bars = buildIntensityBars(template, n);
      expect(bars, template.id).toHaveLength(n);
    }
  });

  it('todas las plantillas empiezan con calentamiento (Z1 o Z2) y terminan en Z1 con N=24', () => {
    for (const template of SESSION_TEMPLATES) {
      const bars = buildIntensityBars(template, 24);
      const first = bars[0];
      const last = bars[bars.length - 1];
      expect([1, 2], `${template.id} primera barra`).toContain(first);
      expect(last, `${template.id} ultima barra`).toBe(1);
    }
  });

  it('plantillas de intervalos muestran su zona pico en al menos una barra (N=24)', () => {
    const peakByTemplate = {
      'tempo-mlss': 3,
      'umbral-progresivo': 4,
      'noruego-4x4': 4,
      'hiit-10-20-30': 6,
      'vo2max-cortos': 5,
      sit: 6,
    } as const;
    for (const [id, peak] of Object.entries(peakByTemplate)) {
      const bars = buildIntensityBars(findTemplate(id)!, 24);
      expect(bars, id).toContain(peak);
    }
  });

  it('zona2-continuo y recuperacion-activa son monotonas Z1/Z2 en N=24', () => {
    for (const id of ['zona2-continuo', 'recuperacion-activa'] as const) {
      const bars = buildIntensityBars(findTemplate(id)!, 24);
      for (const b of bars) {
        expect([1, 2], `${id} barra fuera de Z1/Z2`).toContain(b);
      }
    }
  });

  it('determinismo: misma plantilla y N producen misma salida', () => {
    const tpl = findTemplate('vo2max-cortos')!;
    expect(buildIntensityBars(tpl, 12)).toEqual(buildIntensityBars(tpl, 12));
    expect(buildIntensityBars(tpl, 24)).toEqual(buildIntensityBars(tpl, 24));
  });

  it('fallback algoritmico funciona para N no curado (N=12)', () => {
    const tpl = findTemplate('noruego-4x4')!;
    const bars = buildIntensityBars(tpl, 12);
    expect(bars).toHaveLength(12);
    // Aparece la zona pico Z4 en algun punto del fallback
    expect(bars).toContain(4);
  });
});
