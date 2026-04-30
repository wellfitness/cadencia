import { loadCadenciaData } from '@ui/state/cadenciaStore';
import { updateSection } from '@ui/state/cadenciaStore';

/**
 * Gestion del set global de URIs descartadas por el usuario desde
 * ResultStep ("A pedalear"). El livePool del wizard filtra estas URIs
 * antes del matching, asi una cancion descartada no vuelve a aparecer
 * en futuras playlists hasta que el usuario la recupere.
 *
 * Persistido en cadenciaStore (atomic LWW), se sincroniza con Drive si
 * el usuario tiene la conexion activa.
 */

export function listDismissed(): readonly string[] {
  return loadCadenciaData().dismissedTrackUris;
}

export function isDismissed(uri: string): boolean {
  return loadCadenciaData().dismissedTrackUris.includes(uri);
}

export function addDismissedUri(uri: string): void {
  const current = loadCadenciaData().dismissedTrackUris;
  if (current.includes(uri)) return; // idempotente
  updateSection('dismissedTrackUris', [...current, uri]);
}

export function removeDismissedUri(uri: string): void {
  const current = loadCadenciaData().dismissedTrackUris;
  if (!current.includes(uri)) return; // idempotente
  updateSection(
    'dismissedTrackUris',
    current.filter((u) => u !== uri),
  );
}

export function clearAllDismissed(): void {
  updateSection('dismissedTrackUris', []);
}
