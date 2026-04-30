import { loadCadenciaData, updateSection } from '@ui/state/cadenciaStore';
import type { NativeCatalogPrefs } from '@core/sync/types';

/**
 * Gestion de la denylist del catalogo nativo (`src/data/tracks/all.csv`).
 *
 * Modelo denylist: persistimos solo las URIs excluidas (~50 maximo
 * tipico) en vez de las 800 incluidas. Esto reduce drasticamente el
 * tamano de los pushes a Drive y los conflictos en sync entre devices.
 *
 * Persistido como atomic LWW en cadenciaStore.
 */

export function getNativeCatalogPrefs(): NativeCatalogPrefs | null {
  return loadCadenciaData().nativeCatalogPrefs;
}

export function listExcludedUris(): readonly string[] {
  return loadCadenciaData().nativeCatalogPrefs?.excludedUris ?? [];
}

export function isExcluded(uri: string): boolean {
  return listExcludedUris().includes(uri);
}

export function setNativeCatalogPrefs(prefs: NativeCatalogPrefs): void {
  updateSection('nativeCatalogPrefs', prefs);
}

export function addExcludedUri(uri: string): void {
  const current = listExcludedUris();
  if (current.includes(uri)) return;
  updateSection('nativeCatalogPrefs', { excludedUris: [...current, uri] });
}

export function removeExcludedUri(uri: string): void {
  const current = listExcludedUris();
  if (!current.includes(uri)) return;
  updateSection('nativeCatalogPrefs', {
    excludedUris: current.filter((u) => u !== uri),
  });
}

export function clearNativeCatalogPrefs(): void {
  updateSection('nativeCatalogPrefs', null);
}
