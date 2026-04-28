import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { HeartRateZone } from '@core/physiology/karvonen';
import { ZoneStackedBar } from './ZoneStackedBar';

function makeZoneDurations(
  partial: Partial<Record<HeartRateZone, number>>,
): Record<HeartRateZone, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...partial };
}

describe('ZoneStackedBar', () => {
  it('renderiza un segmento por zona con duracion > 0, ancho proporcional', () => {
    const { container } = render(
      <ZoneStackedBar
        zoneDurationsSec={makeZoneDurations({ 1: 60, 2: 60, 3: 120 })}
        totalSec={240}
      />,
    );
    const segments = container.querySelectorAll('[data-zone]');
    expect(segments).toHaveLength(3);

    const widths = Array.from(segments).map((el) => (el as HTMLElement).style.width);
    // 60/240 = 25%, 60/240 = 25%, 120/240 = 50%
    expect(widths).toEqual(['25%', '25%', '50%']);

    // Cada segmento aplica la clase de fondo de su zona.
    expect((segments[0] as HTMLElement).getAttribute('data-zone')).toBe('1');
    expect((segments[0] as HTMLElement).className).toContain('bg-zone-1');
    expect((segments[1] as HTMLElement).className).toContain('bg-zone-2');
    expect((segments[2] as HTMLElement).className).toContain('bg-zone-3');
  });

  it('omite segmentos con duracion 0', () => {
    const { container } = render(
      <ZoneStackedBar
        zoneDurationsSec={makeZoneDurations({ 1: 100, 3: 100 })}
        totalSec={200}
      />,
    );
    const segments = container.querySelectorAll('[data-zone]');
    expect(segments).toHaveLength(2);
    const zonesRendered = Array.from(segments).map((el) => el.getAttribute('data-zone'));
    expect(zonesRendered).toEqual(['1', '3']);
  });

  it('totalSec === 0 no rompe (sin infinitos ni NaN), renderiza solo el track', () => {
    const { container } = render(
      <ZoneStackedBar
        zoneDurationsSec={makeZoneDurations({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })}
        totalSec={0}
      />,
    );
    const segments = container.querySelectorAll('[data-zone]');
    expect(segments).toHaveLength(0);

    const wrapper = container.querySelector('[role="img"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('aria-label')).toBe(
      'Distribución de tiempo por zona: sin datos',
    );
  });

  it('aria-label contiene los porcentajes esperados, omitiendo zonas con 0%', () => {
    // Z1=80s, Z2=70s, Z3=50s, Z4=0, Z5=0, total 200 -> 40%, 35%, 25%
    const { container } = render(
      <ZoneStackedBar
        zoneDurationsSec={makeZoneDurations({ 1: 80, 2: 70, 3: 50 })}
        totalSec={200}
      />,
    );
    const wrapper = container.querySelector('[role="img"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('aria-label')).toBe(
      'Distribución de tiempo por zona: Z1 40%, Z2 35%, Z3 25%',
    );
  });

  it('aplica className extra cuando se le pasa', () => {
    const { container } = render(
      <ZoneStackedBar
        zoneDurationsSec={makeZoneDurations({ 1: 100 })}
        totalSec={100}
        className="mb-4 custom-extra"
      />,
    );
    const wrapper = container.querySelector('[role="img"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('mb-4');
    expect(wrapper?.className).toContain('custom-extra');
  });
});
