import { describe, it, expect } from 'vitest';
import { calculateNormalizedPower } from './normalizedPower';

describe('calculateNormalizedPower', () => {
  it('vacío → 0', () => {
    expect(calculateNormalizedPower([])).toBe(0);
  });

  it('potencia constante → NP === media', () => {
    // 60s a 200W
    const samples = Array.from({ length: 60 }, () => ({ powerWatts: 200, durationSec: 1 }));
    const np = calculateNormalizedPower(samples);
    expect(np).toBeCloseTo(200, 1);
  });

  it('potencia variable → NP > media', () => {
    // 60s a 100W + 30s a 600W. Media = (60·100 + 30·600)/90 ≈ 266.7W
    // NP debe ser claramente mayor por el peso ^4.
    const samples = [
      ...Array.from({ length: 60 }, () => ({ powerWatts: 100, durationSec: 1 })),
      ...Array.from({ length: 30 }, () => ({ powerWatts: 600, durationSec: 1 })),
    ];
    const np = calculateNormalizedPower(samples);
    const total = samples.reduce((a, s) => a + s.powerWatts * s.durationSec, 0);
    const avg = total / samples.reduce((a, s) => a + s.durationSec, 0);
    expect(np).toBeGreaterThan(avg + 20);
  });

  it('rolling 30s suaviza picos sub-30s (sprint de 5s no domina)', () => {
    // 5s a 1000W aislado dentro de 600s a 200W. Sin rolling 30s el ^4
    // explotaría; con rolling 30s, el pico se promedia sobre la ventana
    // y NP queda sólo ligeramente sobre 200W.
    const samples = [
      ...Array.from({ length: 300 }, () => ({ powerWatts: 200, durationSec: 1 })),
      ...Array.from({ length: 5 }, () => ({ powerWatts: 1000, durationSec: 1 })),
      ...Array.from({ length: 295 }, () => ({ powerWatts: 200, durationSec: 1 })),
    ];
    const np = calculateNormalizedPower(samples);
    expect(np).toBeGreaterThan(210);
    expect(np).toBeLessThan(260);
  });

  it('serie demasiado corta (< 30s) cae a la media simple', () => {
    const samples = Array.from({ length: 10 }, () => ({ powerWatts: 250, durationSec: 1 }));
    expect(calculateNormalizedPower(samples)).toBeCloseTo(250, 1);
  });

  it('soporta segmentos con duracionSec > 1 (resamplea correctamente)', () => {
    // 60s a 200W expresado como 6 segmentos de 10s cada uno.
    const samples = Array.from({ length: 6 }, () => ({ powerWatts: 200, durationSec: 10 }));
    expect(calculateNormalizedPower(samples)).toBeCloseTo(200, 1);
  });

  it('NP siempre >= media (Cauchy-Schwarz / Jensen)', () => {
    const samples = [
      { powerWatts: 100, durationSec: 30 },
      { powerWatts: 150, durationSec: 30 },
      { powerWatts: 350, durationSec: 30 },
      { powerWatts: 200, durationSec: 30 },
    ];
    const np = calculateNormalizedPower(samples);
    const total = samples.reduce((a, s) => a + s.powerWatts * s.durationSec, 0);
    const avg = total / samples.reduce((a, s) => a + s.durationSec, 0);
    expect(np).toBeGreaterThanOrEqual(avg - 0.001);
  });

  it('determinista: misma entrada → misma salida', () => {
    const samples = Array.from({ length: 200 }, (_, i) => ({
      powerWatts: 150 + (i % 50) * 5,
      durationSec: 1,
    }));
    expect(calculateNormalizedPower(samples)).toBe(calculateNormalizedPower(samples));
  });
});
