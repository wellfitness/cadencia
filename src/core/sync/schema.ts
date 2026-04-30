import { SCHEMA_VERSION, type SyncedData } from './types';

export function emptySyncedData(): SyncedData {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    _sectionMeta: {},
    userInputs: null,
    musicPreferences: null,
    savedSessions: [],
    uploadedCsvs: [],
    nativeCatalogPrefs: null,
    dismissedTrackUris: [],
  };
}

export function isSyncedData(value: unknown): value is SyncedData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schemaVersion'] === SCHEMA_VERSION &&
    typeof v['updatedAt'] === 'string' &&
    typeof v['_sectionMeta'] === 'object' &&
    v['_sectionMeta'] !== null &&
    Array.isArray(v['savedSessions'])
  );
}
