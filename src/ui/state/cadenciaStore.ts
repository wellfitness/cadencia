import { emptySyncedData, isSyncedData } from '@core/sync/schema';
import type { SyncedData } from '@core/sync/types';

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
export function loadCadenciaData(): SyncedData {
  try {
    if (typeof localStorage === 'undefined') return emptySyncedData();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptySyncedData();
    const parsed: unknown = JSON.parse(raw);
    if (!isSyncedData(parsed)) return emptySyncedData();
    return parsed;
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

type AtomicSectionKey = 'userInputs' | 'musicPreferences';

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
