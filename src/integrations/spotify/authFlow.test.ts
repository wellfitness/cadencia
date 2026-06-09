import { describe, it, expect, beforeEach } from 'vitest';
import { buildSpotifyAuthorizationUrl } from './authFlow';
import { loadAuthFlow } from './storage';

describe('buildSpotifyAuthorizationUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('construye la URL del endpoint de autorizacion con el client_id dado', async () => {
    const url = new URL(await buildSpotifyAuthorizationUrl('mi-client-id'));
    expect(url.origin).toBe('https://accounts.spotify.com');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('client_id')).toBe('mi-client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
  });

  it('persiste el authFlow (PKCE) con el mismo state que viaja en la URL', async () => {
    const url = new URL(await buildSpotifyAuthorizationUrl('mi-client-id'));
    const urlState = url.searchParams.get('state');
    const flow = loadAuthFlow();
    expect(flow).not.toBeNull();
    expect(flow?.state).toBe(urlState);
    expect(flow?.codeVerifier).toBeTruthy();
  });

  it('usa los scopes indicados', async () => {
    const url = new URL(
      await buildSpotifyAuthorizationUrl('mi-client-id', ['playlist-modify-private']),
    );
    expect(url.searchParams.get('scope')).toBe('playlist-modify-private');
  });

  it('usa los scopes de creacion de playlists por defecto', async () => {
    const url = new URL(await buildSpotifyAuthorizationUrl('mi-client-id'));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('playlist-modify-private');
  });
});
