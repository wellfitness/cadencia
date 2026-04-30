import type { SyncedData } from './types';

/**
 * Metrica de "que tan rica es esta foto del estado del usuario", normalizada
 * por seccion para comparar entre dispositivos sin sesgos dimensionales.
 *
 * Se usa en pull/push para detectar regresiones. Caso tipico: el usuario
 * abre la app en un navegador nuevo (localStorage vacio) que se conecta a
 * Drive donde ya hay datos. Sin esta metrica, el push del local vacio
 * podria sobrescribir Drive. Comparando riqueza, detectamos que local esta
 * stale y aplicamos remote.
 *
 * Antes esto era una suma plana: 1 punto por cada campo no-null, 1 por cada
 * sesion guardada, 1 por cada URI descartada... Eso favorecia desproporcio-
 * nadamente listas largas. Un usuario con 50 dismissed-tracks y nada mas
 * tenia richness 50; otro con perfil completo + 1 sesion + 2 CSVs tenia 11.
 *
 * Ahora cada seccion contribuye 0..1 segun "cuan llena" esta, y sumamos:
 *   - userInputs: ratio campos rellenos / total (0..1).
 *   - musicPreferences: 1 si existe, 0 si null.
 *   - savedSessions, uploadedCsvs, plannedEvents: log normalizado — los
 *     primeros items aportan mucho, items adicionales aportan cada vez
 *     menos. Asi 50 vs 1 da ~1.7x, no 50x.
 *   - nativeCatalogPrefs y dismissedTrackUris: ratio similar log.
 *
 * El resultado en bruto es ~0..7 (suma de hasta 7 secciones aportando 1).
 */
function logRichness(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1, Math.log2(count + 1) / Math.log2(11));
}

const USER_INPUT_FIELDS = [
  'sport',
  'weightKg',
  'ftpWatts',
  'maxHeartRate',
  'restingHeartRate',
  'birthYear',
  'sex',
  'bikeWeightKg',
  'bikeType',
] as const;

export function calculateDataRichness(data: SyncedData): number {
  let score = 0;

  if (data.userInputs) {
    const filled = USER_INPUT_FIELDS.reduce((acc, key) => {
      const v = (data.userInputs as Record<string, unknown> | null)?.[key];
      return acc + (v !== null && v !== undefined ? 1 : 0);
    }, 0);
    score += filled / USER_INPUT_FIELDS.length;
  }

  if (data.musicPreferences) {
    score += 1;
  }

  score += logRichness(data.savedSessions.filter((s) => !s.deletedAt).length);
  score += logRichness(data.uploadedCsvs.filter((c) => !c.deletedAt).length);
  score += logRichness(data.plannedEvents.filter((e) => !e.deletedAt).length);

  if (data.nativeCatalogPrefs) {
    score += logRichness(data.nativeCatalogPrefs.excludedUris.length);
  }
  score += logRichness(data.dismissedTrackUris.length);

  return score;
}

/**
 * Tras el cambio de calculateDataRichness a contribuciones normalizadas, un
 * blob completamente vacio ya no es exactamente 0 (puntos flotantes), pero
 * sigue siendo despreciable. Comparamos con un epsilon en lugar de === 0.
 */
export function isEmptyData(data: SyncedData): boolean {
  return calculateDataRichness(data) < 1e-9;
}
