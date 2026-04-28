import { describe, it, expect } from 'vitest';
import { buildErrorSummary } from './userDataErrorSummary';
import type { ValidationError } from '@core/user';

describe('buildErrorSummary', () => {
  it('devuelve cadena vacia si no hay errores', () => {
    expect(buildErrorSummary([])).toBe('');
  });

  it('un solo error -> "Falta 1 dato: ..."', () => {
    const errors: ValidationError[] = [{ code: 'WEIGHT_REQUIRED' }];
    expect(buildErrorSummary(errors)).toBe('Falta 1 dato: peso.');
  });

  it('dos errores distintos -> "Faltan 2 datos: a, b."', () => {
    const errors: ValidationError[] = [
      { code: 'WEIGHT_REQUIRED' },
      { code: 'NEED_FTP_OR_HR_DATA' },
    ];
    expect(buildErrorSummary(errors)).toBe(
      'Faltan 2 datos: peso, FC máxima o año de nacimiento.',
    );
  });

  it('deduplica errores que apuntan al mismo campo (peso vs peso fuera de rango)', () => {
    const errors: ValidationError[] = [
      { code: 'WEIGHT_REQUIRED' },
      { code: 'WEIGHT_OUT_OF_RANGE', min: 30, max: 200 },
    ];
    expect(buildErrorSummary(errors)).toBe('Falta 1 dato: peso.');
  });

  it('mantiene orden de aparicion (no orden alfabetico)', () => {
    const errors: ValidationError[] = [
      { code: 'NEED_FTP_OR_HR_DATA' },
      { code: 'WEIGHT_REQUIRED' },
    ];
    expect(buildErrorSummary(errors)).toBe(
      'Faltan 2 datos: FC máxima o año de nacimiento, peso.',
    );
  });

  it('FC reposo >= FC max etiqueta como "FC en reposo"', () => {
    const errors: ValidationError[] = [{ code: 'RESTING_GE_MAX_HR' }];
    expect(buildErrorSummary(errors)).toBe('Falta 1 dato: FC en reposo.');
  });

  it('SEX_REQUIRED etiqueta como "sexo biológico"', () => {
    const errors: ValidationError[] = [{ code: 'SEX_REQUIRED' }];
    expect(buildErrorSummary(errors)).toBe('Falta 1 dato: sexo biológico.');
  });
});
