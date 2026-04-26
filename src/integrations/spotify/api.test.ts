import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addTracksToPlaylist,
  createPlaylist,
  createPlaylistWithTracks,
  getCurrentUser,
} from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCurrentUser', () => {
  it('parsea id + display_name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u123', display_name: 'Pepe' }), { status: 200 }),
    );
    const user = await getCurrentUser('AT');
    expect(user).toEqual({ id: 'u123', displayName: 'Pepe' });
  });

  it('display_name null se mantiene null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'u', display_name: null }), { status: 200 }),
    );
    expect((await getCurrentUser('AT')).displayName).toBeNull();
  });

  it('respuesta 401 tira Error con mensaje de Spotify', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { status: 401, message: 'Invalid access token' } }),
        { status: 401 },
      ),
    );
    await expect(getCurrentUser('AT')).rejects.toThrow(/Invalid access token/);
  });
});

describe('createPlaylist', () => {
  it('POST a /users/{id}/playlists con body correcto', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pl123',
          name: 'Mi lista',
          external_urls: { spotify: 'https://open.spotify.com/playlist/pl123' },
        }),
        { status: 201 },
      ),
    );
    const result = await createPlaylist('AT', 'u123', 'Mi lista', 'desc');
    expect(result).toEqual({
      id: 'pl123',
      name: 'Mi lista',
      externalUrl: 'https://open.spotify.com/playlist/pl123',
    });
    const call = fetchSpy.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain('/v1/users/u123/playlists');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ name: 'Mi lista', description: 'desc', public: false });
  });
});

describe('addTracksToPlaylist', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 201 }));
  });

  it('una sola peticion para <=100 URIs', async () => {
    const uris = Array.from({ length: 50 }, (_, i) => `spotify:track:${i}`);
    await addTracksToPlaylist('AT', 'pl123', uris);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('pagina por 100 cuando hay mas', async () => {
    const uris = Array.from({ length: 250 }, (_, i) => `spotify:track:${i}`);
    await addTracksToPlaylist('AT', 'pl123', uris);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 100 + 100 + 50
  });

  it('lista vacia: cero peticiones', async () => {
    await addTracksToPlaylist('AT', 'pl123', []);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('createPlaylistWithTracks', () => {
  it('crea playlist y anade tracks (2 fetches)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'pl1',
            name: 'X',
            external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 201 }));
    const result = await createPlaylistWithTracks({
      accessToken: 'AT',
      userId: 'u',
      name: 'X',
      description: 'd',
      uris: ['spotify:track:a', 'spotify:track:b'],
    });
    expect(result.trackCount).toBe(2);
    expect(result.externalUrl).toBe('https://open.spotify.com/playlist/pl1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
