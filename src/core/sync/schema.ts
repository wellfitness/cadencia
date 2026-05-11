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
 * Guard de estructura BASICA para datos descargados o cargados desde almacenamiento.
 *
 * Valida solo los campos del schema original (schemaVersion, updatedAt, _sectionMeta,
 * savedSessions). Los campos array añadidos en extensiones posteriores
 * (uploadedCsvs, dismissedTrackUris, plannedEvents, playlistHistory) NO se exigen
 * aqui — pueden faltar en blobs creados por versiones antiguas de Cadencia que
 * sincronizaron antes de la extension del schema. `normalizeSyncedData()` los
 * rellena con [] tras validacion para que el merge no crashee.
 *
 * Si este guard rechaza un blob, es porque la estructura es realmente irreconocible
 * (no es un SyncedData en absoluto): proteger el blob remoto lanzando en lugar
 * de aplicar un empty que sobreescribiria Drive via LWW.
 */
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

/**
 * Rellena campos faltantes de un SyncedData con sus defaults. Se aplica tras
 * `isSyncedData` para hidratar blobs creados por versiones antiguas de Cadencia
 * que no traian los campos array nuevos. Preserva los datos existentes y el
 * `updatedAt` real del blob (critico: empty con updatedAt=1970 perderia LWW).
 *
 * Forward-compatible: cuando se añadan más campos al schema en el futuro,
 * añadirlos aqui con su default y los blobs viejos seguiran cargandose.
 */
export function normalizeSyncedData(data: SyncedData): SyncedData {
  const empty = emptySyncedData();
  return {
    ...empty,
    ...data,
    _sectionMeta: { ...empty._sectionMeta, ...data._sectionMeta },
    uploadedCsvs: Array.isArray(data.uploadedCsvs) ? data.uploadedCsvs : [],
    nativeCatalogPrefs: data.nativeCatalogPrefs ?? null,
    dismissedTrackUris: Array.isArray(data.dismissedTrackUris)
      ? data.dismissedTrackUris
      : [],
    plannedEvents: Array.isArray(data.plannedEvents) ? data.plannedEvents : [],
    playlistHistory: Array.isArray(data.playlistHistory) ? data.playlistHistory : [],
    tvModePrefs: data.tvModePrefs ?? null,
  };
}
