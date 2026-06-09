import type {
  PlannedEvent,
  PlaylistHistoryEntry,
  SavedSession,
  SyncedData,
  UploadedCsvRecord,
} from './types';
import { emptySyncedData } from './schema';
import { hasUserInputData } from '../user/userInputs';
import { hasMusicPreferenceData } from '../matching/types';

/**
 * Convierte una cadena ISO a timestamp numérico. Devuelve -Infinity si la
 * cadena es inválida para que la lógica LWW la trate siempre como "más
 * antigua", evitando que un timestamp corrupto invierta silenciosamente
 * el resultado del merge.
 */
function safeTime(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * `Math.max` aceptable para arrays grandes. El spread `Math.max(...arr)` puede
 * dar stack overflow con cientos de miles de elementos y nunca es necesario
 * — reduce equivale y es estable. Asume `arr.length > 0`.
 */
function maxOf(arr: readonly number[]): number {
  let m = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v > m) m = v;
  }
  return m;
}

/**
 * Comparacion estructural recursiva. Sustituye al `JSON.stringify(a) !== JSON.stringify(b)`
 * que daba falsos positivos cuando dos blobs equivalentes tenian las claves
 * en distinto orden tras un round-trip por motores JS distintos.
 *
 * Exportado para que el cadenciaStore pueda usar la misma definicion al
 * hacer `updateSection` idempotente (no-op si el valor entrante es
 * estructuralmente igual al ya guardado), evitando bucles de sync donde
 * un pull desde Drive disparaba push de los mismos datos via el useEffect
 * de persistencia.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const keysA = Object.keys(a as Record<string, unknown>).sort();
  const keysB = Object.keys(b as Record<string, unknown>).sort();
  if (keysA.length !== keysB.length) return false;
  if (!keysA.every((k, i) => k === keysB[i])) return false;
  return keysA.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Conflicto registrado durante el merge: el lado perdedor tenia un valor
 * distinto al ganador y su timestamp era igual o menor. Se almacena para
 * que el usuario pueda revisar versiones descartadas si lo desea.
 */
export interface MergeConflict {
  section: string;
  loserValue: unknown;
  loserTimestamp: string;
  winnerTimestamp: string;
  resolvedAt: string;
}

export interface MergeResult {
  merged: SyncedData;
  conflicts: MergeConflict[];
}

const ATOMIC_SECTIONS = [
  'userInputs',
  'musicPreferences',
  'nativeCatalogPrefs',
  'dismissedTrackUris',
  'tvModePrefs',
] as const;
type AtomicSection = (typeof ATOMIC_SECTIONS)[number];

function getMetaTime(data: SyncedData, section: AtomicSection): number {
  const meta = data._sectionMeta[section];
  if (!meta) return -Infinity;
  return safeTime(meta.updatedAt);
}

/**
 * Secciones atomicas con proteccion anti-vacio. Para estas, un "objeto sin
 * contenido real" (todo-null / sin decision del usuario) NUNCA derrota por
 * LWW a un valor con datos, aunque su timestamp sea mas reciente.
 *
 * Razon: los objetos vacuos no los produce ninguna decision del usuario —
 * los fabrican montajes iniciales, StrictMode o versiones antiguas de la app
 * (una PWA cacheada puede seguir emitiendolos durante dias tras un deploy).
 * El borrado EXPLICITO viaja como `null` (handleForget / RESET confirmado)
 * y si respeta el LWW normal: un null mas reciente gana y se propaga.
 *
 * La regla es simetrica (depende del contenido, no del lado), asi que el
 * merge converge en ambas direcciones: el dispositivo que fabrico el vacuo
 * recibira los datos reales en su proximo pull.
 *
 * Cuando el borrado explicito (null) gana sobre datos reales, el valor
 * perdedor se registra en el conflict log como red de seguridad: si el
 * borrado fue un error, los datos siguen siendo recuperables desde
 * `cadencia:gdrive:conflicts`.
 */
function applyAntiVacuousRule<K extends 'userInputs' | 'musicPreferences'>(
  merged: SyncedData,
  local: SyncedData,
  remote: SyncedData,
  section: K,
  hasData: (value: NonNullable<SyncedData[K]>) => boolean,
  conflicts: MergeConflict[],
): void {
  const winnerIsLocal = getMetaTime(local, section) > getMetaTime(remote, section);
  const winner = merged[section];
  const loser = winnerIsLocal ? remote[section] : local[section];
  const loserMeta = winnerIsLocal
    ? remote._sectionMeta[section]
    : local._sectionMeta[section];
  const winnerMeta = merged._sectionMeta[section];

  if (loser === null || loser === undefined) return;
  if (!hasData(loser as NonNullable<SyncedData[K]>)) return;

  if (winner !== null && !hasData(winner as NonNullable<SyncedData[K]>)) {
    // Inversion: el vacuo "gano" el LWW pero pierde por contenido.
    merged[section] = loser as SyncedData[K] as never;
    if (loserMeta) merged._sectionMeta[section] = loserMeta;
    conflicts.push({
      section,
      loserValue: winner,
      loserTimestamp: winnerMeta?.updatedAt ?? new Date(0).toISOString(),
      winnerTimestamp: loserMeta?.updatedAt ?? new Date(0).toISOString(),
      resolvedAt: new Date().toISOString(),
    });
  } else if (winner === null) {
    // Borrado explicito legitimo: se respeta, pero los datos descartados
    // quedan en el conflict log para recuperacion manual.
    conflicts.push({
      section,
      loserValue: loser,
      loserTimestamp: loserMeta?.updatedAt ?? new Date(0).toISOString(),
      winnerTimestamp: winnerMeta?.updatedAt ?? new Date(0).toISOString(),
      resolvedAt: new Date().toISOString(),
    });
  }
}

/**
 * Combina dos `SyncedData` con estrategia LWW por seccion. En empate
 * exacto wins remote (idempotencia tras pull-merge-push) y se anota
 * conflicto si los valores difieren.
 */
export function mergeData(local: SyncedData, remote: SyncedData): MergeResult {
  const merged: SyncedData = emptySyncedData();
  const conflicts: MergeConflict[] = [];

  for (const section of ATOMIC_SECTIONS) {
    const localTime = getMetaTime(local, section);
    const remoteTime = getMetaTime(remote, section);

    if (localTime > remoteTime) {
      merged[section] = local[section] as never;
      if (local._sectionMeta[section]) {
        merged._sectionMeta[section] = local._sectionMeta[section];
      }
    } else {
      merged[section] = remote[section] as never;
      if (remote._sectionMeta[section]) {
        merged._sectionMeta[section] = remote._sectionMeta[section];
      }
      if (localTime === remoteTime && localTime !== -Infinity) {
        const lv = local[section];
        const rv = remote[section];
        if (!deepEqual(lv, rv)) {
          conflicts.push({
            section,
            loserValue: lv,
            loserTimestamp: local._sectionMeta[section]!.updatedAt,
            winnerTimestamp: remote._sectionMeta[section]!.updatedAt,
            resolvedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Proteccion por contenido sobre el resultado del LWW (ver doc de
  // applyAntiVacuousRule). Solo userInputs y musicPreferences: en el resto
  // de secciones atomicas el "vaciado" es una accion legitima del usuario
  // sin canal null separado (ej. limpiar canciones descartadas) y debe
  // propagarse tal cual.
  applyAntiVacuousRule(merged, local, remote, 'userInputs', hasUserInputData, conflicts);
  applyAntiVacuousRule(
    merged,
    local,
    remote,
    'musicPreferences',
    hasMusicPreferenceData,
    conflicts,
  );

  // Array merge por id, LWW por item. Tombstones (deletedAt) participan
  // como una version mas: gana la mas reciente. Una version sin deletedAt
  // mas nueva que un tombstone "resucita" el item.
  const sessionsById = new Map<string, SavedSession>();
  for (const item of local.savedSessions) sessionsById.set(item.id, item);
  for (const remoteItem of remote.savedSessions) {
    const localItem = sessionsById.get(remoteItem.id);
    if (!localItem) {
      sessionsById.set(remoteItem.id, remoteItem);
      continue;
    }
    const localTime = safeTime(localItem.updatedAt);
    const remoteTime = safeTime(remoteItem.updatedAt);
    sessionsById.set(remoteItem.id, remoteTime >= localTime ? remoteItem : localItem);
  }
  merged.savedSessions = Array.from(sessionsById.values());

  const sessionTimes = merged.savedSessions
    .map((s) => new Date(s.updatedAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (sessionTimes.length > 0) {
    merged._sectionMeta.savedSessions = {
      updatedAt: new Date(maxOf(sessionTimes)).toISOString(),
    };
  }

  // Mismo patron de array-merge para uploadedCsvs.
  const csvsById = new Map<string, UploadedCsvRecord>();
  for (const item of local.uploadedCsvs) csvsById.set(item.id, item);
  for (const remoteItem of remote.uploadedCsvs) {
    const localItem = csvsById.get(remoteItem.id);
    if (!localItem) {
      csvsById.set(remoteItem.id, remoteItem);
      continue;
    }
    const localTime = safeTime(localItem.updatedAt);
    const remoteTime = safeTime(remoteItem.updatedAt);
    csvsById.set(remoteItem.id, remoteTime >= localTime ? remoteItem : localItem);
  }
  merged.uploadedCsvs = Array.from(csvsById.values());

  const csvTimes = merged.uploadedCsvs
    .map((c) => new Date(c.updatedAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (csvTimes.length > 0) {
    merged._sectionMeta.uploadedCsvs = {
      updatedAt: new Date(maxOf(csvTimes)).toISOString(),
    };
  }

  // Mismo patron de array-merge para plannedEvents.
  const eventsById = new Map<string, PlannedEvent>();
  for (const item of local.plannedEvents) eventsById.set(item.id, item);
  for (const remoteItem of remote.plannedEvents) {
    const localItem = eventsById.get(remoteItem.id);
    if (!localItem) {
      eventsById.set(remoteItem.id, remoteItem);
      continue;
    }
    const localTime = safeTime(localItem.updatedAt);
    const remoteTime = safeTime(remoteItem.updatedAt);
    eventsById.set(remoteItem.id, remoteTime >= localTime ? remoteItem : localItem);
  }
  merged.plannedEvents = Array.from(eventsById.values());

  const eventTimes = merged.plannedEvents
    .map((e) => new Date(e.updatedAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (eventTimes.length > 0) {
    merged._sectionMeta.plannedEvents = {
      updatedAt: new Date(maxOf(eventTimes)).toISOString(),
    };
  }

  // Mismo patron de array-merge para playlistHistory.
  const historyById = new Map<string, PlaylistHistoryEntry>();
  for (const item of local.playlistHistory) historyById.set(item.id, item);
  for (const remoteItem of remote.playlistHistory) {
    const localItem = historyById.get(remoteItem.id);
    if (!localItem) {
      historyById.set(remoteItem.id, remoteItem);
      continue;
    }
    const localTime = safeTime(localItem.updatedAt);
    const remoteTime = safeTime(remoteItem.updatedAt);
    historyById.set(remoteItem.id, remoteTime >= localTime ? remoteItem : localItem);
  }
  merged.playlistHistory = Array.from(historyById.values());

  const historyTimes = merged.playlistHistory
    .map((h) => new Date(h.updatedAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (historyTimes.length > 0) {
    merged._sectionMeta.playlistHistory = {
      updatedAt: new Date(maxOf(historyTimes)).toISOString(),
    };
  }

  // updatedAt = max de los timestamps de seccion presentes
  const allTimes = Object.values(merged._sectionMeta)
    .filter((m): m is { updatedAt: string } => m !== undefined)
    .map((m) => new Date(m.updatedAt).getTime());
  merged.updatedAt = allTimes.length
    ? new Date(maxOf(allTimes)).toISOString()
    : new Date(0).toISOString();

  return { merged, conflicts };
}
