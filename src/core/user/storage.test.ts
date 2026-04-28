import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllUserInputs,
  clearUserInputsFromLocal,
  clearUserInputsFromSession,
  isPersistentStorageEnabled,
  loadUserInputs,
  loadUserInputsFromLocal,
  loadUserInputsFromSession,
  saveUserInputs,
  saveUserInputsToLocal,
  saveUserInputsToSession,
} from './storage';
import { EMPTY_USER_INPUTS, type UserInputsRaw } from './userInputs';

const SESSION_KEY = 'vatios:userInputs:v1';
const LOCAL_KEY = 'vatios:userInputs:persistent:v1';

const SAMPLE: UserInputsRaw = {
  weightKg: 70,
  ftpWatts: 230,
  maxHeartRate: 185,
  restingHeartRate: 55,
  birthYear: 1985,
  sex: 'female',
  bikeWeightKg: 9,
  bikeType: 'road',
};

describe('storage – sessionStorage (legacy API)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('round-trip: save y load devuelve los mismos datos', () => {
    saveUserInputsToSession(SAMPLE);
    expect(loadUserInputsFromSession()).toEqual(SAMPLE);
  });

  it('load devuelve null cuando no hay nada guardado', () => {
    expect(loadUserInputsFromSession()).toBeNull();
  });

  it('load devuelve null si el JSON esta corrupto', () => {
    sessionStorage.setItem(SESSION_KEY, '{not-json');
    expect(loadUserInputsFromSession()).toBeNull();
  });

  it('load mergea con EMPTY si el shape persistido es antiguo (sin campos nuevos)', () => {
    // Formato historico: solo weightKg, sin sex/bike
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      weightKg: 70,
      ftpWatts: null,
      maxHeartRate: 180,
      restingHeartRate: null,
      birthYear: null,
    }));
    const loaded = loadUserInputsFromSession();
    expect(loaded).not.toBeNull();
    if (loaded === null) return;
    expect(loaded.weightKg).toBe(70);
    expect(loaded.maxHeartRate).toBe(180);
    expect(loaded.sex).toBeNull();
    expect(loaded.bikeType).toBeNull();
  });

  it('clear borra los datos de sessionStorage', () => {
    saveUserInputsToSession(SAMPLE);
    clearUserInputsFromSession();
    expect(loadUserInputsFromSession()).toBeNull();
  });
});

describe('storage – localStorage (opt-in)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('isPersistentStorageEnabled() empieza en false sin datos', () => {
    expect(isPersistentStorageEnabled()).toBe(false);
  });

  it('save activa el opt-in implicitamente (la presencia de la key es la flag)', () => {
    expect(isPersistentStorageEnabled()).toBe(false);
    saveUserInputsToLocal(SAMPLE);
    expect(isPersistentStorageEnabled()).toBe(true);
  });

  it('round-trip: load devuelve los datos guardados', () => {
    saveUserInputsToLocal(SAMPLE);
    expect(loadUserInputsFromLocal()).toEqual(SAMPLE);
  });

  it('clear desactiva el opt-in', () => {
    saveUserInputsToLocal(SAMPLE);
    clearUserInputsFromLocal();
    expect(isPersistentStorageEnabled()).toBe(false);
    expect(loadUserInputsFromLocal()).toBeNull();
  });

  it('localStorage usa wrapper {version, inputs}', () => {
    saveUserInputsToLocal(SAMPLE);
    const raw = localStorage.getItem(LOCAL_KEY);
    expect(raw).not.toBeNull();
    if (raw === null) return;
    const parsed = JSON.parse(raw) as { version: number; inputs: UserInputsRaw };
    expect(parsed.version).toBe(1);
    expect(parsed.inputs).toEqual(SAMPLE);
  });

  it('load rechaza payloads sin envelope (no son nuestros)', () => {
    // JSON con UserInputsRaw "pelado", sin {version, inputs}
    localStorage.setItem(LOCAL_KEY, JSON.stringify(SAMPLE));
    expect(loadUserInputsFromLocal()).toBeNull();
  });

  it('load rechaza envelopes con version futura (datos de una version posterior de la app)', () => {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ version: 99, inputs: SAMPLE }),
    );
    expect(loadUserInputsFromLocal()).toBeNull();
  });

  it('load rechaza JSON corrupto', () => {
    localStorage.setItem(LOCAL_KEY, '{corrupted');
    expect(loadUserInputsFromLocal()).toBeNull();
  });

  it('load mergea con EMPTY si el envelope persistido tiene un shape mas antiguo', () => {
    // Envelope v1 con un shape antiguo de inputs (sin sex)
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        version: 1,
        inputs: {
          weightKg: 75,
          ftpWatts: null,
          maxHeartRate: 180,
          restingHeartRate: null,
          birthYear: null,
        },
      }),
    );
    const loaded = loadUserInputsFromLocal();
    expect(loaded).not.toBeNull();
    if (loaded === null) return;
    expect(loaded.weightKg).toBe(75);
    expect(loaded.sex).toBeNull();
    expect(loaded.bikeType).toBeNull();
  });
});

describe('storage – API compuesta load/save/clear', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('saveUserInputs(persistent=false) escribe solo session', () => {
    saveUserInputs(SAMPLE, false);
    expect(loadUserInputsFromSession()).toEqual(SAMPLE);
    expect(loadUserInputsFromLocal()).toBeNull();
  });

  it('saveUserInputs(persistent=true) escribe ambos storages', () => {
    saveUserInputs(SAMPLE, true);
    expect(loadUserInputsFromSession()).toEqual(SAMPLE);
    expect(loadUserInputsFromLocal()).toEqual(SAMPLE);
  });

  it('loadUserInputs prioriza local sobre session', () => {
    const sessionData: UserInputsRaw = { ...EMPTY_USER_INPUTS, weightKg: 60 };
    const localData: UserInputsRaw = { ...EMPTY_USER_INPUTS, weightKg: 80 };
    saveUserInputsToSession(sessionData);
    saveUserInputsToLocal(localData);
    const loaded = loadUserInputs();
    expect(loaded).not.toBeNull();
    if (loaded === null) return;
    expect(loaded.weightKg).toBe(80);
  });

  it('loadUserInputs cae a session si local esta vacio', () => {
    saveUserInputsToSession(SAMPLE);
    expect(loadUserInputs()).toEqual(SAMPLE);
  });

  it('loadUserInputs devuelve null si ninguno tiene datos', () => {
    expect(loadUserInputs()).toBeNull();
  });

  it('clearAllUserInputs borra ambos storages', () => {
    saveUserInputs(SAMPLE, true);
    clearAllUserInputs();
    expect(loadUserInputsFromSession()).toBeNull();
    expect(loadUserInputsFromLocal()).toBeNull();
    expect(isPersistentStorageEnabled()).toBe(false);
  });
});
