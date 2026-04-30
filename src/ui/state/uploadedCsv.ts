import { parseTrackCsv, type Track } from '@core/tracks';
import type { UploadedCsvRecord } from '@core/sync/types';

/**
 * View-model en memoria de una lista CSV subida por el usuario.
 *
 * Desde la Fase E, la fuente de verdad persistente es
 * `UploadedCsvRecord` en cadenciaStore (csvText raw, sincronizable a
 * Drive). El hidrator `hydrateUploadedCsvs` parsea el csvText de cada
 * record en el array de `Track[]` que la UI necesita para componer el
 * livePool del wizard.
 *
 * `UploadedCsv` (este tipo) es solo memoria-app: los tracks parseados
 * pueden ocupar varios MB y no se persisten — se reconstruyen al cargar.
 */
export interface UploadedCsv {
  id: string;
  name: string;
  trackCount: number;
  tracks: readonly Track[];
  error?: string;
}

/**
 * Hidrata un array de records persistidos al view-model de runtime.
 * Filtra automaticamente tombstones. Si un csvText falla al parsear,
 * el record sigue en el array pero con `tracks: []` y `error` rellenado.
 */
export function hydrateUploadedCsvs(records: readonly UploadedCsvRecord[]): UploadedCsv[] {
  return records
    .filter((r) => !r.deletedAt)
    .map((r) => {
      try {
        const tracks = parseTrackCsv(r.csvText, 'user');
        return {
          id: r.id,
          name: r.name,
          trackCount: tracks.length,
          tracks,
        };
      } catch (err) {
        return {
          id: r.id,
          name: r.name,
          trackCount: 0,
          tracks: [],
          error: err instanceof Error ? err.message : 'Error al parsear CSV',
        };
      }
    });
}
