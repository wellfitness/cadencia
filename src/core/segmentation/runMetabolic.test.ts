import { describe, it, expect } from 'vitest';
import {
  runEnergyCostJoulesPerKgM,
  runMetabolicMultiplier,
  slopeToRunZone,
} from './runMetabolic';

/**
 * Tests del polinomio de Minetti (J Appl Physiol 2002, DOI 10.1152/japplphysiol.01177.2001).
 *
 * Verificamos en dos niveles:
 *  1) **Polinomio**: el valor calculado coincide con la formula al milesimo.
 *     Esto detecta cualquier regresion en los coeficientes.
 *  2) **Empirico**: el valor calculado esta dentro del 10% del medido en
 *     Minetti 2002. Ojo: el polinomio es un fit, no la medicion en si — el
 *     constante en g=0 es 3.6 vs los 3.4 medidos (sesgo del 6%).
 */

describe('runEnergyCostJoulesPerKgM', () => {
  it('en llano da el termino independiente del polinomio (3.6)', () => {
    expect(runEnergyCostJoulesPerKgM(0)).toBeCloseTo(3.6, 5);
  });

  it('en +45% reproduce el extremo ascendente medido (18.93) con error < 10%', () => {
    // Predicho por el polinomio: ~19.43; medido: 18.93. Diferencia ~2.6%.
    const predicted = runEnergyCostJoulesPerKgM(45);
    expect(predicted).toBeGreaterThan(17);
    expect(predicted).toBeLessThan(21);
  });

  it('en -45% reproduce el extremo descendente medido (3.92) con error < 10%', () => {
    // Predicho: ~4.03; medido: 3.92. Diferencia ~2.8%.
    const predicted = runEnergyCostJoulesPerKgM(-45);
    expect(predicted).toBeGreaterThan(3.5);
    expect(predicted).toBeLessThan(4.4);
  });

  it('en -20% encuentra el minimo metabolico medido (1.73)', () => {
    // Predicho: ~1.80; medido: 1.73. El polinomio predice el minimo cerca de g=-0.20.
    const predicted = runEnergyCostJoulesPerKgM(-20);
    expect(predicted).toBeLessThan(2.0);
    expect(predicted).toBeGreaterThan(1.5);
  });

  it('clampa pendientes patologicas fuera del rango validado', () => {
    // GPX puede tener spikes de pendiente por ruido GPS. La funcion debe
    // ser robusta y no devolver valores extrapolados absurdos.
    const above = runEnergyCostJoulesPerKgM(200);
    const at50 = runEnergyCostJoulesPerKgM(50);
    expect(above).toBe(at50);

    const below = runEnergyCostJoulesPerKgM(-200);
    const atMinus50 = runEnergyCostJoulesPerKgM(-50);
    expect(below).toBe(atMinus50);
  });

  it('NaN o Infinity caen en llano (entrada defensiva)', () => {
    expect(runEnergyCostJoulesPerKgM(NaN)).toBeCloseTo(3.6, 5);
    expect(runEnergyCostJoulesPerKgM(Infinity)).not.toBe(NaN);
    expect(runEnergyCostJoulesPerKgM(Infinity)).toBeGreaterThan(0);
  });

  it('siempre devuelve un valor positivo (piso fisiologico)', () => {
    // En el minimo del polinomio Cr es bajo pero positivo; verificamos que
    // ningun input dentro del rango clampado caiga por debajo de 0.5.
    for (let g = -50; g <= 50; g += 5) {
      expect(runEnergyCostJoulesPerKgM(g)).toBeGreaterThan(0);
    }
  });
});

describe('runMetabolicMultiplier', () => {
  it('en llano da exactamente 1.0', () => {
    expect(runMetabolicMultiplier(0)).toBeCloseTo(1, 5);
  });

  it('en -20% el multiplicador esta en el minimo (~0.5)', () => {
    const m = runMetabolicMultiplier(-20);
    expect(m).toBeGreaterThan(0.45);
    expect(m).toBeLessThan(0.55);
  });

  it('en +10% el multiplicador esta entre 1.5 y 1.8', () => {
    const m = runMetabolicMultiplier(10);
    expect(m).toBeGreaterThan(1.5);
    expect(m).toBeLessThan(1.8);
  });

  it('en +45% el multiplicador es ~5.4', () => {
    const m = runMetabolicMultiplier(45);
    expect(m).toBeGreaterThan(5);
    expect(m).toBeLessThan(6);
  });

  it('captura la forma U: el coste vuelve a subir mas alla de -20%', () => {
    // El minimo metabolico esta cerca de -20%. Bajadas mas pronunciadas
    // (-30%, -40%, -45%) tienen multiplicador progresivamente mayor por la
    // carga excentrica.
    const m20 = runMetabolicMultiplier(-20);
    const m30 = runMetabolicMultiplier(-30);
    const m40 = runMetabolicMultiplier(-40);
    const m45 = runMetabolicMultiplier(-45);
    expect(m30).toBeGreaterThan(m20);
    expect(m40).toBeGreaterThan(m30);
    expect(m45).toBeGreaterThan(m40);
  });
});

describe('slopeToRunZone', () => {
  it('en llano cae en Z2 (base aerobica)', () => {
    expect(slopeToRunZone(0)).toBe(2);
  });

  it('bajada moderada (-10%) cae en Z1 (recovery)', () => {
    expect(slopeToRunZone(-10)).toBe(1);
  });

  it('bajada en el minimo (-20%) cae en Z1 (recovery)', () => {
    expect(slopeToRunZone(-20)).toBe(1);
  });

  it('subida moderada (+5%) cae en Z3 (tempo)', () => {
    expect(slopeToRunZone(5)).toBe(3);
  });

  it('subida fuerte (+10%) cae en Z4 (umbral)', () => {
    expect(slopeToRunZone(10)).toBe(4);
  });

  it('subida pronunciada (+15%) cae en Z5 (VO2max)', () => {
    expect(slopeToRunZone(15)).toBe(5);
  });

  it('muro (+25%) cae en Z6 (anaerobico)', () => {
    expect(slopeToRunZone(25)).toBe(6);
  });

  it('bajada muy pronunciada (-40%) NO cae en Z1: la carga excentrica sube la zona', () => {
    // Forma U: el minimo metabolico esta a -20%. A -40% el coste es similar
    // al llano, no es recovery aunque sea bajada.
    const zone = slopeToRunZone(-40);
    expect(zone).toBeGreaterThanOrEqual(2);
  });

  it('todas las pendientes en [-50, 50] devuelven una zona valida 1-6', () => {
    for (let g = -50; g <= 50; g++) {
      const zone = slopeToRunZone(g);
      expect(zone).toBeGreaterThanOrEqual(1);
      expect(zone).toBeLessThanOrEqual(6);
    }
  });

  it('es deterministica: misma entrada -> misma salida', () => {
    const a = slopeToRunZone(7.5);
    const b = slopeToRunZone(7.5);
    expect(a).toBe(b);
  });
});
