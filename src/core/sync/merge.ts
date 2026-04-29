import type { SyncedData } from './types';
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

const ATOMIC_SECTIONS = ['userInputs', 'musicPreferences'] as const;
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

  // Placeholder para Tarea 3 (array merge): por ahora wins remote completo.
  merged.savedSessions = remote.savedSessions;
  if (remote._sectionMeta.savedSessions) {
    merged._sectionMeta.savedSessions = remote._sectionMeta.savedSessions;
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
