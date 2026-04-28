import { describe, it, expect } from 'vitest';
import { computeNextBikeWeight } from './bikeWeight';
import { DEFAULTS } from '@core/user';

describe('computeNextBikeWeight', () => {
  it('si el peso actual es null (placeholder), pre-carga el default del nuevo tipo', () => {
    expect(
      computeNextBikeWeight({ prevType: 'gravel', nextType: 'road', currentWeight: null }),
    ).toBe(DEFAULTS.bikeWeightByType.road);
    expect(
      computeNextBikeWeight({ prevType: 'gravel', nextType: 'mtb', currentWeight: null }),
    ).toBe(DEFAULTS.bikeWeightByType.mtb);
  });

  it('si el peso actual es exactamente el default del tipo previo, lo cambia al nuevo default', () => {
    // Gravel default = 10. El usuario no toco -> al pasar a road le dejamos 8.
    expect(
      computeNextBikeWeight({ prevType: 'gravel', nextType: 'road', currentWeight: 10 }),
    ).toBe(DEFAULTS.bikeWeightByType.road);
    // Road default = 8 -> MTB default = 13.
    expect(
      computeNextBikeWeight({ prevType: 'road', nextType: 'mtb', currentWeight: 8 }),
    ).toBe(DEFAULTS.bikeWeightByType.mtb);
  });

  it('si el usuario tecleo un valor distinto del default, lo respeta (devuelve null)', () => {
    // Usuario tecleo 9 con gravel (default 10) -> al cambiar a road no sobrescribe.
    expect(
      computeNextBikeWeight({ prevType: 'gravel', nextType: 'road', currentWeight: 9 }),
    ).toBeNull();
    expect(
      computeNextBikeWeight({ prevType: 'road', nextType: 'mtb', currentWeight: 7 }),
    ).toBeNull();
  });

  it('si prevType es null, asume el default del DEFAULTS.bikeType', () => {
    // DEFAULTS.bikeType = 'gravel', default 10. Si el usuario tiene 10 con prevType null,
    // se considera default y se reemplaza.
    expect(
      computeNextBikeWeight({ prevType: null, nextType: 'road', currentWeight: 10 }),
    ).toBe(DEFAULTS.bikeWeightByType.road);
    expect(
      computeNextBikeWeight({ prevType: null, nextType: 'mtb', currentWeight: 9 }),
    ).toBeNull();
  });

  it('cambiar al mismo tipo con valor default no es no-op (devuelve mismo default)', () => {
    // Caso degenerado: cambiar gravel -> gravel con currentWeight=10. Devolveriamos
    // 10 de nuevo, sin efecto practico. La funcion no se preocupa de evitar
    // este dispatch redundante (es responsabilidad del caller si quiere optimizar).
    expect(
      computeNextBikeWeight({ prevType: 'gravel', nextType: 'gravel', currentWeight: 10 }),
    ).toBe(10);
  });

  it('determinismo: misma entrada -> misma salida', () => {
    const args = { prevType: 'gravel' as const, nextType: 'road' as const, currentWeight: 10 };
    expect(computeNextBikeWeight(args)).toBe(computeNextBikeWeight(args));
  });
});
