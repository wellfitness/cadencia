import type {
  PlannedEvent,
  PlaylistHistoryEntry,
  SavedSession,
  SyncedData,
  UploadedCsvRecord,
} from './types';
import { emptySyncedData } from './schema';

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
 */
function deepEqual(a: unknown, b: unknown): boolean {
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
  return new Date(meta.updatedAt).getTime();
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
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
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
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
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
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
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
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
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
