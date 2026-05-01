import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  getDevices,
  getPlayerState,
  next,
  pause,
  play,
  previous,
  transferPlayback,
} from './player';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
}

describe('getPlayerState', () => {
  it('204 No Content → estado idle (nada sonando)', async () => {
    mockFetchOnce(new Response(null, { status: 204 }));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual({
      isPlaying: false,
      currentTrackUri: null,
      positionMs: null,
      device: null,
    });
  });

  it('200 con body → parsea is_playing, item.uri, progress_ms y device', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          is_playing: true,
          progress_ms: 12345,
          item: { uri: 'spotify:track:abc' },
          device: { id: 'd1', name: 'iPhone', type: 'Smartphone', is_active: true },
        }),
        { status: 200 },
      ),
    );
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual({
      isPlaying: true,
      currentTrackUri: 'spotify:track:abc',
      positionMs: 12345,
      device: { id: 'd1', name: 'iPhone', type: 'Smartphone', isActive: true },
    });
  });

  it('401 → token-expired', async () => {
    mockFetchOnce(new Response('', { status: 401 }));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.kind).toBe('token-expired');
  });

  it('403 con "premium" en body → not-premium', async () => {
    mockFetchOnce(new Response('Player command failed: Premium required', { status: 403 }));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.kind).toBe('not-premium');
  });

  it('403 sin "premium" en body → unknown 403', async () => {
    mockFetchOnce(new Response('Some other forbidden error', { status: 403 }));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.kind).toBe('unknown');
    if (result.error.kind !== 'unknown') throw new Error('narrow');
    expect(result.error.status).toBe(403);
  });

  it('404 → no-active-device', async () => {
    mockFetchOnce(new Response('', { status: 404 }));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.kind).toBe('no-active-device');
  });

  it('error de red → network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await getPlayerState('AT');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.kind).toBe('network');
  });
});

describe('play', () => {
  it('PUT a /me/player/play sin body cuando no hay opciones', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    const result = await play('AT');
    expect(result.ok).toBe(true);
    const call = spy.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain('/v1/me/player/play');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('PUT con body {uris} cuando se pasan URIs', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await play('AT', { uris: ['spotify:track:a', 'spotify:track:b'] });
    const init = spy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ uris: ['spotify:track:a', 'spotify:track:b'] });
  });

  it('include device_id en query cuando se pasa', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await play('AT', { deviceId: 'dev123', uris: ['spotify:track:x'] });
    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain('device_id=dev123');
  });

  it('uris vacios NO se incluyen en body (Spotify rechaza array vacio)', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await play('AT', { uris: [] });
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBeUndefined();
  });
});

describe('pause / next / previous', () => {
  it('pause → PUT /me/player/pause', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await pause('AT');
    const url = spy.mock.calls[0]![0] as string;
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(url).toContain('/v1/me/player/pause');
    expect(init.method).toBe('PUT');
  });

  it('next → POST /me/player/next', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await next('AT');
    const url = spy.mock.calls[0]![0] as string;
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(url).toContain('/v1/me/player/next');
    expect(init.method).toBe('POST');
  });

  it('previous → POST /me/player/previous', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await previous('AT');
    const url = spy.mock.calls[0]![0] as string;
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(url).toContain('/v1/me/player/previous');
    expect(init.method).toBe('POST');
  });
});

describe('getDevices', () => {
  it('200 con array → parsea cada device', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          devices: [
            { id: 'a', name: 'iPhone', type: 'Smartphone', is_active: true },
            { id: 'b', name: 'MacBook', type: 'Computer', is_active: false },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await getDevices('AT');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({ id: 'a', isActive: true });
    expect(result.value[1]).toMatchObject({ id: 'b', isActive: false });
  });

  it('200 sin array de devices → array vacio (no error)', async () => {
    mockFetchOnce(new Response(JSON.stringify({}), { status: 200 }));
    const result = await getDevices('AT');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toEqual([]);
  });

  it('device sin id es ignorado, no rompe el resto', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          devices: [
            { name: 'Sin id' }, // invalido
            { id: 'b', name: 'MacBook' }, // valido
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await getDevices('AT');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe('b');
  });
});

describe('transferPlayback', () => {
  it('PUT /me/player con device_ids y play', async () => {
    const spy = mockFetchOnce(new Response(null, { status: 204 }));
    await transferPlayback('AT', 'dev123', true);
    const init = spy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ device_ids: ['dev123'], play: true });
  });
});
