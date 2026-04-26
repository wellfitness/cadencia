import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exchangeCodeForTokens, getAuthorizationUrl, refreshAccessToken } from './auth';

describe('getAuthorizationUrl', () => {
  it('construye URL con todos los params PKCE', () => {
    const url = new URL(
      getAuthorizationUrl({
        clientId: 'cid',
        redirectUri: 'http://localhost:5173/callback',
        codeChallenge: 'cha',
        state: 'st',
        scopes: ['playlist-modify-private'],
      }),
    );
    expect(url.origin).toBe('https://accounts.spotify.com');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('cha');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('scope')).toBe('playlist-modify-private');
  });

  it('multiples scopes se separan por espacio', () => {
    const url = new URL(
      getAuthorizationUrl({
        clientId: 'cid',
        redirectUri: 'r',
        codeChallenge: 'cha',
        state: 'st',
        scopes: ['playlist-modify-private', 'user-read-email'],
      }),
    );
    expect(url.searchParams.get('scope')).toBe('playlist-modify-private user-read-email');
  });
});

describe('exchangeCodeForTokens', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT',
          refresh_token: 'RT',
          expires_in: 3600,
          scope: 'playlist-modify-private',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parsea respuesta y calcula expiresAtMs', async () => {
    const before = Date.now();
    const tokens = await exchangeCodeForTokens({
      clientId: 'cid',
      redirectUri: 'r',
      code: 'c',
      codeVerifier: 'v',
    });
    expect(tokens.accessToken).toBe('AT');
    expect(tokens.refreshToken).toBe('RT');
    expect(tokens.scope).toBe('playlist-modify-private');
    // 3600s de validez, expiresAtMs aprox = now + 3600000
    expect(tokens.expiresAtMs).toBeGreaterThanOrEqual(before + 3_600_000 - 100);
    expect(tokens.expiresAtMs).toBeLessThanOrEqual(Date.now() + 3_600_000 + 100);
  });

  it('respuesta no-2xx tira Error con cuerpo legible', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('invalid_grant', { status: 400 }),
    );
    await expect(
      exchangeCodeForTokens({ clientId: 'c', redirectUri: 'r', code: 'c', codeVerifier: 'v' }),
    ).rejects.toThrow(/400/);
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT2',
          refresh_token: 'RT2',
          expires_in: 3600,
          scope: 'playlist-modify-private',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve nuevo accessToken y refresh', async () => {
    const tokens = await refreshAccessToken({ clientId: 'c', refreshToken: 'RT' });
    expect(tokens.accessToken).toBe('AT2');
    expect(tokens.refreshToken).toBe('RT2');
  });
});
