import { useEffect, useMemo, useState } from 'react';
import { emptySyncedData, isSyncedData } from '@core/sync/schema';
import type { PlaylistHistoryEntry, SyncedData } from '@core/sync/types';

const STORAGE_KEY = 'cadencia:data:v1';

/**
 * Single source of truth de los datos persistentes del usuario en
 * localStorage.
 *
 * Estos datos sobreviven al cierre de pestana y, si el usuario activa la
 * sincronizacion con Google Drive (opt-in en Ajustes), se sincronizan
 * entre dispositivos. La sincronizacion NO es requisito: la app funciona
 * identica solo con localStorage.
 *
 * El motor de sync (`@integrations/gdrive/sync`) escucha el evento
 * `cadencia-data-saved` que se dispara al final de updateSection /
 * saveCadenciaData / clearCadenciaData. El evento permite reaccionar a
 * cambios sin acoplar la UI con el modulo de Drive.
 */

/**
 * Normaliza datos persistidos hidratando campos que puedan faltar en
 * blobs antiguos (anteriores a una extension del schema). Mantiene el
 * principio backwards-compatible: cualquier blob valido en el pasado
 * sigue siendo cargable, simplemente con los campos nuevos a su valor
 * por defecto.
 */
function normalize(data: SyncedData): SyncedData {
  const empty = emptySyncedData();
  return {
    ...empty,
    ...data,
    _sectionMeta: { ...empty._sectionMeta, ...data._sectionMeta },
    // Defaults para campos anadidos en extensiones posteriores al schema
    // original. La validacion isSyncedData no comprueba estos campos
    // (back-compat), asi que aqui los rellenamos.
    uploadedCsvs: data.uploadedCsvs ?? [],
    nativeCatalogPrefs: data.nativeCatalogPrefs ?? null,
    dismissedTrackUris: data.dismissedTrackUris ?? [],
    plannedEvents: data.plannedEvents ?? [],
    playlistHistory: data.playlistHistory ?? [],
  };
}

export function loadCadenciaData(): SyncedData {
  try {
    if (typeof localStorage === 'undefined') return emptySyncedData();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptySyncedData();
    const parsed: unknown = JSON.parse(raw);
    if (!isSyncedData(parsed)) return emptySyncedData();
    return normalize(parsed);
  } catch {
    // JSON corrupto o storage deshabilitado: arrancamos con empty.
    return emptySyncedData();
  }
}

export function saveCadenciaData(data: SyncedData): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('cadencia-data-saved', { detail: { data } }));
  } catch {
    // Cuota excedida o modo privado: no rompe la app, solo se pierde la
    // persistencia en este intento. El proximo save lo intentara de nuevo.
  }
}

export function clearCadenciaData(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent('cadencia-data-saved', { detail: { data: emptySyncedData() } }),
    );
  } catch {
    // ignore
  }
}

type AtomicSectionKey =
  | 'userInputs'
  | 'musicPreferences'
  | 'nativeCatalogPrefs'
  | 'dismissedTrackUris';

/**
 * Actualiza una seccion atomica del store, bumpeando su `_sectionMeta.updatedAt`
 * a `now()`. Esto es la senal que `mergeData` usa para LWW: el lado con
 * timestamp mayor gana.
 */
export function updateSection<K extends AtomicSectionKey>(
  section: K,
  value: SyncedData[K],
): void {
  const data = loadCadenciaData();
  const now = new Date().toISOString();
  data[section] = value;
  data._sectionMeta[section] = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}

/**
 * Hook React que se suscribe al evento `cadencia-data-saved` y devuelve
 * el SyncedData actual, re-renderizando el componente cuando el store
 * cambia (sea por una accion local o por un pull desde Drive).
 *
 * Util para que el livePool de App.tsx, MyPreferencesPage o cualquier UI
 * dependiente de los datos sincronizados se mantenga reactivo sin tener
 * que escuchar el evento manualmente en cada sitio.
 */
export function useCadenciaData(): SyncedData {
  const [data, setData] = useState<SyncedData>(() => loadCadenciaData());
  useEffect(() => {
    const handler = (): void => setData(loadCadenciaData());
    window.addEventListener('cadencia-data-saved', handler);
    return () => window.removeEventListener('cadencia-data-saved', handler);
  }, []);
  return data;
}

/**
 * Hook reactivo que devuelve las entradas vivas del historial de playlists,
 * mas reciente primero. Memoiza por `_sectionMeta.playlistHistory.updatedAt`
 * para evitar re-renders cuando cambian otras secciones (ej. el usuario
 * modifica userInputs y eso disparaba un re-compute innecesario de la
 * pestana de Estadisticas).
 */
export function usePlaylistHistory(): readonly PlaylistHistoryEntry[] {
  const data = useCadenciaData();
  const sectionTimestamp = data._sectionMeta.playlistHistory?.updatedAt ?? '';
  return useMemo(() => {
    return data.playlistHistory
      .filter((h) => !h.deletedAt)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // sectionTimestamp es la senal de invalidacion: cuando cambia, el
    // useMemo recomputa. data.playlistHistory cambia en cada saveCadenciaData
    // pero la mayoria son no-ops para esta seccion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTimestamp]);
}
