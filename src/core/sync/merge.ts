import type {
  PlannedEvent,
  SavedSession,
  SyncedData,
  UploadedCsvRecord,
} from './types';
import { emptySyncedData } from './schema';

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
        if (JSON.stringify(lv) !== JSON.stringify(rv)) {
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
      updatedAt: new Date(Math.max(...sessionTimes)).toISOString(),
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
      updatedAt: new Date(Math.max(...csvTimes)).toISOString(),
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
      updatedAt: new Date(Math.max(...eventTimes)).toISOString(),
    };
  }

  // updatedAt = max de los timestamps de seccion presentes
  const allTimes = Object.values(merged._sectionMeta)
    .filter((m): m is { updatedAt: string } => m !== undefined)
    .map((m) => new Date(m.updatedAt).getTime());
  merged.updatedAt = allTimes.length
    ? new Date(Math.max(...allTimes)).toISOString()
    : new Date(0).toISOString();

  return { merged, conflicts };
}
