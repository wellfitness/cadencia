import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  clearStoredClientId,
  getSpotifyClientId,
  getStoredClientId,
  isValidClientIdFormat,
  setStoredClientId,
} from './clientId';

const STORAGE_KEY = 'cadencia:spotify:custom-client-id:v1';
const VALID_ID = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';

afterEach(() => {
  clearStoredClientId();
});

describe('isValidClientIdFormat', () => {
  it('acepta 32 chars hex en minusculas', () => {
    expect(isValidClientIdFormat(VALID_ID)).toBe(true);
  });

  it('acepta 32 chars hex en mayusculas (Spotify devuelve indistintamente)', () => {
    expect(isValidClientIdFormat(VALID_ID.toUpperCase())).toBe(true);
  });

  it('rechaza si no son 32 chars', () => {
    expect(isValidClientIdFormat('a1b2c3')).toBe(false);
    expect(isValidClientIdFormat('a'.repeat(31))).toBe(false);
    expect(isValidClientIdFormat('a'.repeat(33))).toBe(false);
  });

  it('rechaza chars no hex (g-z, simbolos)', () => {
    expect(isValidClientIdFormat('g'.repeat(32))).toBe(false);
    expect(isValidClientIdFormat('!'.repeat(32))).toBe(false);
  });

  it('rechaza string vacio', () => {
    expect(isValidClientIdFormat('')).toBe(false);
  });
});

describe('setStoredClientId / getStoredClientId / clearStoredClientId', () => {
  it('round-trip de Client ID custom', () => {
    setStoredClientId(VALID_ID);
    expect(getStoredClientId()).toBe(VALID_ID);
  });

  it('trimea espacios al guardar (los pegados desde el dashboard suelen llevar)', () => {
    setStoredClientId(`  ${VALID_ID}  `);
    expect(getStoredClientId()).toBe(VALID_ID);
  });

  it('normaliza a lowercase al guardar (Spotify usa lowercase canonicamente)', () => {
    setStoredClientId(VALID_ID.toUpperCase());
    expect(getStoredClientId()).toBe(VALID_ID);
  });

  it('normaliza a lowercase tambien al leer valores legacy con mayusculas', () => {
    localStorage.setItem(STORAGE_KEY, VALID_ID.toUpperCase());
    expect(getStoredClientId()).toBe(VALID_ID);
  });

  it('lanza si el formato es invalido (no se persiste basura silenciosamente)', () => {
    expect(() => setStoredClientId('demasiado-corto')).toThrow();
    expect(getStoredClientId()).toBeNull();
  });

  it('clearStoredClientId borra y devuelve null', () => {
    setStoredClientId(VALID_ID);
    clearStoredClientId();
    expect(getStoredClientId()).toBeNull();
  });

  it('si el localStorage tiene un valor corrupto, getStoredClientId devuelve null', () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-un-client-id');
    expect(getStoredClientId()).toBeNull();
  });
});

describe('getSpotifyClientId (alias publico)', () => {
  it('devuelve el id custom guardado', () => {
    setStoredClientId(VALID_ID);
    expect(getSpotifyClientId()).toBe(VALID_ID);
  });

  it('devuelve null cuando no hay nada guardado (BYOC pendiente)', () => {
    expect(getSpotifyClientId()).toBeNull();
  });
});

describe('comportamiento sin localStorage (Safari modo privado, WebView)', () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage no disponible');
      },
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
        writable: true,
      });
    }
  });

  it('getStoredClientId devuelve null sin tirar', () => {
    expect(getStoredClientId()).toBeNull();
  });

  it('setStoredClientId LANZA error explicito si el storage no persiste', () => {
    // La verificacion read-after-write detecta el fallo silencioso de
    // localStorage y lanza para que la UI pueda surfacearselo al usuario.
    expect(() => setStoredClientId(VALID_ID)).toThrow(
      /no se pudo guardar/i,
    );
  });

  it('clearStoredClientId no lanza', () => {
    expect(() => clearStoredClientId()).not.toThrow();
  });
});
