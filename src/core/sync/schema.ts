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
 * Guard de estructura MINIMA para datos descargados o cargados desde almacenamiento.
 *
 * Politica tolerante (estilo Oraculo, que funciona en produccion): solo exigimos
 * que el blob tenga `updatedAt` (necesario para LWW) y `_sectionMeta` (objeto base
 * del modelo). No se exige `schemaVersion` exacto: blobs antiguos (schemaVersion
 * ausente o = 0) o futuros (schemaVersion > 1) pasan el guard y se normalizan.
 * `normalizeSyncedData` fuerza el schemaVersion al actual y rellena con defaults
 * cualquier campo faltante.
 *
 * Sin esta relajacion, una version anterior de Cadencia (sin schemaVersion = 1
 * estricto) o un blob escrito por una version posterior (schemaVersion = 2 tras
 * un bump) abortaba TODO el sync con DriveApiError 422. Ahora se aceptan y el
 * merge LWW se encarga del resto.
 *
 * Si este guard rechaza un blob, es porque la estructura es REALMENTE irreconocible
 * (no es un objeto, o le falta updatedAt o _sectionMeta): proteger el blob remoto
 * lanzando en lugar de aplicar un empty que sobreescribiria Drive via LWW.
 */
export function isSyncedData(value: unknown): value is SyncedData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['updatedAt'] === 'string' &&
    typeof v['_sectionMeta'] === 'object' &&
    v['_sectionMeta'] !== null
  );
}

/**
 * Rellena campos faltantes de un SyncedData con sus defaults. Se aplica tras
 * `isSyncedData` para hidratar blobs creados por versiones antiguas de Cadencia
 * que no traian los campos array nuevos. Preserva los datos existentes y el
 * `updatedAt` real del blob (critico: empty con updatedAt=1970 perderia LWW).
 *
 * Defensivo en runtime: aunque la firma sea `SyncedData`, blobs antiguos pueden
 * llegar sin `savedSessions` o con `_sectionMeta` undefined (ahora que isSyncedData
 * es mas laxo). Cada campo se valida explicitamente antes de aceptarse.
 *
 * Forward-compatible: cuando se añadan más campos al schema en el futuro,
 * añadirlos aqui con su default y los blobs viejos seguiran cargandose.
 */
export function normalizeSyncedData(data: SyncedData): SyncedData {
  const empty = emptySyncedData();
  // Cast a Partial para que TS deje validar runtime cada campo (la entrada
  // puede venir de un blob antiguo sin todos los campos del schema actual).
  const d = data as Partial<SyncedData>;
  return {
    ...empty,
    ...d,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : empty.updatedAt,
    _sectionMeta:
      typeof d._sectionMeta === 'object' && d._sectionMeta !== null
        ? { ...empty._sectionMeta, ...d._sectionMeta }
        : empty._sectionMeta,
    userInputs: d.userInputs ?? null,
    musicPreferences: d.musicPreferences ?? null,
    savedSessions: Array.isArray(d.savedSessions) ? d.savedSessions : [],
    uploadedCsvs: Array.isArray(d.uploadedCsvs) ? d.uploadedCsvs : [],
    nativeCatalogPrefs: d.nativeCatalogPrefs ?? null,
    dismissedTrackUris: Array.isArray(d.dismissedTrackUris)
      ? d.dismissedTrackUris
      : [],
    plannedEvents: Array.isArray(d.plannedEvents) ? d.plannedEvents : [],
    playlistHistory: Array.isArray(d.playlistHistory) ? d.playlistHistory : [],
    tvModePrefs: d.tvModePrefs ?? null,
  };
}
