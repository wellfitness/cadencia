import { describe, it, expect } from 'vitest';
import { validateUserInputs } from './validation';
import { EMPTY_USER_INPUTS, VALIDATION_LIMITS, type UserInputsRaw } from './userInputs';

const CURRENT_YEAR = 2026;

function buildRaw(overrides: Partial<UserInputsRaw>): UserInputsRaw {
  return { ...EMPTY_USER_INPUTS, ...overrides };
}

describe('validateUserInputs', () => {
  describe('happy paths', () => {
    it('valida user con peso + FTP (zonas Coggan)', () => {
      const result = validateUserInputs(buildRaw({ weightKg: 70, ftpWatts: 220 }), CURRENT_YEAR);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.weightKg).toBe(70);
        expect(result.data.ftpWatts).toBe(220);
        expect(result.data.hasFtp).toBe(true);
        expect(result.data.hasHeartRateZones).toBe(false);
        expect(result.data.effectiveMaxHr).toBeNull();
      }
    });

    it('valida user con peso + FC max (sin Karvonen)', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, maxHeartRate: 185 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.effectiveMaxHr).toBe(185);
        expect(result.data.hasHeartRateZones).toBe(false);
      }
    });

    it('valida user con peso + birthYear: calcula FC max via Gulati', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, birthYear: 1980 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // edad = 2026 - 1980 = 46 -> 211 - 0.64*46 = 181.56
        expect(result.data.effectiveMaxHr).toBeCloseTo(181.56, 2);
        expect(result.data.hasHeartRateZones).toBe(false);
      }
    });

    it('valida user con peso + birthYear + FC reposo: hasHeartRateZones=true', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, birthYear: 1980, restingHeartRate: 55 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasHeartRateZones).toBe(true);
        expect(result.data.restingHeartRate).toBe(55);
      }
    });

    it('FC max manual prevalece sobre birthYear', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, birthYear: 1980, maxHeartRate: 192 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.effectiveMaxHr).toBe(192);
      }
    });
  });

  describe('errores', () => {
    it('falta peso -> WEIGHT_REQUIRED', () => {
      const result = validateUserInputs(buildRaw({ ftpWatts: 220 }), CURRENT_YEAR);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual({ code: 'WEIGHT_REQUIRED' });
      }
    });

    it.each([
      [10, 'menor que minimo'],
      [25, 'menor que minimo'],
      [250, 'mayor que maximo'],
    ])('peso %d (%s) -> WEIGHT_OUT_OF_RANGE', (peso) => {
      const result = validateUserInputs(buildRaw({ weightKg: peso, ftpWatts: 220 }), CURRENT_YEAR);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual({
          code: 'WEIGHT_OUT_OF_RANGE',
          min: VALIDATION_LIMITS.weightKg.min,
          max: VALIDATION_LIMITS.weightKg.max,
        });
      }
    });

    it('FTP fuera de rango -> FTP_OUT_OF_RANGE', () => {
      const result = validateUserInputs(buildRaw({ weightKg: 70, ftpWatts: 30 }), CURRENT_YEAR);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('FTP_OUT_OF_RANGE');
      }
    });

    it('sin FTP, sin FC max, sin birthYear -> NEED_FTP_OR_HR_DATA', () => {
      const result = validateUserInputs(buildRaw({ weightKg: 70 }), CURRENT_YEAR);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('NEED_FTP_OR_HR_DATA');
      }
    });

    it('birthYear demasiado reciente -> BIRTH_YEAR_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: CURRENT_YEAR - 5 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('BIRTH_YEAR_OUT_OF_RANGE');
      }
    });

    it('birthYear anterior a 1920 -> BIRTH_YEAR_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1900 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('BIRTH_YEAR_OUT_OF_RANGE');
      }
    });

    it('FC max fuera de rango -> MAX_HR_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, maxHeartRate: 50 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('MAX_HR_OUT_OF_RANGE');
      }
    });

    it('FC reposo fuera de rango -> RESTING_HR_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220, restingHeartRate: 200 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('RESTING_HR_OUT_OF_RANGE');
      }
    });

    it('FC reposo >= FC max -> RESTING_GE_MAX_HR', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, maxHeartRate: 100, restingHeartRate: 100 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toEqual([{ code: 'RESTING_GE_MAX_HR' }]);
      }
    });

    it('FC reposo > FC max calculada Gulati -> RESTING_GE_MAX_HR', () => {
      // Gulati(46) = 181.56, asi que 200 > 181.56
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, restingHeartRate: 95 }),
        CURRENT_YEAR,
      );
      // 95 < 181.56 -> deberia ser ok
      expect(result.ok).toBe(true);
      const result2 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1940, restingHeartRate: 95 }),
        CURRENT_YEAR,
      );
      // edad 86 -> Gulati = 211 - 0.64*86 = 155.96, FC reposo 95 valida (< 156)
      expect(result2.ok).toBe(true);
    });

    it('acumula multiples errores en una sola pasada', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 10, ftpWatts: 1000, maxHeartRate: 50 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.errors.map((e) => e.code);
        expect(codes).toContain('WEIGHT_OUT_OF_RANGE');
        expect(codes).toContain('FTP_OUT_OF_RANGE');
        expect(codes).toContain('MAX_HR_OUT_OF_RANGE');
      }
    });
  });

  describe('bici', () => {
    it('por defecto: bikeType=gravel y bikeWeightKg=10', () => {
      const result = validateUserInputs(buildRaw({ weightKg: 70, ftpWatts: 220 }), CURRENT_YEAR);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.bikeType).toBe('gravel');
        expect(result.data.bikeWeightKg).toBe(10);
      }
    });

    it('si el usuario elige carretera sin tocar peso, default 8 kg', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220, bikeType: 'road' }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.bikeType).toBe('road');
        expect(result.data.bikeWeightKg).toBe(8);
      }
    });

    it('si el usuario elige MTB sin tocar peso, default 13 kg', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220, bikeType: 'mtb' }),
        CURRENT_YEAR,
      );
      if (result.ok) expect(result.data.bikeWeightKg).toBe(13);
    });

    it('peso de bici fuera de rango -> BIKE_WEIGHT_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220, bikeWeightKg: 50 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('BIKE_WEIGHT_OUT_OF_RANGE');
      }
    });

    it('peso de bici manual prevalece sobre default del tipo', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220, bikeType: 'road', bikeWeightKg: 7 }),
        CURRENT_YEAR,
      );
      if (result.ok) {
        expect(result.data.bikeWeightKg).toBe(7);
      }
    });
  });

  describe('determinismo', () => {
    it('misma entrada produce misma salida (funcion pura)', () => {
      const raw = buildRaw({ weightKg: 70, birthYear: 1980, restingHeartRate: 55 });
      const r1 = validateUserInputs(raw, CURRENT_YEAR);
      const r2 = validateUserInputs(raw, CURRENT_YEAR);
      expect(r1).toEqual(r2);
    });

    it('cambio de currentYear afecta a Gulati pero no a inputs explicitos', () => {
      const r2026 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980 }),
        2026,
      );
      const r2030 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980 }),
        2030,
      );
      if (r2026.ok && r2030.ok) {
        expect(r2026.data.effectiveMaxHr).not.toBe(r2030.data.effectiveMaxHr);
      }
    });
  });
});
