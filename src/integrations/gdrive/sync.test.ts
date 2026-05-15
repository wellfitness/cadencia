import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emptySyncedData } from '@core/sync/schema';
import type { SavedSession, SyncedData, UploadedCsvRecord } from '@core/sync/types';

/**
 * Tests del orquestador de sync en `sync.ts`, centrados en `pull()`. Como
 * `pull()` es interno y no esta exportado, lo ejercitamos via `connect()`,
 * que llama a `pull()` justo despues de obtener el token. Los mocks
 * sustituyen drive-api, auth y cadenciaStore para que los asserts puedan
 * mirar exactamente que se subio y que se aplico localmente.
 */

vi.mock('./auth', () => ({
  signIn: vi.fn().mockResolvedValue({ token: 'test-token', email: 'test@test.com' }),
  signOut: vi.fn().mockResolvedValue(undefined),
  getTokenSilent: vi.fn().mockResolvedValue('test-token'),
  refreshToken: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('./drive-api', () => ({
  setTokenRefresher: vi.fn(),
  findFile: vi.fn(),
  readFile: vi.fn(),
  createFile: vi.fn(),
  updateFile: vi.fn(),
  getFileMetadata: vi.fn(),
  DriveApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'DriveApiError';
    }
  },
}));

vi.mock('@ui/state/cadenciaStore', () => ({
  loadCadenciaData: vi.fn(),
  saveCadenciaData: vi.fn(),
}));

import * as driveApi from './drive-api';
import * as cadenciaStore from '@ui/state/cadenciaStore';
import { connect, disconnect } from './sync';

const mockedFindFile = vi.mocked(driveApi.findFile);
const mockedReadFile = vi.mocked(driveApi.readFile);
const mockedUpdateFile = vi.mocked(driveApi.updateFile);
const mockedGetFileMetadata = vi.mocked(driveApi.getFileMetadata);
const mockedLoadCadenciaData = vi.mocked(cadenciaStore.loadCadenciaData);
const mockedSaveCadenciaData = vi.mocked(cadenciaStore.saveCadenciaData);

function mkSession(id: string, updatedAt: string, deletedAt?: string): SavedSession {
  const s: SavedSession = {
    id,
    name: id,
    plan: { name: id, items: [] },
    createdAt: updatedAt,
    updatedAt,
  };
  if (deletedAt !== undefined) s.deletedAt = deletedAt;
  return s;
}

function mkCsv(id: string, updatedAt: string): UploadedCsvRecord {
  return {
    id,
    name: `${id}.csv`,
    csvText: '',
    trackCount: 0,
    createdAt: updatedAt,
    updatedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  await disconnect();
});

describe('pull() via connect()', () => {
  it('Caso A (Bug #1): local con userInputs nuevo + remote rico => merge, no aplastar Drive', async () => {
    // Setup: local recien instalado con peso cambiado hoy. Remote tiene
    // 10 sesiones + 5 csvs subidos hace una semana.
    const localNow = '2026-05-15T12:00:00Z';
    const remoteWeekAgo = '2026-05-08T00:00:00Z';

    const local = emptySyncedData();
    local.userInputs = {
      sport: 'bike',
      weightKg: 70,
      ftpWatts: null,
      maxHeartRate: null,
      restingHeartRate: null,
      birthYear: null,
      sex: null,
      bikeWeightKg: null,
      bikeType: null,
    };
    local._sectionMeta.userInputs = { updatedAt: localNow };
    local.updatedAt = localNow;

    const remote = emptySyncedData();
    remote.savedSessions = Array.from({ length: 10 }, (_, i) =>
      mkSession(`s${i}`, remoteWeekAgo),
    );
    remote._sectionMeta.savedSessions = { updatedAt: remoteWeekAgo };
    remote.uploadedCsvs = Array.from({ length: 5 }, (_, i) => mkCsv(`c${i}`, remoteWeekAgo));
    remote._sectionMeta.uploadedCsvs = { updatedAt: remoteWeekAgo };
    remote.updatedAt = remoteWeekAgo;

    mockedLoadCadenciaData.mockReturnValue(local);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    mockedReadFile.mockResolvedValue(remote);
    mockedUpdateFile.mockResolvedValue({ id: 'f1', version: '2' });

    await connect();

    // El blob aplicado localmente debe contener tanto userInputs como las
    // 10 sesiones y los 5 csvs (merged), no solo el local pelado.
    expect(mockedSaveCadenciaData).toHaveBeenCalled();
    const applied = mockedSaveCadenciaData.mock.calls.at(-1)?.[0] as SyncedData;
    expect(applied.userInputs).toEqual(local.userInputs);
    expect(applied.savedSessions.filter((s) => !s.deletedAt)).toHaveLength(10);
    expect(applied.uploadedCsvs.filter((c) => !c.deletedAt)).toHaveLength(5);

    // El push a Drive debe llevar el merged, NO el local sin las sesiones.
    expect(mockedUpdateFile).toHaveBeenCalled();
    const uploaded = mockedUpdateFile.mock.calls.at(-1)?.[2] as SyncedData;
    expect(uploaded.userInputs).toEqual(local.userInputs);
    expect(uploaded.savedSessions.filter((s) => !s.deletedAt)).toHaveLength(10);
    expect(uploaded.uploadedCsvs.filter((c) => !c.deletedAt)).toHaveLength(5);
  });

  it('Caso B (Bug #2): borrado local + cambio remoto nuevo => tombstones se respetan', async () => {
    // Setup: usuario borra TODAS sus sesiones (9 tombstones). Mientras, otro
    // dispositivo anyade 1 sesion nueva con id distinto → remote.updatedAt > local.
    // Riqueza local (0 vivas) << riqueza remote (10 vivas) → la anti-regresion
    // suave actual descarta los tombstones y resucita las 9 sesiones borradas.
    const deletionTime = '2026-05-15T10:00:00Z';
    const remoteLater = '2026-05-15T11:00:00Z';

    const local = emptySyncedData();
    // 9 tombstones, 0 vivas.
    local.savedSessions = Array.from({ length: 9 }, (_, i) =>
      mkSession(`gone${i}`, deletionTime, deletionTime),
    );
    local._sectionMeta.savedSessions = { updatedAt: deletionTime };
    local.updatedAt = deletionTime;

    const remote = emptySyncedData();
    // Las 9 originales sin tombstones (anteriores al borrado) + 1 nueva que
    // mueve remote.updatedAt por delante de local.updatedAt.
    remote.savedSessions = [
      ...Array.from({ length: 9 }, (_, i) =>
        mkSession(`gone${i}`, '2026-05-14T00:00:00Z'),
      ),
      mkSession('newOne', remoteLater),
    ];
    remote._sectionMeta.savedSessions = { updatedAt: remoteLater };
    remote.updatedAt = remoteLater;

    mockedLoadCadenciaData.mockReturnValue(local);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    mockedReadFile.mockResolvedValue(remote);
    mockedUpdateFile.mockResolvedValue({ id: 'f1', version: '2' });

    await connect();

    expect(mockedSaveCadenciaData).toHaveBeenCalled();
    const applied = mockedSaveCadenciaData.mock.calls.at(-1)?.[0] as SyncedData;

    // 1 viva (la nueva de remote), 9 tombstones (los borrados se respetan).
    const alive = applied.savedSessions.filter((s) => !s.deletedAt);
    expect(alive).toHaveLength(1);
    expect(alive[0]?.id).toBe('newOne');

    const tombstones = applied.savedSessions.filter((s) => s.deletedAt !== undefined);
    expect(tombstones).toHaveLength(9);

    // Drive recibe el merge con los tombstones (asi otros dispositivos
    // tambien borran).
    expect(mockedUpdateFile).toHaveBeenCalled();
    const uploaded = mockedUpdateFile.mock.calls.at(-1)?.[2] as SyncedData;
    expect(uploaded.savedSessions.filter((s) => s.deletedAt !== undefined)).toHaveLength(9);
  });

  it('Caso C (fresh install): local sin _sectionMeta, remote rico => applyRemote sin push', async () => {
    const local = emptySyncedData();
    // _sectionMeta vacio: usuario nunca ha tocado nada en este dispositivo.

    const remote = emptySyncedData();
    remote.savedSessions = Array.from({ length: 3 }, (_, i) =>
      mkSession(`s${i}`, '2026-05-14T00:00:00Z'),
    );
    remote._sectionMeta.savedSessions = { updatedAt: '2026-05-14T00:00:00Z' };
    remote.updatedAt = '2026-05-14T00:00:00Z';

    mockedLoadCadenciaData.mockReturnValue(local);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    mockedReadFile.mockResolvedValue(remote);

    await connect();

    expect(mockedSaveCadenciaData).toHaveBeenCalled();
    const applied = mockedSaveCadenciaData.mock.calls.at(-1)?.[0] as SyncedData;
    expect(applied.savedSessions).toHaveLength(3);

    // Fresh install: no hay nada que aportar al remoto → no push.
    expect(mockedUpdateFile).not.toHaveBeenCalled();
  });

  it('Caso D (idempotencia): local y remote estructuralmente iguales => no push', async () => {
    // Formato ISO completo con milisegundos para que mergeData no lo
    // re-normalice y deepEqual reconozca igualdad.
    const t = new Date('2026-05-15T00:00:00Z').toISOString();
    const shared = emptySyncedData();
    shared.userInputs = {
      sport: 'bike',
      weightKg: 70,
      ftpWatts: null,
      maxHeartRate: null,
      restingHeartRate: null,
      birthYear: null,
      sex: null,
      bikeWeightKg: null,
      bikeType: null,
    };
    shared._sectionMeta.userInputs = { updatedAt: t };
    shared.updatedAt = t;

    // local y remote son blobs gemelos (mismo estado tras un sync previo).
    mockedLoadCadenciaData.mockReturnValue(shared);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    // Devolvemos una copia estructuralmente igual.
    mockedReadFile.mockResolvedValue(JSON.parse(JSON.stringify(shared)) as SyncedData);

    await connect();

    // No hay cambios entre local y remote → no se debe disparar updateFile.
    expect(mockedUpdateFile).not.toHaveBeenCalled();
  });
});
