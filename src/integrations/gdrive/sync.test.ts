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
import {
  connect,
  disconnect,
  syncNow,
  getConflicts,
  clearConflicts,
  getBackup,
  clearBackup,
} from './sync';

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

describe('syncNow() (sync manual)', () => {
  it('no-op si no esta conectado', async () => {
    mockedLoadCadenciaData.mockReturnValue(emptySyncedData());
    await syncNow();
    expect(mockedFindFile).not.toHaveBeenCalled();
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('tras connect, dispara pull y actualiza lastSyncAt', async () => {
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
    local._sectionMeta.userInputs = { updatedAt: '2026-05-15T12:00:00Z' };
    local.updatedAt = '2026-05-15T12:00:00Z';
    mockedLoadCadenciaData.mockReturnValue(local);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    // Devolver una copia para evitar mutacion cruzada del mismo objeto.
    mockedReadFile.mockResolvedValue(JSON.parse(JSON.stringify(local)) as SyncedData);
    mockedUpdateFile.mockResolvedValue({ id: 'f1', version: '2' });

    await connect();
    const callsBefore = mockedReadFile.mock.calls.length;

    await syncNow();

    // syncNow re-ejecuto el pull → readFile se llamo una vez mas.
    expect(mockedReadFile.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('Conflict log y backup persistentes', () => {
  it('getConflicts() devuelve array vacio cuando no hay log', () => {
    localStorage.clear();
    expect(getConflicts()).toEqual([]);
  });

  it('clearConflicts() borra el log', () => {
    localStorage.setItem(
      'cadencia:gdrive:conflicts',
      JSON.stringify({
        entries: [
          {
            section: 'userInputs',
            loserValue: null,
            loserTimestamp: '2026-05-15T00:00:00Z',
            winnerTimestamp: '2026-05-15T00:00:00Z',
            resolvedAt: '2026-05-15T00:00:00Z',
          },
        ],
      }),
    );
    expect(getConflicts()).toHaveLength(1);
    clearConflicts();
    expect(getConflicts()).toEqual([]);
  });

  it('getBackup() y clearBackup() funcionan sobre el snapshot persistido', () => {
    localStorage.clear();
    expect(getBackup()).toBeNull();
    localStorage.setItem(
      'cadencia:gdrive:preSyncBackup',
      JSON.stringify(emptySyncedData()),
    );
    expect(getBackup()).not.toBeNull();
    clearBackup();
    expect(getBackup()).toBeNull();
  });

  it('un merge con conflictos persiste entradas en el log', async () => {
    // Caso: local y remote con userInputs distintos pero mismo timestamp →
    // mergeData detecta conflicto (winner remote por idempotencia, loser
    // local registrado).
    const t = '2026-05-15T00:00:00.000Z';
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
    local._sectionMeta.userInputs = { updatedAt: t };
    local.updatedAt = t;

    const remote = JSON.parse(JSON.stringify(local)) as SyncedData;
    if (remote.userInputs) remote.userInputs.weightKg = 80;

    mockedLoadCadenciaData.mockReturnValue(local);
    mockedFindFile.mockResolvedValue({ id: 'f1', version: '1' });
    mockedGetFileMetadata.mockResolvedValue({ id: 'f1', version: '1' });
    mockedReadFile.mockResolvedValue(remote);
    mockedUpdateFile.mockResolvedValue({ id: 'f1', version: '2' });

    localStorage.removeItem('cadencia:gdrive:conflicts');
    await connect();

    const log = getConflicts();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]?.section).toBe('userInputs');
  });
});
