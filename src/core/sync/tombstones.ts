import type { SyncedData } from './types';

const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Elimina tombstones (`deletedAt` mas antiguos que TOMBSTONE_MAX_AGE_MS)
 * del array savedSessions y uploadedCsvs. Devuelve un nuevo objeto si
 * hubo cambios, el mismo si no.
 *
 * 30 dias es el plazo razonable para que cualquier dispositivo que el
 * usuario use ocasionalmente tenga oportunidad de recibir el tombstone
 * via sync antes de que desaparezca. Si un dispositivo lleva mas de 30
 * dias sin abrir, al sincronizar volvera a propagar items ya borrados,
 * pero ese caso extremo no compensa mantener tombstones eternos.
 */
export function cleanExpiredTombstones(
  data: SyncedData,
  now: number = Date.now(),
): SyncedData {
  const cutoff = now - TOMBSTONE_MAX_AGE_MS;
  const filteredSessions = data.savedSessions.filter((s) => {
    if (!s.deletedAt) return true;
    return new Date(s.deletedAt).getTime() > cutoff;
  });
  const filteredCsvs = data.uploadedCsvs.filter((c) => {
    if (!c.deletedAt) return true;
    return new Date(c.deletedAt).getTime() > cutoff;
  });
  const filteredEvents = data.plannedEvents.filter((e) => {
    if (!e.deletedAt) return true;
    return new Date(e.deletedAt).getTime() > cutoff;
  });
  const filteredHistory = data.playlistHistory.filter((h) => {
    if (!h.deletedAt) return true;
    return new Date(h.deletedAt).getTime() > cutoff;
  });
  const sessionsChanged = filteredSessions.length !== data.savedSessions.length;
  const csvsChanged = filteredCsvs.length !== data.uploadedCsvs.length;
  const eventsChanged = filteredEvents.length !== data.plannedEvents.length;
  const historyChanged = filteredHistory.length !== data.playlistHistory.length;
  if (!sessionsChanged && !csvsChanged && !eventsChanged && !historyChanged) return data;
  return {
    ...data,
    savedSessions: filteredSessions,
    uploadedCsvs: filteredCsvs,
    plannedEvents: filteredEvents,
    playlistHistory: filteredHistory,
  };
}
