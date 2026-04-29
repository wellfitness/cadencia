import type { SyncedData } from './types';

const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Elimina tombstones (`deletedAt` mas antiguos que TOMBSTONE_MAX_AGE_MS)
 * del array savedSessions. Devuelve un nuevo objeto si hubo cambios, el
 * mismo si no.
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
  const filtered = data.savedSessions.filter((s) => {
    if (!s.deletedAt) return true;
    return new Date(s.deletedAt).getTime() > cutoff;
  });
  if (filtered.length === data.savedSessions.length) return data;
  return { ...data, savedSessions: filtered };
}
