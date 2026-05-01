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
    plannedEvents: [],
    playlistHistory: [],
    tvModePrefs: null,
  };
}

/**
 * Guard estricto para datos descargados (Drive) o cargados desde almacenamiento.
 *
 * Antes solo verificaba schemaVersion, updatedAt, _sectionMeta y savedSessions.
 * Si el blob tenia `uploadedCsvs: null` o `dismissedTrackUris: undefined`, el
 * guard pasaba y el merge crasheaba con `Cannot read properties of null`. Ahora
 * exige que TODOS los arrays sean Array.isArray.
 */
export function isSyncedData(value: unknown): value is SyncedData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schemaVersion'] === SCHEMA_VERSION &&
    typeof v['updatedAt'] === 'string' &&
    typeof v['_sectionMeta'] === 'object' &&
    v['_sectionMeta'] !== null &&
    Array.isArray(v['savedSessions']) &&
    Array.isArray(v['uploadedCsvs']) &&
    Array.isArray(v['dismissedTrackUris']) &&
    Array.isArray(v['plannedEvents'])
    // playlistHistory NO se valida aqui (back-compat con blobs antiguos
    // que no la traen). normalize() en cadenciaStore la rellena con [].
  );
}
