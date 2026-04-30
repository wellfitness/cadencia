import type { SyncedData } from './types';

/**
 * Metrica simple: cuantas "unidades" de informacion tiene el blob.
 *
 * Se usa en pull/push para detectar regresiones. Caso tipico: el usuario
 * abre la app en un navegador nuevo (localStorage vacio) que se conecta
 * a Drive donde ya hay datos. Sin esta metrica, el push del local vacio
 * podria sobrescribir Drive. Comparando riqueza, detectamos que local
 * esta stale y aplicamos remote.
 */
export function calculateDataRichness(data: SyncedData): number {
  let score = 0;
  if (data.userInputs) {
    score += Object.values(data.userInputs).filter(
      (v) => v !== null && v !== undefined,
    ).length;
  }
  if (data.musicPreferences) {
    score += Object.keys(data.musicPreferences).length;
  }
  score += data.savedSessions.filter((s) => !s.deletedAt).length;
  score += data.uploadedCsvs.filter((c) => !c.deletedAt).length;
  if (data.nativeCatalogPrefs) {
    score += data.nativeCatalogPrefs.excludedUris.length;
  }
  score += data.dismissedTrackUris.length;
  score += data.plannedEvents.filter((e) => !e.deletedAt).length;
  return score;
}

export function isEmptyData(data: SyncedData): boolean {
  return calculateDataRichness(data) === 0;
}
