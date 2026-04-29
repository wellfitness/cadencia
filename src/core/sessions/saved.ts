import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import type { SavedSession } from '@core/sync/types';
import type { EditableSessionPlan } from '@core/segmentation';

/**
 * CRUD de sesiones indoor guardadas por el usuario para reusarlas. A
 * diferencia de las plantillas built-in (`SessionTemplate`), estas viven
 * en cadenciaStore (localStorage + sync Drive opcional) y son editables.
 *
 * Los borrados son LOGICOS (tombstones con `deletedAt`): el item sigue
 * en el array hasta que el cleanup automatico de tombstones lo purga
 * tras 30 dias. Esto permite que el delete se propague correctamente
 * via Drive sync a otros dispositivos antes de desaparecer.
 */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback no criptografico para entornos jsdom muy antiguos. Nunca
  // deberia entrar aqui en produccion (Chrome/Safari/Firefox modernos
  // tienen crypto.randomUUID).
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface CreateInput {
  name: string;
  description?: string;
  plan: EditableSessionPlan;
}

export function createSavedSession(input: CreateInput): SavedSession {
  const now = new Date().toISOString();
  const session: SavedSession = {
    id: uuid(),
    name: input.name,
    plan: input.plan,
    createdAt: now,
    updatedAt: now,
  };
  if (input.description !== undefined) {
    session.description = input.description;
  }

  const data = loadCadenciaData();
  data.savedSessions = [...data.savedSessions, session];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return session;
}

/** Devuelve las sesiones vivas del usuario, mas reciente primero. */
export function listSavedSessions(): SavedSession[] {
  return loadCadenciaData()
    .savedSessions.filter((s) => !s.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedSession(id: string): SavedSession | null {
  const found = loadCadenciaData().savedSessions.find((s) => s.id === id);
  if (!found || found.deletedAt) return null;
  return found;
}

interface UpdateInput {
  name?: string;
  description?: string;
  plan?: EditableSessionPlan;
}

/**
 * Mutacion parcial. Si el id no existe (o esta tombstoneado) devuelve null.
 * El bump de updatedAt es lo que hace que el merge gane sobre versiones
 * antiguas en otros dispositivos.
 */
export function updateSavedSession(id: string, patch: UpdateInput): SavedSession | null {
  const data = loadCadenciaData();
  const idx = data.savedSessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const current = data.savedSessions[idx]!;
  if (current.deletedAt) return null;

  const now = new Date().toISOString();
  const updated: SavedSession = {
    ...current,
    ...patch,
    updatedAt: now,
  };
  data.savedSessions = [
    ...data.savedSessions.slice(0, idx),
    updated,
    ...data.savedSessions.slice(idx + 1),
  ];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

/**
 * Borrado logico: marca `deletedAt`. El item sigue en el array hasta el
 * proximo cleanup. Esto permite que el delete viaje via Drive sync a
 * otros dispositivos antes de desaparecer.
 */
export function deleteSavedSession(id: string): void {
  const data = loadCadenciaData();
  const idx = data.savedSessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  const tombstone: SavedSession = {
    ...data.savedSessions[idx]!,
    deletedAt: now,
    updatedAt: now,
  };
  data.savedSessions = [
    ...data.savedSessions.slice(0, idx),
    tombstone,
    ...data.savedSessions.slice(idx + 1),
  ];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}
