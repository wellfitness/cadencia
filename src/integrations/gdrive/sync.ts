import { GDRIVE_CONFIG } from './config';
import { signIn, signOut, getTokenSilent, refreshToken } from './auth';
import {
  setTokenRefresher,
  findFile,
  readFile,
  createFile,
  updateFile,
  getFileMetadata,
  DriveApiError,
} from './drive-api';
import { mergeData } from '@core/sync/merge';
import { isEmptyData, calculateDataRichness } from '@core/sync/richness';
import { cleanExpiredTombstones } from '@core/sync/tombstones';
import type { SyncStatus, SyncedData } from '@core/sync/types';
import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';

/**
 * Orquestador de sincronizacion bidireccional cadenciaStore <-> Drive.
 *
 * Estrategia:
 * - Push debounced: tras 'cadencia-data-saved', espera 2s y sube.
 * - Pull periodico: cada 30s consulta solo metadata (~200B); si la
 *   version remota difiere, descarga y mergea.
 * - Pull en visibilitychange: al volver a la tab, comprueba inmediato.
 * - Anti-regresion: si local esta vacio o es 30% menos rico que remote
 *   (instalacion nueva), aplica remote sin merge.
 * - Anti-ciclo: flag `_applyingRemote` evita que pull dispare push tras
 *   actualizar localStorage con datos descargados.
 */

const SYNC_STATE_KEY = 'cadencia:gdrive:syncState';

interface SyncState {
  connected?: boolean;
  email?: string;
  fileId?: string;
  fileVersion?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  syncHealth?: 'healthy' | 'token_expired' | 'error';
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _syncing = false;
let _applyingRemote = false;
let _lastSyncAt = 0;
/**
 * Promise cacheada de init: garantiza idempotencia incluso bajo doble llamada
 * concurrente (HMR de Vite, futuro StrictMode). Antes existia una flag boolean
 * que se asignaba antes del await: dos llamadas paralelas pasaban el guard
 * antes de que la primera marcara, registrando listeners por duplicado.
 */
let _initPromise: Promise<void> | null = null;

/** Handlers nombrados para poder removerlos en disconnect (evita leaks). */
let _onDataSaved: (() => void) | null = null;
let _onVisibilityChange: (() => void) | null = null;

function getSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SyncState;
  } catch {
    return {};
  }
}

function setSyncState(updates: Partial<SyncState>): SyncState {
  const next: SyncState = { ...getSyncState(), ...updates };
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function isConnected(): boolean {
  return getSyncState().connected === true;
}

export function getSyncInfo(): SyncState {
  return getSyncState();
}

function notify(status: SyncStatus): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gdrive-sync-status', { detail: { status } }));
}

/**
 * Inicializa el motor de sync. Debe llamarse al arrancar la app. Si el
 * usuario ya estaba conectado, intenta sync silencioso. Idempotente: llamadas
 * concurrentes o repetidas devuelven la misma promesa y no apilan listeners.
 */
export function init(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = doInit();
  return _initPromise;
}

async function doInit(): Promise<void> {
  setTokenRefresher(() => refreshToken());

  if (isConnected()) {
    try {
      const token = await getTokenSilent();
      if (token) {
        await pull(token);
        startPolling();
        notify('synced');
      } else {
        setSyncState({ syncHealth: 'token_expired' });
        notify('token_expired');
      }
    } catch (err) {
      console.warn('[gdrive sync] init error:', err);
      notify('error');
    }
  }

  // Listeners con referencia nombrada: disconnect los desregistra. Sin esto,
  // connect→disconnect→connect dejaba listeners "muertos" anteriores que
  // seguian ejecutandose (gastando ciclos por cada cambio aunque ignorasen
  // por el guard interno).
  if (typeof window !== 'undefined' && _onDataSaved === null) {
    _onDataSaved = (): void => {
      if (isConnected() && !_applyingRemote) debouncedPush();
    };
    window.addEventListener('cadencia-data-saved', _onDataSaved);
  }

  if (typeof document !== 'undefined' && _onVisibilityChange === null) {
    _onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && isConnected() && !_syncing) {
        void checkRemote();
      }
    };
    document.addEventListener('visibilitychange', _onVisibilityChange);
  }
}

/**
 * Inicia el flow de conexion (popup OAuth). Tras consentimiento, hace
 * un sync inicial completo (pull + posible push) para alinear los dos
 * lados.
 */
export async function connect(): Promise<{ email: string }> {
  notify('connecting');
  const result = await signIn();
  if (!result.token) throw new Error('No se obtuvo token');
  setSyncState({
    connected: true,
    email: result.email,
    connectedAt: new Date().toISOString(),
    syncHealth: 'healthy',
  });
  await pull(result.token);
  startPolling();
  notify('synced');
  return { email: result.email };
}

/** Revoca token, limpia estado de sync. NO toca cadenciaStore — los datos locales se conservan. */
export async function disconnect(): Promise<void> {
  stopPolling();
  // Quitamos listeners para que un futuro `init()` los registre frescos. Si
  // los dejamos colgados, su guard interno los neutraliza pero gastamos un
  // dispatch en cada cambio, y cualquier reconnect duplicaria handlers.
  if (typeof window !== 'undefined' && _onDataSaved !== null) {
    window.removeEventListener('cadencia-data-saved', _onDataSaved);
    _onDataSaved = null;
  }
  if (typeof document !== 'undefined' && _onVisibilityChange !== null) {
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    _onVisibilityChange = null;
  }
  // Permitir que el siguiente connect llame a init() de nuevo.
  _initPromise = null;
  await signOut();
  try {
    localStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    // ignore
  }
  notify('disconnected');
}

function startPolling(): void {
  stopPolling();
  if (typeof setInterval === 'undefined') return;
  _pollTimer = setInterval(() => void checkRemote(), GDRIVE_CONFIG.POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (_pollTimer !== null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

/**
 * Verifica si hay cambios remotos comparando solo metadata. Si la
 * version cambio, dispara pull completo. Llamada barata (~200 bytes).
 */
async function checkRemote(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (_syncing || !isConnected()) return;
  const state = getSyncState();
  if (!state.fileId) return;

  _syncing = true;
  try {
    const token = await getTokenSilent();
    if (!token) {
      setSyncState({ syncHealth: 'token_expired' });
      notify('token_expired');
      return;
    }
    const meta = await getFileMetadata(token, state.fileId);
    if (meta.version !== state.fileVersion) {
      await pull(token);
      notify('synced');
    }
    _lastSyncAt = Date.now();
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      setSyncState({ syncHealth: 'token_expired' });
      notify('token_expired');
    } else {
      console.warn('[gdrive sync] poll error:', err);
    }
  } finally {
    _syncing = false;
  }
}

/**
 * Pull: lee Drive, mergea con local y aplica el resultado. Si los dos
 * tenian cambios, sube el merged a Drive para que ambos converjan.
 */
async function pull(token: string): Promise<void> {
  const state = getSyncState();
  let file: { id: string; version: string } | null = null;

  if (state.fileId) {
    try {
      file = await getFileMetadata(token, state.fileId);
    } catch {
      file = null;
    }
  }
  if (!file) {
    file = await findFile(token);
  }
  if (!file) {
    // No hay archivo en Drive — push inicial.
    await push(token);
    return;
  }

  setSyncState({ fileId: file.id, fileVersion: file.version });
  const remote = await readFile(token, file.id);
  const local = loadCadenciaData();

  // Anti-regresion fuerte: local vacio + remote con datos => aplica remote.
  if (isEmptyData(local) && !isEmptyData(remote)) {
    applyRemote(remote);
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
    return;
  }

  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();

  if (remoteTime > localTime) {
    // Anti-regresion suave: si local << remote en riqueza, aplica remote directo.
    if (calculateDataRichness(local) < calculateDataRichness(remote) * 0.3) {
      applyRemote(remote);
      setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
      return;
    }
    const { merged } = mergeData(local, remote);
    const cleaned = cleanExpiredTombstones(merged);
    applyRemote(cleaned);
    try {
      const result = await updateFile(token, file.id, cleaned);
      setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
    } catch (err) {
      console.warn('[gdrive sync] push tras merge fallo:', err);
    }
  } else if (localTime > remoteTime) {
    await push(token);
  } else {
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
  }
}

/**
 * Push: sube cadenciaStore actual a Drive. Si la version remota cambio
 * desde nuestro ultimo sync (otro dispositivo escribio), dispara
 * pullAndMerge para no perder los cambios remotos.
 */
async function push(token: string): Promise<void> {
  const local = loadCadenciaData();
  const state = getSyncState();

  if (state.fileId) {
    let meta: { id: string; version: string } | null = null;
    try {
      meta = await getFileMetadata(token, state.fileId);
    } catch {
      meta = null;
    }
    if (meta && state.fileVersion && meta.version !== state.fileVersion) {
      await pullAndMerge(token, state.fileId);
      return;
    }
    if (meta) {
      const result = await updateFile(token, state.fileId, local);
      setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
      return;
    }
  }

  // Sin fileId cacheado: buscar o crear.
  const existing = await findFile(token);
  if (existing) {
    const remote = await readFile(token, existing.id);
    const { merged } = mergeData(local, remote);
    const cleaned = cleanExpiredTombstones(merged);
    const result = await updateFile(token, existing.id, cleaned);
    applyRemote(cleaned);
    setSyncState({
      fileId: result.id,
      fileVersion: result.version,
      lastSyncAt: new Date().toISOString(),
    });
  } else {
    const result = await createFile(token, local);
    setSyncState({
      fileId: result.id,
      fileVersion: result.version,
      lastSyncAt: new Date().toISOString(),
    });
  }
}

/**
 * pullAndMerge se invoca cuando push detecta colision (otro dispositivo
 * escribio entre medias). Lee remoto fresco, mergea y sube el resultado.
 */
async function pullAndMerge(token: string, fileId: string): Promise<void> {
  const remote = await readFile(token, fileId);
  const meta = await getFileMetadata(token, fileId);
  const local = loadCadenciaData();
  const { merged } = mergeData(local, remote);
  const cleaned = cleanExpiredTombstones(merged);
  applyRemote(cleaned);
  try {
    const result = await updateFile(token, fileId, cleaned);
    setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
  } catch {
    setSyncState({ fileVersion: meta.version, lastSyncAt: new Date().toISOString() });
  }
}

/**
 * Aplica datos remotos al cadenciaStore. El flag _applyingRemote evita
 * que el evento 'cadencia-data-saved' que dispara saveCadenciaData
 * provoque un push automatico (ciclo infinito).
 */
function applyRemote(data: SyncedData): void {
  _applyingRemote = true;
  saveCadenciaData(data);
  // Liberamos el flag tras un tick — listeners sincronos del evento se
  // habran ejecutado ya. Cualquier escritura posterior si dispara push.
  setTimeout(() => {
    _applyingRemote = false;
  }, 0);
}

/**
 * Push debounceado: tras 2s sin nuevos cambios y respetando cooldown,
 * sube cadenciaStore a Drive. Si llega otro cambio antes, reinicia el
 * timer.
 */
function debouncedPush(): void {
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    void doPush();
  }, GDRIVE_CONFIG.DEBOUNCE_MS);
}

async function doPush(): Promise<void> {
  if (_syncing) return;
  if (Date.now() - _lastSyncAt < GDRIVE_CONFIG.SYNC_COOLDOWN_MS) return;
  _syncing = true;
  try {
    const token = await getTokenSilent();
    if (!token) {
      setSyncState({ syncHealth: 'token_expired' });
      notify('token_expired');
      return;
    }
    await push(token);
    _lastSyncAt = Date.now();
    notify('synced');
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      setSyncState({ syncHealth: 'token_expired' });
      notify('token_expired');
    } else {
      console.warn('[gdrive sync] push error:', err);
      notify('error');
    }
  } finally {
    _syncing = false;
  }
}
