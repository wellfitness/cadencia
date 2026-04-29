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
  };
  userInputs: UserInputsRaw | null;
  musicPreferences: MatchPreferences | null;
  savedSessions: SavedSession[];
}

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'token_expired'
  | 'error';
