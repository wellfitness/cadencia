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

/**
 * Descarta varias URIs en una sola escritura al store. Para acciones masivas
 * (p. ej. «descartar todas las visibles»): evita las N escrituras y N pushes
 * a Drive que supondría llamar a `addDismissedUri` en bucle. Deduplica contra
 * lo ya descartado y dentro del propio lote, y preserva el orden de inserción.
 */
export function addDismissedUris(uris: readonly string[]): void {
  const current = loadCadenciaData().dismissedTrackUris;
  const set = new Set(current);
  const next = [...current];
  let changed = false;
  for (const uri of uris) {
    if (!set.has(uri)) {
      set.add(uri);
      next.push(uri);
      changed = true;
    }
  }
  if (!changed) return; // idempotente: no escribimos si no hay cambios
  updateSection('dismissedTrackUris', next);
}

/**
 * Recupera varias URIs en una sola escritura. Ignora las que no estuvieran
 * descartadas. Complemento de `addDismissedUris` para «recuperar todas».
 */
export function removeDismissedUris(uris: readonly string[]): void {
  const current = loadCadenciaData().dismissedTrackUris;
  const toRemove = new Set(uris);
  const next = current.filter((u) => !toRemove.has(u));
  if (next.length === current.length) return; // nada que quitar
  updateSection('dismissedTrackUris', next);
}

export function clearAllDismissed(): void {
  updateSection('dismissedTrackUris', []);
}
