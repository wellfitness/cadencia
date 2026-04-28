import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditableSessionPlan } from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user';
import {
  TV_HANDOFF_LOCALSTORAGE_KEY,
  TV_HANDOFF_SESSIONSTORAGE_KEY,
  clearTVSession,
  readAndConsumeHandoff,
  writeHandoff,
  type TVHandoffPayload,
} from './tvHandoff';

function buildPayload(): TVHandoffPayload {
  const plan: EditableSessionPlan = {
    name: 'Sesion test',
    items: [
      {
        type: 'block',
        block: {
          id: 'b1',
          phase: 'warmup',
          zone: 2,
          cadenceProfile: 'flat',
          durationSec: 600,
          description: 'Calentamiento',
        },
      },
    ],
  };
  const validatedInputs: ValidatedUserInputs = {
    weightKg: 70,
    ftpWatts: null,
    effectiveMaxHr: 185,
    restingHeartRate: 60,
    birthYear: 1990,
    sex: 'female',
    bikeWeightKg: 10,
    bikeType: 'gravel',
    hasFtp: false,
    hasHeartRateZones: true,
  };
  return { plan, validatedInputs };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('writeHandoff + readAndConsumeHandoff', () => {
  it('escribe en localStorage y lo consume devolviendo el payload', () => {
    const payload = buildPayload();
    writeHandoff(payload);
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).not.toBeNull();

    const consumed = readAndConsumeHandoff();
    expect(consumed).not.toBeNull();
    expect(consumed?.plan.name).toBe('Sesion test');
    expect(consumed?.validatedInputs.weightKg).toBe(70);
    // localStorage debe quedar vacio (one-shot)
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).toBeNull();
    // sessionStorage debe tener la copia para sobrevivir a F5
    expect(window.sessionStorage.getItem(TV_HANDOFF_SESSIONSTORAGE_KEY)).not.toBeNull();
  });

  it('llamar dos veces seguidas devuelve el mismo payload (cae a sessionStorage)', () => {
    const payload = buildPayload();
    writeHandoff(payload);

    const first = readAndConsumeHandoff();
    expect(first).not.toBeNull();
    expect(first?.plan.name).toBe('Sesion test');

    // El localStorage ya esta vacio, la segunda lectura cae a sessionStorage.
    const second = readAndConsumeHandoff();
    expect(second).not.toBeNull();
    expect(second?.plan.name).toBe('Sesion test');
    expect(second?.validatedInputs.effectiveMaxHr).toBe(185);
  });

  it('sin nada escrito devuelve null', () => {
    expect(readAndConsumeHandoff()).toBeNull();
  });

  it('JSON corrupto en localStorage devuelve null y limpia la entrada', () => {
    window.localStorage.setItem(TV_HANDOFF_LOCALSTORAGE_KEY, '{not valid json');

    const result = readAndConsumeHandoff();
    expect(result).toBeNull();
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).toBeNull();
  });

  it('JSON valido pero shape incorrecto devuelve null y limpia la entrada', () => {
    window.localStorage.setItem(
      TV_HANDOFF_LOCALSTORAGE_KEY,
      JSON.stringify({ totallyWrong: true }),
    );

    const result = readAndConsumeHandoff();
    expect(result).toBeNull();
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).toBeNull();
  });

  it('JSON corrupto en sessionStorage tras consumir localStorage limpia y devuelve null', () => {
    // Sin nada en localStorage, sessionStorage corrupto
    window.sessionStorage.setItem(TV_HANDOFF_SESSIONSTORAGE_KEY, '{nope');

    const result = readAndConsumeHandoff();
    expect(result).toBeNull();
    expect(window.sessionStorage.getItem(TV_HANDOFF_SESSIONSTORAGE_KEY)).toBeNull();
  });
});

describe('clearTVSession', () => {
  it('borra ambas claves', () => {
    const payload = buildPayload();
    writeHandoff(payload);
    // Forzamos tambien una entrada en sessionStorage
    readAndConsumeHandoff();
    expect(window.sessionStorage.getItem(TV_HANDOFF_SESSIONSTORAGE_KEY)).not.toBeNull();

    // Volvemos a escribir en localStorage para tener ambos
    writeHandoff(payload);
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).not.toBeNull();

    clearTVSession();
    expect(window.localStorage.getItem(TV_HANDOFF_LOCALSTORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TV_HANDOFF_SESSIONSTORAGE_KEY)).toBeNull();
  });
});
