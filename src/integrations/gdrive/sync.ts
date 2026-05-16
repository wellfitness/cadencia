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
import type { MergeConflict } from '@core/sync/merge';
import { mergeData, deepEqual } from '@core/sync/merge';
import { calculateDataRichness, hasNoLocalMeta } from '@core/sync/richness';
import { cleanExpiredTombstones } from '@core/sync/tombstones';
import type { SyncStatus, SyncedData } from '@core/sync/types';
import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';

/**
 * Orquestador de sincronizacion bidireccional cadenciaStore <-> Drive.
 *
 * Replica el modelo probado del Oraculo, con tres capas de proteccion:
 *
 *  1. Version check: antes de cualquier push verificamos que `file.version`
 *     en Drive coincide con la cacheada localmente. Si difiere, otro
 *     dispositivo escribio entre medias y disparamos pullAndMerge en lugar
 *     de sobrescribir.
 *  2. Merge inteligente: cualquier divergencia (excepto instalacion literal-
 *     mente nueva, detectada por `hasNoLocalMeta`) pasa por `mergeData`
 *     (LWW por seccion/item + tombstones). Nunca push ciego.
 *  3. Conflict log + backup: cada merge guarda los conflictos en
 *     `cadencia:gdrive:conflicts` (cap 50) y antes de aplicar remote/merge
 *     hacemos snapshot del local en `cadencia:gdrive:preSyncBackup` para
 *     recuperacion manual en caso de bug.
 *
 * Sync bidireccional:
 *  - Push debounced (2s) tras `cadencia-data-saved`.
 *  - Pull periodico cada 30s (metadata-only ~200B; descarga solo si version
 *    remota difiere).
 *  - Pull en visibilitychange visible.
 *
 * Salud del sync (`syncHealth`):
 *  - 'healthy' en operacion normal.
 *  - 'token_expired' cuando getTokenSilent devuelve null (requiere re-auth).
 *  - 'error' tras 3 fallos consecutivos no-401. Permite que la UI muestre
 *    "sync degradado" sin alarmar por un fallo puntual.
 *
 * Anti-ciclo: flag `_applyingRemote` evita que pull dispare push tras
 * escribir localStorage con datos descargados.
 */

const SYNC_STATE_KEY = 'cadencia:gdrive:syncState';
const BACKUP_KEY = 'cadencia:gdrive:preSyncBackup';
const CONFLICT_LOG_KEY = 'cadencia:gdrive:conflicts';
const MAX_CONFLICTS = 50;

interface SyncState {
  connected?: boolean;
  email?: string;
  fileId?: string;
  fileVersion?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  syncHealth?: 'healthy' | 'token_expired' | 'error';
}

interface ConflictLog {
  entries: MergeConflict[];
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _syncing = false;
let _applyingRemote = false;
let _lastSyncAt = 0;
let _consecutiveFailures = 0;
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

// ───────────────────────────────────────────────
// Estado de sync persistente
// ───────────────────────────────────────────────

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

/**
 * Borra claves de fileId/fileVersion (no soportado por setSyncState con
 * `undefined` en TS estricto). Se usa en fallback doble fallo de pullAndMerge:
 * descartamos el cache para que el proximo push haga findFile de nuevo.
 */
function clearSyncFileCache(): void {
  const state = getSyncState();
  delete state.fileId;
  delete state.fileVersion;
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function isConnected(): boolean {
  return getSyncState().connected === true;
}

export function getSyncInfo(): SyncState {
  return getSyncState();
}

// ───────────────────────────────────────────────
// Conflict log persistente (Capa 3)
// ───────────────────────────────────────────────

function loadConflictLog(): ConflictLog {
  try {
    const raw = localStorage.getItem(CONFLICT_LOG_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as Partial<ConflictLog>;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return { entries: [] };
  }
}

/**
 * Guarda conflictos detectados durante `mergeData` en localStorage. Capa
 * sin gravedad: si el log no se puede escribir, el sync sigue.
 *
 * Cap a MAX_CONFLICTS para no consumir cuota indefinidamente: si llegamos
 * a 50, descartamos los mas antiguos.
 */
function saveConflicts(conflicts: MergeConflict[]): void {
  if (conflicts.length === 0) return;
  const log = loadConflictLog();
  log.entries.push(...conflicts);
  if (log.entries.length > MAX_CONFLICTS) {
    log.entries = log.entries.slice(-MAX_CONFLICTS);
  }
  try {
    localStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(log));
    console.warn(`[Cadencia ↔ Drive] ${conflicts.length} conflicto(s) guardado(s) en log.`);
  } catch {
    // ignore
  }
}

/** Devuelve los conflictos persistidos. Util para una futura UI de revision. */
export function getConflicts(): MergeConflict[] {
  return loadConflictLog().entries;
}

/** Limpia el log de conflictos. */
export function clearConflicts(): void {
  try {
    localStorage.removeItem(CONFLICT_LOG_KEY);
  } catch {
    // ignore
  }
}

// ───────────────────────────────────────────────
// Backup pre-sync (Capa 3)
// ───────────────────────────────────────────────

/**
 * Guarda el SyncedData local antes de aplicar remote o merge. Permite
 * recuperacion manual si un merge inesperado deja datos en peor estado.
 * Ocupa una sola entrada: cada sync sobreescribe el anterior.
 */
function saveBackup(data: SyncedData): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  } catch {
    // No critico: el sync funciona sin backup. Si localStorage esta lleno
    // priorizamos los datos en vivo sobre la red de seguridad.
  }
}

/** Devuelve el snapshot pre-sync mas reciente. null si nunca hubo o se borro. */
export function getBackup(): SyncedData | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncedData;
  } catch {
    return null;
  }
}

/** Limpia el snapshot. La UI puede ofrecer un boton "olvidar backup". */
export function clearBackup(): void {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
}

// ───────────────────────────────────────────────
// Salud del sync
// ───────────────────────────────────────────────

function markHealthy(): void {
  _consecutiveFailures = 0;
  setSyncState({ syncHealth: 'healthy' });
}

function markTokenExpired(): void {
  setSyncState({ syncHealth: 'token_expired' });
  stopPolling();
  notify('token_expired');
}

/**
 * Marca un fallo no-401. Solo notifica 'error' tras 3 fallos consecutivos
 * para no alarmar por un cuelgue de red puntual. Cualquier sync exitoso
 * posterior llama a `markHealthy()` y resetea el contador.
 */
function markError(): void {
  _consecutiveFailures++;
  if (_consecutiveFailures >= 3) {
    setSyncState({ syncHealth: 'error' });
    notify('error');
  }
}

function notify(status: SyncStatus): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gdrive-sync-status', { detail: { status } }));
}

// ───────────────────────────────────────────────
// Inicializacion
// ───────────────────────────────────────────────

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
        markHealthy();
        startPolling();
        notify('synced');
        _lastSyncAt = Date.now();
      } else {
        markTokenExpired();
      }
    } catch (err) {
      console.warn('[gdrive sync] init error:', err);
      markError();
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
      if (document.visibilityState === 'hidden') {
        // Pausar el polling mientras la pestaña está oculta para no gastar
        // batería/CPU. Se reanuda al volver visible.
        stopPolling();
        // Flushear el debounce pendiente antes de que el SO pueda congelar
        // la pestaña: es más fiable que beforeunload para APIs async.
        if (_debounceTimer !== null) {
          clearTimeout(_debounceTimer);
          _debounceTimer = null;
          if (isConnected() && !_applyingRemote) void doPush();
        }
      } else if (document.visibilityState === 'visible' && isConnected() && !_syncing) {
        startPolling();
        void checkRemote();
      }
    };
    document.addEventListener('visibilitychange', _onVisibilityChange);
  }
}

// ───────────────────────────────────────────────
// Connect / Disconnect
// ───────────────────────────────────────────────

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
  markHealthy();
  startPolling();
  notify('synced');
  _lastSyncAt = Date.now();
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
  _consecutiveFailures = 0;
  await signOut();
  try {
    localStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    // ignore
  }
  notify('disconnected');
}

// ───────────────────────────────────────────────
// Sync manual (publico)
// ───────────────────────────────────────────────

/**
 * Fuerza un ciclo de sincronizacion completo (pull + posible push tras merge).
 * Util para un boton "Sincronizar ahora" en la UI o tras un evento puntual
 * (ej. el usuario importa un fichero y quiere que viaje a sus otros dispositivos
 * inmediatamente sin esperar al debounce).
 *
 * Idempotente: si ya hay un sync en curso, sale en silencio. Tras un sync
 * exitoso, marca el motor como `healthy` y reinicia el contador de fallos.
 */
export async function syncNow(): Promise<void> {
  if (_syncing) return;
  if (!isConnected()) return;
  _syncing = true;
  try {
    const token = await getTokenSilent();
    if (!token) {
      markTokenExpired();
      return;
    }
    await pull(token);
    markHealthy();
    notify('synced');
    _lastSyncAt = Date.now();
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      markTokenExpired();
    } else {
      console.warn('[gdrive sync] syncNow error:', err);
      markError();
    }
  } finally {
    _syncing = false;
  }
}

// ───────────────────────────────────────────────
// Polling periodico
// ───────────────────────────────────────────────

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
      markTokenExpired();
      return;
    }
    const meta = await getFileMetadata(token, state.fileId);
    if (meta.version !== state.fileVersion) {
      console.warn(
        `[Cadencia ↔ Drive] Cambio remoto detectado (local: ${state.fileVersion ?? '∅'}, ` +
          `remote: ${meta.version}). Descargando...`,
      );
      await pull(token);
      markHealthy();
      notify('synced');
    }
    _lastSyncAt = Date.now();
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      markTokenExpired();
    } else {
      console.warn('[gdrive sync] poll error:', err);
      markError();
    }
  } finally {
    _syncing = false;
  }
}

// ───────────────────────────────────────────────
// Pull: Drive → cadenciaStore (con merge)
// ───────────────────────────────────────────────

/**
 * Pull: lee Drive, mergea con local y aplica el resultado. Si los dos
 * tenian cambios, sube el merged a Drive para que ambos converjan.
 *
 * El driveVersionChanged se captura ANTES de actualizar el cache
 * (replicando Oraculo): si setSyncState bumpea fileVersion antes de la
 * comparacion, el flag siempre saldria false aunque otro dispositivo
 * hubiera escrito entre medias.
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
    console.warn('[Cadencia ↔ Drive] No hay archivo en Drive; subiendo el local como push inicial…');
    await push(token);
    return;
  }

  // Capturar driveVersionChanged ANTES de actualizar el cache (paridad con
  // Oraculo). No se usa para forzar logica distinta —siempre pasamos por
  // mergeData— pero queda registrado en el log diagnostico.
  const driveVersionChanged =
    state.fileVersion !== undefined && file.version !== state.fileVersion;

  setSyncState({ fileId: file.id, fileVersion: file.version });
  const remote = await readFile(token, file.id);
  const local = loadCadenciaData();

  const remoteRich = calculateDataRichness(remote);
  const localRich = calculateDataRichness(local);
  console.warn(
    `[Cadencia ↔ Drive] PULL: archivo encontrado (id=${file.id.slice(0, 8)}…, version=${file.version}` +
      `${driveVersionChanged ? ', CAMBIO REMOTO' : ''}). ` +
      `Riqueza remote=${remoteRich.toFixed(2)} (userInputs=${remote.userInputs !== null ? 'sí' : 'no'}, ` +
      `savedSessions=${remote.savedSessions.length}, uploadedCsvs=${remote.uploadedCsvs.length}). ` +
      `Riqueza local=${localRich.toFixed(2)} (userInputs=${local.userInputs !== null ? 'sí' : 'no'}).`,
  );

  // Anti-regresion fuerte: solo aplica remote sin merge si el blob local no
  // tiene ninguna meta (instalacion literalmente nueva, jamas modificada).
  // No usar isEmptyData: ese criterio dispara tambien cuando el usuario
  // borro todo intencionadamente (los tombstones tienen meta de seccion);
  // en ese caso debemos pasar por mergeData para que los borrados sobrevivan.
  if (hasNoLocalMeta(local)) {
    console.warn('[Cadencia ↔ Drive] Local sin meta (fresh install): aplicando remote directamente.');
    saveBackup(local);
    applyRemote(remote);
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
    return;
  }

  // En cualquier otra divergencia (local mas nuevo, remote mas nuevo, mismo
  // timestamp con cambios concurrentes), confiar siempre en mergeData. El
  // LWW por seccion + tombstones nunca destruye datos.
  console.warn('[Cadencia ↔ Drive] Fusionando local y remote via LWW.');
  saveBackup(local);
  const { merged, conflicts } = mergeData(local, remote);
  const cleaned = cleanExpiredTombstones(merged);

  if (conflicts.length > 0) {
    saveConflicts(conflicts);
  }

  applyRemote(cleaned);

  // Solo subir a Drive si el merge cambia respecto al remote actual: si local
  // ya estaba alineado con remote (o el merge no aporta nada nuevo), evitamos
  // un updateFile innecesario que ademas dispararia un version bump remoto y
  // un re-pull en otros dispositivos.
  if (!deepEqual(cleaned, remote)) {
    try {
      const result = await updateFile(token, file.id, cleaned);
      setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
    } catch (err) {
      console.warn('[Cadencia ↔ Drive] push tras merge falló:', err);
    }
  } else {
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
  }
}

// ───────────────────────────────────────────────
// Push: cadenciaStore → Drive (con version check)
// ───────────────────────────────────────────────

/**
 * Push: sube cadenciaStore actual a Drive. Si la version remota cambio
 * desde nuestro ultimo sync (otro dispositivo escribio), dispara
 * pullAndMerge para no perder los cambios remotos.
 */
async function push(token: string): Promise<void> {
  const local = loadCadenciaData();
  const state = getSyncState();

  console.warn(
    `[Cadencia ↔ Drive] PUSH: subiendo a Drive. ` +
      `userInputs=${local.userInputs !== null ? 'sí' : 'no'}, ` +
      `savedSessions=${local.savedSessions.length}, ` +
      `uploadedCsvs=${local.uploadedCsvs.length}, riqueza=${calculateDataRichness(local).toFixed(2)}.`,
  );

  if (state.fileId) {
    let meta: { id: string; version: string } | null = null;
    try {
      meta = await getFileMetadata(token, state.fileId);
    } catch {
      meta = null;
    }
    if (meta && state.fileVersion && meta.version !== state.fileVersion) {
      // CAPA 1: version mismatch → otro dispositivo escribio entre medias
      console.warn(
        `[Cadencia ↔ Drive] Version mismatch en push (local=${state.fileVersion}, remote=${meta.version}). ` +
          'Disparando pullAndMerge para no perder cambios remotos.',
      );
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
    saveBackup(local);
    const { merged, conflicts } = mergeData(local, remote);
    const cleaned = cleanExpiredTombstones(merged);
    if (conflicts.length > 0) saveConflicts(conflicts);
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
 *
 * Fallback estilo Oraculo: si el updateFile post-merge tambien falla
 * (doble colision, extremadamente raro), releemos Drive y aplicamos como
 * estado fresco. Si el segundo intento tambien falla, limpiamos el cache
 * de fileId para que el proximo push reidentifique el archivo via findFile.
 */
async function pullAndMerge(token: string, fileId: string): Promise<void> {
  console.warn('[Cadencia ↔ Drive] pullAndMerge: leyendo remote fresco…');
  const remote = await readFile(token, fileId);
  const meta = await getFileMetadata(token, fileId);
  const local = loadCadenciaData();

  // Señal diagnostica (no cambia el flujo): en Oraculo, una disparidad fuerte
  // de riqueza disparaba un aplicar-remote-directo. En Cadencia no podemos
  // hacerlo porque los tombstones viven inline en cada item (deletedAt) y un
  // bypass del merge resucitaria borrados intencionados. Pero loguear la
  // disparidad ayuda a diagnosticar bugs de sync donde un dispositivo tiene
  // datos stale.
  const remoteRich = calculateDataRichness(remote);
  const localRich = calculateDataRichness(local);
  if (remoteRich > 0 && localRich < remoteRich * 0.3) {
    console.warn(
      `[Cadencia ↔ Drive] Disparidad de riqueza notable en pullAndMerge ` +
        `(local=${localRich.toFixed(2)}, remote=${remoteRich.toFixed(2)}). ` +
        'Confiando en mergeData para preservar tombstones; backup disponible si revertir.',
    );
  }

  saveBackup(local);
  const { merged, conflicts } = mergeData(local, remote);
  const cleaned = cleanExpiredTombstones(merged);
  if (conflicts.length > 0) saveConflicts(conflicts);
  applyRemote(cleaned);

  try {
    const result = await updateFile(token, fileId, cleaned);
    setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
    console.warn('[Cadencia ↔ Drive] pullAndMerge completado.');
  } catch (err) {
    // Fallback: doble colision. Releer Drive y aplicar como estado fresco
    // — sacrifica los cambios locales no sincronizados de este ciclo para
    // garantizar consistencia con Drive.
    console.error('[Cadencia ↔ Drive] Doble colision tras pullAndMerge, releyendo Drive:', err);
    try {
      const freshRemote = await readFile(token, fileId);
      const freshMeta = await getFileMetadata(token, fileId);
      applyRemote(freshRemote);
      setSyncState({
        fileVersion: freshMeta.version,
        lastSyncAt: new Date().toISOString(),
      });
    } catch (innerErr) {
      console.error('[Cadencia ↔ Drive] Fallback tambien fallo, limpiando fileId:', innerErr);
      clearSyncFileCache();
      setSyncState({
        fileVersion: meta.version,
        lastSyncAt: new Date().toISOString(),
      });
    }
  }
}

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

/**
 * Aplica datos remotos al cadenciaStore. El flag _applyingRemote evita
 * que el evento 'cadencia-data-saved' que dispara saveCadenciaData
 * provoque un push automatico (ciclo infinito).
 *
 * Ademas del 'cadencia-data-saved' generico (que la UI reactiva ya escucha),
 * emite 'cadencia-data-applied-from-remote' con el blob entero. Esto permite
 * que estados aislados del cadenciaStore (useReducer/useState locales de
 * componentes de pagina como App.tsx) se rehidraten con los valores del pull
 * — sin esto, esos estados quedan congelados en el snapshot del montaje
 * inicial y la UI no refleja los datos descargados de Drive hasta refrescar.
 */
function applyRemote(data: SyncedData): void {
  _applyingRemote = true;
  try {
    console.warn(
      `[Cadencia ↔ Drive] APPLY-REMOTE: escribiendo en cadenciaStore. ` +
        `userInputs=${data.userInputs !== null ? 'sí' : 'no'}, ` +
        `musicPreferences=${data.musicPreferences !== null ? 'sí' : 'no'}, ` +
        `savedSessions=${data.savedSessions.length}, uploadedCsvs=${data.uploadedCsvs.length}, ` +
        `dismissedTracks=${data.dismissedTrackUris.length}, plannedEvents=${data.plannedEvents.length}.`,
    );
    saveCadenciaData(data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cadencia-data-applied-from-remote', { detail: { data } }),
      );
    }
  } finally {
    // Liberamos el flag tras un tick — listeners sincronos del evento se
    // habran ejecutado ya. Cualquier escritura posterior si dispara push.
    // El finally garantiza que el flag se libera aunque saveCadenciaData
    // lance excepcion (ej. localStorage lleno), evitando deadlock silencioso
    // donde todos los cambios locales posteriores dejan de sincronizarse.
    setTimeout(() => {
      _applyingRemote = false;
    }, 0);
  }
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
      markTokenExpired();
      return;
    }
    await push(token);
    _lastSyncAt = Date.now();
    markHealthy();
    notify('synced');
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      markTokenExpired();
    } else {
      console.warn('[gdrive sync] push error:', err);
      markError();
    }
  } finally {
    _syncing = false;
  }
}
