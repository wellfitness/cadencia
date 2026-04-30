import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNativeCatalogPrefs,
  listExcludedUris,
  isExcluded,
  setNativeCatalogPrefs,
  addExcludedUri,
  removeExcludedUri,
  clearNativeCatalogPrefs,
} from './nativeCatalogPrefs';
import { clearCadenciaData } from '@ui/state/cadenciaStore';

describe('nativeCatalogPrefs CRUD', () => {
  beforeEach(() => clearCadenciaData());

  it('null por defecto', () => {
    expect(getNativeCatalogPrefs()).toBeNull();
    expect(listExcludedUris()).toEqual([]);
    expect(isExcluded('spotify:track:foo')).toBe(false);
  });

  it('setNativeCatalogPrefs reemplaza el bloque entero', () => {
    setNativeCatalogPrefs({ excludedUris: ['spotify:track:a', 'spotify:track:b'] });
    expect(listExcludedUris()).toEqual(['spotify:track:a', 'spotify:track:b']);
  });

  it('addExcludedUri es idempotente', () => {
    addExcludedUri('spotify:track:foo');
    addExcludedUri('spotify:track:foo');
    expect(listExcludedUris()).toEqual(['spotify:track:foo']);
  });

  it('removeExcludedUri quita una URI', () => {
    addExcludedUri('spotify:track:foo');
    addExcludedUri('spotify:track:bar');
    removeExcludedUri('spotify:track:foo');
    expect(listExcludedUris()).toEqual(['spotify:track:bar']);
  });

  it('removeExcludedUri es idempotente sobre URI no presente', () => {
    expect(() => removeExcludedUri('spotify:track:nada')).not.toThrow();
    expect(listExcludedUris()).toEqual([]);
  });

  it('clearNativeCatalogPrefs deja null', () => {
    addExcludedUri('spotify:track:foo');
    clearNativeCatalogPrefs();
    expect(getNativeCatalogPrefs()).toBeNull();
  });
});
