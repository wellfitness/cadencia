import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findFile,
  readFile,
  getFileMetadata,
  setTokenRefresher,
  DriveApiError,
} from './drive-api';

beforeEach(() => {
  vi.restoreAllMocks();
  setTokenRefresher(null);
});

describe('drive-api', () => {
  it('findFile devuelve null si no hay archivo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 }),
    );
    const result = await findFile('token123');
    expect(result).toBeNull();
  });

  it('findFile devuelve el primer match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          files: [{ id: 'f1', name: 'cadencia_data.json', version: '7' }],
        }),
        { status: 200 },
      ),
    );
    const result = await findFile('token123');
    expect(result?.id).toBe('f1');
    expect(result?.version).toBe('7');
  });

  it('readFile parsea JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: 1, savedSessions: [] }), {
        status: 200,
      }),
    );
    const result = await readFile('token', 'fileId');
    expect(result.schemaVersion).toBe(1);
  });

  it('retry automatico en 401 si hay token refresher', async () => {
    const refresher = vi.fn().mockResolvedValue('newToken');
    setTokenRefresher(refresher);
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve(new Response('', { status: 401 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'f1', version: '1' }), { status: 200 }),
      );
    });
    const result = await getFileMetadata('oldToken', 'fileId');
    expect(refresher).toHaveBeenCalledOnce();
    expect(result.id).toBe('f1');
    expect(calls).toBe(2);
  });

  it('lanza DriveApiError con .status si respuesta no-OK y no hay refresher', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(getFileMetadata('token', 'fileId')).rejects.toBeInstanceOf(
      DriveApiError,
    );
  });

  it('error preserva el status code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    try {
      await getFileMetadata('token', 'fileId');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DriveApiError);
      expect((err as DriveApiError).status).toBe(403);
    }
  });
});
