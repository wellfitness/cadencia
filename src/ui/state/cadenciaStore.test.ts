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
});
