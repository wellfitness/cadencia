import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addTracksToPlaylist, createPlaylist, createPlaylistWithTracks } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPlaylist', () => {
  it('POST a /me/playlists con body correcto', async () => {
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
    const result = await createPlaylist('AT', 'Mi lista', 'desc');
    expect(result).toEqual({
      id: 'pl123',
      name: 'Mi lista',
      externalUrl: 'https://open.spotify.com/playlist/pl123',
    });
    const call = fetchSpy.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain('/v1/me/playlists');
    expect(url).not.toContain('/users/');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ name: 'Mi lista', description: 'desc', public: false });
  });
});

describe('addTracksToPlaylist', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 201 }));
  });

  it('POST a /playlists/{id}/items, NO /tracks (deprecado feb-2026)', async () => {
    await addTracksToPlaylist('AT', 'pl123', ['spotify:track:a']);
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toContain('/v1/playlists/pl123/items');
    expect(url).not.toMatch(/\/tracks($|\?)/);
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
      name: 'X',
      description: 'd',
      uris: ['spotify:track:a', 'spotify:track:b'],
    });
    expect(result.trackCount).toBe(2);
    expect(result.externalUrl).toBe('https://open.spotify.com/playlist/pl1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
