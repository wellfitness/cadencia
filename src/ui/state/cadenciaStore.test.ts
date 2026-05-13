import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadCadenciaData,
  saveCadenciaData,
  clearCadenciaData,
  updateSection,
} from './cadenciaStore';
import { isEmptyData } from '@core/sync/richness';
import { EMPTY_USER_INPUTS } from '@core/user/userInputs';
import { EMPTY_PREFERENCES } from '@core/matching';

describe('cadenciaStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadCadenciaData devuelve empty si no hay nada', () => {
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });

  it('saveCadenciaData persiste en localStorage', () => {
    const data = loadCadenciaData();
    data.userInputs = { ...EMPTY_USER_INPUTS, weightKg: 70 };
    data._sectionMeta.userInputs = { updatedAt: '2026-04-29T10:00:00Z' };
    saveCadenciaData(data);
    const reloaded = loadCadenciaData();
    expect(reloaded.userInputs?.weightKg).toBe(70);
  });

  it('updateSection bumpea _sectionMeta.updatedAt', () => {
    const before = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    expect(before).toBeUndefined();
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 70 });
    const after = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    expect(after).toBeTruthy();
  });

  it('updateSection dispara evento cadencia-data-saved', () => {
    const handler = vi.fn();
    window.addEventListener('cadencia-data-saved', handler);
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 70 });
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('cadencia-data-saved', handler);
  });

  it('updateSection acepta musicPreferences', () => {
    updateSection('musicPreferences', EMPTY_PREFERENCES);
    expect(loadCadenciaData().musicPreferences).toEqual(EMPTY_PREFERENCES);
  });

  it('clearCadenciaData borra localStorage', () => {
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 70 });
    clearCadenciaData();
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });

  it('loadCadenciaData ignora JSON corrupto', () => {
    localStorage.setItem('cadencia:data:v1', '{not json');
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });

  it('loadCadenciaData ignora schema desconocido', () => {
    localStorage.setItem('cadencia:data:v1', JSON.stringify({ schemaVersion: 999 }));
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });

  it('updateSection es idempotente: no toca timestamp ni dispara evento si el valor no cambia', () => {
    // Anti-bucle de sync: tras un pull desde Drive, el useEffect de persistencia
    // en App.tsx llama updateSection con los mismos datos que acaban de aplicarse.
    // Si bumpease el timestamp, dispararia un push de vuelta con los datos
    // identicos — y si el otro dispositivo esta conectado, replicaria el ciclo.
    const value = { ...EMPTY_USER_INPUTS, weightKg: 70 };
    updateSection('userInputs', value);
    const firstTimestamp = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    expect(firstTimestamp).toBeTruthy();

    const handler = vi.fn();
    window.addEventListener('cadencia-data-saved', handler);
    // Llamada redundante con el mismo valor (otra referencia, mismo contenido).
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 70 });
    expect(handler).not.toHaveBeenCalled();
    const secondTimestamp = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    expect(secondTimestamp).toBe(firstTimestamp);
    window.removeEventListener('cadencia-data-saved', handler);
  });

  it('updateSection sí escribe cuando el valor cambia', () => {
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 70 });
    const handler = vi.fn();
    window.addEventListener('cadencia-data-saved', handler);
    updateSection('userInputs', { ...EMPTY_USER_INPUTS, weightKg: 72 });
    // La senal de cambio real es el evento: si los datos cambiaron,
    // saveCadenciaData se llama y dispara `cadencia-data-saved`. El sync
    // de Drive escucha eso para hacer push. No verificamos timestamps
    // porque dos new Date().toISOString() consecutivos pueden ser
    // iguales en hardware rapido (precision ms).
    expect(handler).toHaveBeenCalledOnce();
    expect(loadCadenciaData().userInputs?.weightKg).toBe(72);
    window.removeEventListener('cadencia-data-saved', handler);
  });
});
