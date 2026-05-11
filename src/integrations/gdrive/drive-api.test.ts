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

  it('readFile parsea JSON valido', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          _sectionMeta: {},
          userInputs: null,
          musicPreferences: null,
          savedSessions: [],
          uploadedCsvs: [],
          nativeCatalogPrefs: null,
          dismissedTrackUris: [],
          plannedEvents: [],
        }),
        { status: 200 },
      ),
    );
    const result = await readFile('token', 'fileId');
    expect(result.schemaVersion).toBe(1);
  });

  it('readFile normaliza blob legitimo de version antigua sin arrays nuevos', async () => {
    // Caso real: blob escrito por una version de Cadencia anterior a la
    // extension del schema (sin uploadedCsvs / dismissedTrackUris /
    // plannedEvents / playlistHistory). Antes lanzaba DriveApiError 422 y
    // abortaba el sync silenciosamente; ahora rellena con [] y preserva el
    // updatedAt real del remoto para que el LWW funcione bien.
    const remoteUpdatedAt = new Date('2026-04-01T10:00:00.000Z').toISOString();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: remoteUpdatedAt,
          _sectionMeta: {},
          userInputs: null,
          musicPreferences: null,
          savedSessions: [],
        }),
        { status: 200 },
      ),
    );
    const result = await readFile('token', 'fileId');
    expect(result.savedSessions).toEqual([]);
    expect(result.uploadedCsvs).toEqual([]);
    expect(result.plannedEvents).toEqual([]);
    expect(result.dismissedTrackUris).toEqual([]);
    expect(result.playlistHistory).toEqual([]);
    expect(result.tvModePrefs).toBeNull();
    // Critico: preservar el updatedAt real del remoto, no resetearlo a 1970,
    // para que el LWW no marque el local como ganador y sobreescriba Drive.
    expect(result.updatedAt).toBe(remoteUpdatedAt);
  });

  it('readFile lanza DriveApiError 422 si el blob es totalmente irreconocible', async () => {
    // Sin schemaVersion ni savedSessions — no es un SyncedData. Lanzar
    // protege el archivo remoto: si devolviera empty, el LWW perderia y el
    // local sobrescribiria Drive con datos posiblemente inferiores.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ random: 'object' }), { status: 200 }),
    );
    await expect(readFile('token', 'fileId')).rejects.toBeInstanceOf(DriveApiError);
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
