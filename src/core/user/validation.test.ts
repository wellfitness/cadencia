import { describe, it, expect } from 'vitest';
import { describeValidationError, validateUserInputs, type ValidationError } from './validation';
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

    it('valida user mujer + birthYear: calcula FC max via Gulati (206 - 0.88*edad)', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, birthYear: 1980, sex: 'female' }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // edad = 2026 - 1980 = 46 -> 206 - 0.88*46 = 165.52
        expect(result.data.effectiveMaxHr).toBeCloseTo(165.52, 2);
        expect(result.data.hasHeartRateZones).toBe(false);
        expect(result.data.sex).toBe('female');
      }
    });

    it('valida user hombre + birthYear: calcula FC max via Tanaka (208 - 0.7*edad)', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 75, birthYear: 1980, sex: 'male' }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // edad = 2026 - 1980 = 46 -> 208 - 0.7*46 = 175.8
        expect(result.data.effectiveMaxHr).toBeCloseTo(175.8, 2);
        expect(result.data.sex).toBe('male');
      }
    });

    it('valida user con peso + birthYear + sex + FC reposo: hasHeartRateZones=true', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 65, birthYear: 1980, sex: 'female', restingHeartRate: 55 }),
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

    it('FC reposo vs FC max calculada por edad+sex', () => {
      // Mujer 46 anos: Gulati(46) = 165.52. FC reposo 95 < 165 -> ok
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, sex: 'female', restingHeartRate: 95 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      // Hombre 46 anos: Tanaka(46) = 175.8. FC reposo 95 < 176 -> ok
      const result2 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, sex: 'male', restingHeartRate: 95 }),
        CURRENT_YEAR,
      );
      expect(result2.ok).toBe(true);
    });

    it('birthYear sin sex en modo gpx -> SEX_REQUIRED', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.map((e) => e.code)).toContain('SEX_REQUIRED');
      }
    });

    it('FC max manual + birthYear sin sex no dispara SEX_REQUIRED', () => {
      // Si el usuario mide su FC max, sex no se necesita aunque haya birthYear
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, maxHeartRate: 188 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.effectiveMaxHr).toBe(188);
    });

    it('FTP + sin FC ni birthYear no dispara SEX_REQUIRED', () => {
      const result = validateUserInputs(
        buildRaw({ weightKg: 70, ftpWatts: 220 }),
        CURRENT_YEAR,
      );
      expect(result.ok).toBe(true);
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
      const raw = buildRaw({ weightKg: 70, birthYear: 1980, sex: 'female', restingHeartRate: 55 });
      const r1 = validateUserInputs(raw, CURRENT_YEAR);
      const r2 = validateUserInputs(raw, CURRENT_YEAR);
      expect(r1).toEqual(r2);
    });

    it('cambio de currentYear afecta a la FC max por edad pero no a inputs explicitos', () => {
      const r2026 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, sex: 'male' }),
        2026,
      );
      const r2030 = validateUserInputs(
        buildRaw({ weightKg: 70, birthYear: 1980, sex: 'male' }),
        2030,
      );
      if (r2026.ok && r2030.ok) {
        expect(r2026.data.effectiveMaxHr).not.toBe(r2030.data.effectiveMaxHr);
      }
    });
  });

  describe("modo 'session' (sesion indoor)", () => {
    it('sin ningun dato fisiologico falla con NEED_HR_DATA (modo TV necesita FC)', () => {
      const result = validateUserInputs(buildRaw({}), CURRENT_YEAR, 'session');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'NEED_HR_DATA')).toBe(true);
      }
    });

    it('FC max sola (sin reposo, sin birthYear) es valida', () => {
      const result = validateUserInputs(
        buildRaw({ maxHeartRate: 185 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.weightKg).toBe(70);
        expect(result.data.effectiveMaxHr).toBe(185);
        expect(result.data.hasHeartRateZones).toBe(false); // sin reposo no hay Karvonen
      }
    });

    it('peso opcional pero validado si se rellena', () => {
      // weightKg: 5 -> WEIGHT_OUT_OF_RANGE (independiente del check de FC)
      const tooLow = validateUserInputs(buildRaw({ weightKg: 5 }), CURRENT_YEAR, 'session');
      expect(tooLow.ok).toBe(false);
      // weightKg: 80 + FC max -> valido
      const valid = validateUserInputs(
        buildRaw({ weightKg: 80, maxHeartRate: 185 }),
        CURRENT_YEAR,
        'session',
      );
      expect(valid.ok).toBe(true);
      if (valid.ok) expect(valid.data.weightKg).toBe(80);
    });

    it('FTP solo (sin FC) NO desbloquea: en session el modo TV necesita FC', () => {
      const result = validateUserInputs(
        buildRaw({ ftpWatts: 220 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'NEED_HR_DATA')).toBe(true);
      }
    });

    it('FTP + FC max es valido (FTP es complementario, no sustituye FC)', () => {
      const result = validateUserInputs(
        buildRaw({ ftpWatts: 220, maxHeartRate: 185 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.ftpWatts).toBe(220);
        expect(result.data.hasFtp).toBe(true);
        expect(result.data.effectiveMaxHr).toBe(185);
      }
    });

    it('FC max + reposo activan hasHeartRateZones', () => {
      const result = validateUserInputs(
        buildRaw({ maxHeartRate: 185, restingHeartRate: 60 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasHeartRateZones).toBe(true);
        expect(result.data.effectiveMaxHr).toBe(185);
        expect(result.data.restingHeartRate).toBe(60);
      }
    });

    it('FC reposo >= FC max (ambos en rango) -> error RESTING_GE_MAX_HR', () => {
      // Valores en rango: maxHR min=100, restingHR max=100. Igualdad dispara la regla.
      const result = validateUserInputs(
        buildRaw({ maxHeartRate: 100, restingHeartRate: 100 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'RESTING_GE_MAX_HR')).toBe(true);
      }
    });

    it('exige FC max o (birthYear + sex) — distinto de gpx que tambien acepta FTP solo', () => {
      const session = validateUserInputs(buildRaw({}), CURRENT_YEAR, 'session');
      const gpx = validateUserInputs(buildRaw({}), CURRENT_YEAR);
      expect(session.ok).toBe(false);
      expect(gpx.ok).toBe(false);
      // En gpx, FTP solo desbloquea (sin peso seguiria fallando, pero ese
      // es otro error distinto). En session, FTP solo NO basta.
      const sessionWithFtp = validateUserInputs(
        buildRaw({ ftpWatts: 220 }),
        CURRENT_YEAR,
        'session',
      );
      expect(sessionWithFtp.ok).toBe(false);
    });

    it('birthYear + sex calcula effectiveMaxHr (Gulati / Tanaka)', () => {
      const female = validateUserInputs(
        buildRaw({ birthYear: 1980, sex: 'female' }),
        CURRENT_YEAR,
        'session',
      );
      expect(female.ok).toBe(true);
      if (female.ok) expect(female.data.effectiveMaxHr).toBeCloseTo(165.52, 2);

      const male = validateUserInputs(
        buildRaw({ birthYear: 1980, sex: 'male' }),
        CURRENT_YEAR,
        'session',
      );
      expect(male.ok).toBe(true);
      if (male.ok) expect(male.data.effectiveMaxHr).toBeCloseTo(175.8, 2);
    });

    it('birthYear sin sex en session falla con NEED_HR_DATA (no podemos estimar FC max)', () => {
      const result = validateUserInputs(
        buildRaw({ birthYear: 1980 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'NEED_HR_DATA')).toBe(true);
      }
    });

    it('FC reposo fuera de rango en session -> RESTING_HR_OUT_OF_RANGE', () => {
      const result = validateUserInputs(
        buildRaw({ maxHeartRate: 185, restingHeartRate: 200 }),
        CURRENT_YEAR,
        'session',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual({
          code: 'RESTING_HR_OUT_OF_RANGE',
          min: VALIDATION_LIMITS.restingHeartRate.min,
          max: VALIDATION_LIMITS.restingHeartRate.max,
        });
      }
    });
  });

  // === Cobertura validateRun (sport: 'run') ===
  // Antes 0% cubierto; subimos validation.ts a >90% stmts. Reglas:
  //  - peso opcional (Cr de Minetti normaliza por kg)
  //  - FTP descartado (no aplica en running)
  //  - FC max O (birthYear + sex) obligatorios
  //  - bike fields irrelevantes pero defaulteados en el output
  describe("sport: 'run' (validateRun)", () => {
    const baseRun: UserInputsRaw = {
      sport: 'run',
      weightKg: null,
      ftpWatts: null,
      maxHeartRate: 185,
      restingHeartRate: null,
      birthYear: null,
      sex: null,
      bikeWeightKg: null,
      bikeType: null,
    };

    it('happy path con FC max directa: ok, peso default 70 kg', () => {
      const result = validateUserInputs(baseRun, 2026);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.sport).toBe('run');
        expect(result.data.weightKg).toBe(70);
        expect(result.data.ftpWatts).toBeNull();
        expect(result.data.effectiveMaxHr).toBe(185);
        expect(result.data.hasFtp).toBe(false);
      }
    });

    it('happy path con birthYear+sex: estima FC max via Gulati', () => {
      const result = validateUserInputs(
        { ...baseRun, maxHeartRate: null, birthYear: 1985, sex: 'female' },
        2026,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Gulati: 206 - 0.88 * 41 = 169.92
        expect(result.data.effectiveMaxHr).toBeCloseTo(169.92, 1);
      }
    });

    it('FTP se descarta aunque venga rellenado (running no usa potencia)', () => {
      const result = validateUserInputs({ ...baseRun, ftpWatts: 250 }, 2026);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.ftpWatts).toBeNull();
        expect(result.data.hasFtp).toBe(false);
      }
    });

    it('sin FC max ni birthYear+sex falla con NEED_HR_DATA', () => {
      const result = validateUserInputs(
        { ...baseRun, maxHeartRate: null, birthYear: null },
        2026,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'NEED_HR_DATA')).toBe(true);
      }
    });

    it('birthYear sin sex falla con NEED_HR_DATA (no podemos estimar)', () => {
      const result = validateUserInputs(
        { ...baseRun, maxHeartRate: null, birthYear: 1985, sex: null },
        2026,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'NEED_HR_DATA')).toBe(true);
      }
    });

    it('peso fuera de rango falla con WEIGHT_OUT_OF_RANGE', () => {
      const result = validateUserInputs({ ...baseRun, weightKg: 500 }, 2026);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'WEIGHT_OUT_OF_RANGE')).toBe(true);
      }
    });

    it('birthYear fuera de rango falla con BIRTH_YEAR_OUT_OF_RANGE', () => {
      const result = validateUserInputs({ ...baseRun, birthYear: 1900 }, 2026);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'BIRTH_YEAR_OUT_OF_RANGE')).toBe(true);
      }
    });

    it('FC max fuera de rango falla con MAX_HR_OUT_OF_RANGE', () => {
      const result = validateUserInputs({ ...baseRun, maxHeartRate: 50 }, 2026);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'MAX_HR_OUT_OF_RANGE')).toBe(true);
      }
    });

    it('FC reposo fuera de rango falla con RESTING_HR_OUT_OF_RANGE', () => {
      const result = validateUserInputs({ ...baseRun, restingHeartRate: 200 }, 2026);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'RESTING_HR_OUT_OF_RANGE')).toBe(true);
      }
    });

    it('FC reposo >= FC max falla con RESTING_GE_MAX_HR', () => {
      const result = validateUserInputs(
        { ...baseRun, maxHeartRate: 185, restingHeartRate: 90 },
        2026,
      );
      // 90 esta en rango, 185 esta en rango, pero la combinacion no.
      // Wait: 90 < 185, deberia ser ok. Probemos uno claramente >=.
      expect(result.ok).toBe(true);
      const r2 = validateUserInputs(
        { ...baseRun, maxHeartRate: 100, restingHeartRate: 100 },
        2026,
      );
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.errors).toEqual([{ code: 'RESTING_GE_MAX_HR' }]);
      }
    });

    it('output incluye bike defaults aunque sean irrelevantes en running', () => {
      const result = validateUserInputs(baseRun, 2026);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.bikeType).toBeDefined();
        expect(result.data.bikeWeightKg).toBeGreaterThan(0);
      }
    });
  });
});

describe('describeValidationError', () => {
  // Cobertura exhaustiva del switch: cada code debe producir un mensaje no
  // vacio, en castellano, e incorporar los limites cuando aplica. Si se anade
  // un nuevo code de error, este test fuerza a documentarlo aqui.
  const cases: { name: string; err: ValidationError; mustInclude: string[] }[] = [
    {
      name: 'WEIGHT_REQUIRED',
      err: { code: 'WEIGHT_REQUIRED' },
      mustInclude: ['peso'],
    },
    {
      name: 'WEIGHT_OUT_OF_RANGE',
      err: { code: 'WEIGHT_OUT_OF_RANGE', min: 30, max: 200 },
      mustInclude: ['peso', '30', '200'],
    },
    {
      name: 'FTP_OUT_OF_RANGE',
      err: { code: 'FTP_OUT_OF_RANGE', min: 50, max: 600 },
      mustInclude: ['FTP', '50', '600'],
    },
    {
      name: 'NEED_FTP_OR_HR_DATA',
      err: { code: 'NEED_FTP_OR_HR_DATA' },
      mustInclude: ['FTP'],
    },
    {
      name: 'NEED_HR_DATA',
      err: { code: 'NEED_HR_DATA' },
      mustInclude: ['FC'],
    },
    {
      name: 'BIRTH_YEAR_OUT_OF_RANGE',
      err: { code: 'BIRTH_YEAR_OUT_OF_RANGE', min: 1920, max: 2010 },
      mustInclude: ['1920', '2010'],
    },
    {
      name: 'MAX_HR_OUT_OF_RANGE',
      err: { code: 'MAX_HR_OUT_OF_RANGE', min: 100, max: 230 },
      mustInclude: ['FC', '100', '230'],
    },
    {
      name: 'RESTING_HR_OUT_OF_RANGE',
      err: { code: 'RESTING_HR_OUT_OF_RANGE', min: 30, max: 100 },
      mustInclude: ['reposo', '30', '100'],
    },
    {
      name: 'RESTING_GE_MAX_HR',
      err: { code: 'RESTING_GE_MAX_HR' },
      mustInclude: ['reposo'],
    },
    {
      name: 'SEX_REQUIRED',
      err: { code: 'SEX_REQUIRED' },
      mustInclude: ['mujer', 'hombre'],
    },
    {
      name: 'BIKE_WEIGHT_OUT_OF_RANGE',
      err: { code: 'BIKE_WEIGHT_OUT_OF_RANGE', min: 5, max: 25 },
      mustInclude: ['bici', '5', '25'],
    },
    {
      name: 'BIKE_TYPE_INVALID',
      err: { code: 'BIKE_TYPE_INVALID' },
      mustInclude: ['bici'],
    },
  ];

  it.each(cases)('describe $name', ({ err, mustInclude }) => {
    const msg = describeValidationError(err);
    expect(msg.length).toBeGreaterThan(0);
    for (const fragment of mustInclude) {
      expect(msg).toContain(fragment);
    }
  });
});
