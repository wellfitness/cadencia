import { afterEach, describe, it, expect } from 'vitest';
import {
  clearAuthFlow,
  clearTokens,
  loadAuthFlow,
  loadTokens,
  saveAuthFlow,
  saveTokens,
  tokensAreFresh,
} from './storage';
import type { SpotifyTokens } from './types';

afterEach(() => {
  clearAuthFlow();
  clearTokens();
});

describe('saveAuthFlow / loadAuthFlow', () => {
  it('round-trip preserva el contenido', () => {
    const flow = { codeVerifier: 'v123', state: 's456' };
    saveAuthFlow(flow);
    expect(loadAuthFlow()).toEqual(flow);
  });

  it('sin nada guardado devuelve null', () => {
    expect(loadAuthFlow()).toBeNull();
  });

  it('JSON corrupto en sessionStorage devuelve null sin tirar', () => {
    sessionStorage.setItem('vatios:spotify:authFlow:v1', '{not-json}');
    expect(loadAuthFlow()).toBeNull();
  });

  it('shape invalido devuelve null', () => {
    sessionStorage.setItem(
      'vatios:spotify:authFlow:v1',
      JSON.stringify({ codeVerifier: 123 }),
    );
    expect(loadAuthFlow()).toBeNull();
  });
});

describe('saveTokens / loadTokens', () => {
  const sample: SpotifyTokens = {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAtMs: 1_700_000_000_000,
    scope: 'playlist-modify-private',
  };

  it('round-trip', () => {
    saveTokens(sample);
    expect(loadTokens()).toEqual(sample);
  });

  it('clearTokens elimina', () => {
    saveTokens(sample);
    clearTokens();
    expect(loadTokens()).toBeNull();
  });
});

describe('tokensAreFresh', () => {
  const now = 1_700_000_000_000;
  const baseTokens: SpotifyTokens = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAtMs: 0,
    scope: 's',
  };

  it('expires en el futuro lejano: fresh', () => {
    expect(tokensAreFresh({ ...baseTokens, expiresAtMs: now + 60_000 }, now)).toBe(true);
  });

  it('expires en el pasado: no fresh', () => {
    expect(tokensAreFresh({ ...baseTokens, expiresAtMs: now - 1 }, now)).toBe(false);
  });

  it('margen 30s: si expira en 20s, no fresh', () => {
    expect(tokensAreFresh({ ...baseTokens, expiresAtMs: now + 20_000 }, now)).toBe(false);
  });
});
