import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  clearStoredClientId,
  getSpotifyClientId,
  getStoredClientId,
  isValidClientIdFormat,
  resolveActiveClientId,
  setStoredClientId,
} from './clientId';

const STORAGE_KEY = 'cadencia:spotify:custom-client-id:v1';
const VALID_CUSTOM = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
const VALID_DEFAULT = 'fedcba9876543210fedcba9876543210';

afterEach(() => {
  clearStoredClientId();
  vi.unstubAllEnvs();
});

describe('isValidClientIdFormat', () => {
  it('acepta 32 chars hex en minusculas', () => {
    expect(isValidClientIdFormat(VALID_CUSTOM)).toBe(true);
  });

  it('acepta 32 chars hex en mayusculas (Spotify devuelve indistintamente)', () => {
    expect(isValidClientIdFormat(VALID_CUSTOM.toUpperCase())).toBe(true);
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
    setStoredClientId(VALID_CUSTOM);
    expect(getStoredClientId()).toBe(VALID_CUSTOM);
  });

  it('trimea espacios al guardar (los pegados desde el dashboard suelen llevar)', () => {
    setStoredClientId(`  ${VALID_CUSTOM}  `);
    expect(getStoredClientId()).toBe(VALID_CUSTOM);
  });

  it('normaliza a lowercase al guardar (Spotify usa lowercase canonicamente)', () => {
    setStoredClientId(VALID_CUSTOM.toUpperCase());
    expect(getStoredClientId()).toBe(VALID_CUSTOM);
  });

  it('normaliza a lowercase tambien al leer valores legacy con mayusculas', () => {
    localStorage.setItem(STORAGE_KEY, VALID_CUSTOM.toUpperCase());
    expect(getStoredClientId()).toBe(VALID_CUSTOM);
  });

  it('lanza si el formato es invalido (no se persiste basura silenciosamente)', () => {
    expect(() => setStoredClientId('demasiado-corto')).toThrow();
    expect(getStoredClientId()).toBeNull();
  });

  it('clearStoredClientId borra y devuelve null', () => {
    setStoredClientId(VALID_CUSTOM);
    clearStoredClientId();
    expect(getStoredClientId()).toBeNull();
  });

  it('si el localStorage tiene un valor corrupto, getStoredClientId devuelve null', () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-un-client-id');
    expect(getStoredClientId()).toBeNull();
  });
});

describe('resolveActiveClientId — cascada de prioridad', () => {
  it('usa el custom si existe (gana sobre el default)', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', VALID_DEFAULT);
    setStoredClientId(VALID_CUSTOM);
    expect(resolveActiveClientId()).toEqual({
      clientId: VALID_CUSTOM,
      source: 'custom',
    });
  });

  it('cae al default si no hay custom', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', VALID_DEFAULT);
    expect(resolveActiveClientId()).toEqual({
      clientId: VALID_DEFAULT,
      source: 'default',
    });
  });

  it('devuelve null si no hay custom ni default (self-host BYOC puro)', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', '');
    expect(resolveActiveClientId()).toBeNull();
  });

  it('un default solo con espacios cuenta como ausente', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', '   ');
    expect(resolveActiveClientId()).toBeNull();
  });
});

describe('getSpotifyClientId (compat con call sites historicos)', () => {
  it('devuelve solo el string del id activo', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', VALID_DEFAULT);
    setStoredClientId(VALID_CUSTOM);
    expect(getSpotifyClientId()).toBe(VALID_CUSTOM);
  });

  it('devuelve null cuando la cascada se agota', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', '');
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
    // localStorage y lanza para que la UI pueda surfaceárselo al usuario.
    // Sin esta deteccion, el usuario teclearia su id y caeria en un bucle
    // sin entender por que.
    expect(() => setStoredClientId(VALID_CUSTOM)).toThrow(
      /no se pudo guardar/i,
    );
  });

  it('clearStoredClientId no lanza', () => {
    expect(() => clearStoredClientId()).not.toThrow();
  });
});
