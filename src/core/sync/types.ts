import type { UserInputsRaw } from '../user/userInputs';
import type { MatchPreferences } from '../matching';
import type { EditableSessionPlan } from '../segmentation';

export const SCHEMA_VERSION = 1;

export interface SectionMeta {
  /** ISO timestamp de la ultima modificacion de esta seccion. */
  updatedAt: string;
}

/**
 * Sesion indoor guardada por el usuario para reusarla. Distinta de las
 * plantillas built-in (`SessionTemplate`): aquellas son inmutables,
 * estas viven solo en el almacenamiento del usuario.
 */
export interface SavedSession {
  /** UUID v4. Estable a lo largo del ciclo de vida del item. */
  id: string;
  name: string;
  description?: string;
  plan: EditableSessionPlan;
  createdAt: string;
  updatedAt: string;
  /**
   * ISO timestamp de borrado logico. Cuando esta presente, el item es un
   * tombstone: la UI lo oculta pero el merge sigue propagandolo a otros
   * dispositivos hasta que expire (30 dias -> cleanup automatico).
   */
  deletedAt?: string;
}

/**
 * CSV de musica subido por el usuario, persistido y sincronizado.
 *
 * Guardamos el TEXTO crudo del CSV (re-parseable con `parseTrackCsv` en
 * cada device) en vez de la lista de tracks parseados. Razones:
 *  - Tamano manejable: un CSV de Exportify pesa 50-300 KB.
 *  - Source of truth honesta: los datos de tempo/energy/valence quedan
 *    fijados al momento de subir el CSV, ajenos a cambios futuros que
 *    Spotify haga en su catalogo.
 *  - Re-parseo determinista: parseTrackCsv aplica los mismos filtros y
 *    normalizaciones en cualquier device.
 */
export interface UploadedCsvRecord {
  /** UUID v4. Estable. */
  id: string;
  /** Nombre original del archivo cuando el usuario lo subio. */
  name: string;
  /** Texto crudo del CSV. Re-parseable con parseTrackCsv. */
  csvText: string;
  /** Cuantas filas validas parseo el ultimo parse (cache informativa). */
  trackCount: number;
  createdAt: string;
  updatedAt: string;
  /** Tombstone para borrado logico (mismo patron que SavedSession). */
  deletedAt?: string;
}

/**
 * Preferencias del editor de catalogo sobre el catalogo nativo bundled.
 *
 * Modelo denylist: guardamos solo las URIs que el usuario ha excluido
 * (tipicamente <50). Mucho mas compacto que persistir 800 incluidas, y
 * los deltas en sync son pequenos.
 */
export interface NativeCatalogPrefs {
  /** URIs del catalogo nativo (all.csv) que el usuario ha desmarcado. */
  excludedUris: string[];
}

/**
 * El blob completo que se persiste en localStorage y se sincroniza con
 * Drive. Cada seccion tiene su propio meta para LWW granular.
 */
export interface SyncedData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** ISO timestamp del documento entero (max de los _sectionMeta). */
  updatedAt: string;
  _sectionMeta: {
    userInputs?: SectionMeta;
    musicPreferences?: SectionMeta;
    savedSessions?: SectionMeta;
    uploadedCsvs?: SectionMeta;
    nativeCatalogPrefs?: SectionMeta;
    dismissedTrackUris?: SectionMeta;
  };
  userInputs: UserInputsRaw | null;
  musicPreferences: MatchPreferences | null;
  savedSessions: SavedSession[];
  /** Listas de musica subidas por el usuario, persistentes y sincronizadas. */
  uploadedCsvs: UploadedCsvRecord[];
  /** Preferencias sobre el catalogo nativo (denylist). */
  nativeCatalogPrefs: NativeCatalogPrefs | null;
  /**
   * URIs de canciones descartadas globalmente desde ResultStep ("A pedalear").
   * Se filtran del livePool antes del matching, independientemente de la fuente.
   */
  dismissedTrackUris: string[];
}

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'token_expired'
  | 'error';
