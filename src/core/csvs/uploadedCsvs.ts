import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import { parseTrackCsv, serializeTracksToCsv, type Track } from '@core/tracks';
import type { UploadedCsvRecord } from '@core/sync/types';

/**
 * CRUD de listas CSV propias subidas por el usuario.
 *
 * A diferencia de los CSVs efimeros (App state pre-Fase E), estas listas
 * viven en cadenciaStore: sobreviven al refresh y, si el usuario tiene
 * Drive conectado, se sincronizan entre dispositivos.
 *
 * Borrado logico via tombstones (mismo patron que SavedSession): el
 * `deletedAt` se propaga via sync antes de que `cleanExpiredTombstones`
 * lo purgue tras 30 dias.
 */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface CreateInput {
  name: string;
  csvText: string;
}

/**
 * Cuenta tracks validos del CSV mediante un parse rapido. Si el CSV es
 * invalido (sin filas validas), devolvemos 0 — el record igual se
 * guarda; el usuario puede borrarlo desde el editor.
 */
function countTracks(csvText: string): number {
  try {
    return parseTrackCsv(csvText, 'user').length;
  } catch {
    return 0;
  }
}

export function createUploadedCsv(input: CreateInput): UploadedCsvRecord {
  const now = new Date().toISOString();
  const record: UploadedCsvRecord = {
    id: uuid(),
    name: input.name,
    csvText: input.csvText,
    trackCount: countTracks(input.csvText),
    createdAt: now,
    updatedAt: now,
  };

  const data = loadCadenciaData();
  data.uploadedCsvs = [...data.uploadedCsvs, record];
  data._sectionMeta.uploadedCsvs = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return record;
}

/** Devuelve los CSVs vivos del usuario, mas reciente primero. */
export function listUploadedCsvs(): UploadedCsvRecord[] {
  return loadCadenciaData()
    .uploadedCsvs.filter((c) => !c.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getUploadedCsv(id: string): UploadedCsvRecord | null {
  const found = loadCadenciaData().uploadedCsvs.find((c) => c.id === id);
  if (!found || found.deletedAt) return null;
  return found;
}

interface UpdateInput {
  name?: string;
  csvText?: string;
}

export function updateUploadedCsv(
  id: string,
  patch: UpdateInput,
): UploadedCsvRecord | null {
  const data = loadCadenciaData();
  const idx = data.uploadedCsvs.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const current = data.uploadedCsvs[idx]!;
  if (current.deletedAt) return null;

  const now = new Date().toISOString();
  const updated: UploadedCsvRecord = {
    ...current,
    ...patch,
    updatedAt: now,
  };
  if (patch.csvText !== undefined) {
    updated.trackCount = countTracks(patch.csvText);
  }
  data.uploadedCsvs = [
    ...data.uploadedCsvs.slice(0, idx),
    updated,
    ...data.uploadedCsvs.slice(idx + 1),
  ];
  data._sectionMeta.uploadedCsvs = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

export interface RemovedTrack {
  /** csvText anterior, para deshacer restaurando la lista completa. */
  prevCsvText: string;
  /** Nombre de la cancion quitada (para el aviso de deshacer). */
  removedName: string;
}

/**
 * Quita la cancion en la posicion `trackIndex` (orden de parseo) de la lista
 * `id`, reescribiendo su CSV. A diferencia del descarte global por URI, opera
 * **por copia**: si la misma cancion esta repetida dentro de la lista o existe
 * en otras listas, las demas copias se conservan — asi el usuario puede quitar
 * duplicados dejando al menos una.
 *
 * Devuelve el csvText previo (para deshacer, restaurandolo tal cual) y el
 * nombre quitado, o null si la lista no existe, su CSV no parsea, o el indice
 * esta fuera de rango.
 *
 * Nota: reescribe el CSV en el formato canonico de `serializeTracksToCsv` (solo
 * las columnas que el motor usa); las columnas no modeladas del export original
 * no se preservan, lo cual es irrelevante para el uso en la app.
 */
export function removeTrackFromUploadedCsv(
  id: string,
  trackIndex: number,
): RemovedTrack | null {
  const record = getUploadedCsv(id);
  if (record === null) return null;
  let tracks: Track[];
  try {
    tracks = parseTrackCsv(record.csvText, 'user');
  } catch {
    return null;
  }
  const removed = tracks[trackIndex];
  if (removed === undefined) return null; // indice fuera de rango (o negativo)
  const prevCsvText = record.csvText;
  const next = tracks.filter((_, i) => i !== trackIndex);
  updateUploadedCsv(id, { csvText: serializeTracksToCsv(next) });
  return { prevCsvText, removedName: removed.name };
}

/** Borrado logico (tombstone). El item viaja via sync antes de purgarse. */
export function deleteUploadedCsv(id: string): void {
  const data = loadCadenciaData();
  const idx = data.uploadedCsvs.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  const tombstone: UploadedCsvRecord = {
    ...data.uploadedCsvs[idx]!,
    deletedAt: now,
    updatedAt: now,
  };
  data.uploadedCsvs = [
    ...data.uploadedCsvs.slice(0, idx),
    tombstone,
    ...data.uploadedCsvs.slice(idx + 1),
  ];
  data._sectionMeta.uploadedCsvs = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}
