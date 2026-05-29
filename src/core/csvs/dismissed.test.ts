import { describe, it, expect, beforeEach } from 'vitest';
import {
  addDismissedUri,
  removeDismissedUri,
  addDismissedUris,
  removeDismissedUris,
  isDismissed,
  listDismissed,
  clearAllDismissed,
} from './dismissed';
import { clearCadenciaData } from '@ui/state/cadenciaStore';

describe('dismissedTrackUris CRUD', () => {
  beforeEach(() => clearCadenciaData());

  it('lista vacia por defecto', () => {
    expect(listDismissed()).toEqual([]);
    expect(isDismissed('spotify:track:foo')).toBe(false);
  });

  it('addDismissedUri persiste', () => {
    addDismissedUri('spotify:track:foo');
    expect(listDismissed()).toEqual(['spotify:track:foo']);
    expect(isDismissed('spotify:track:foo')).toBe(true);
  });

  it('addDismissedUri es idempotente', () => {
    addDismissedUri('spotify:track:foo');
    addDismissedUri('spotify:track:foo');
    addDismissedUri('spotify:track:foo');
    expect(listDismissed()).toEqual(['spotify:track:foo']);
  });

  it('removeDismissedUri quita la URI', () => {
    addDismissedUri('spotify:track:foo');
    addDismissedUri('spotify:track:bar');
    removeDismissedUri('spotify:track:foo');
    expect(listDismissed()).toEqual(['spotify:track:bar']);
  });

  it('removeDismissedUri es idempotente sobre URIs no presentes', () => {
    expect(() => removeDismissedUri('spotify:track:nada')).not.toThrow();
    expect(listDismissed()).toEqual([]);
  });

  it('clearAllDismissed vacia el set', () => {
    addDismissedUri('spotify:track:foo');
    addDismissedUri('spotify:track:bar');
    clearAllDismissed();
    expect(listDismissed()).toEqual([]);
  });
});

describe('dismissedTrackUris en lote (acciones masivas)', () => {
  beforeEach(() => clearCadenciaData());

  it('addDismissedUris añade varias y deduplica contra lo existente', () => {
    addDismissedUri('spotify:track:a');
    addDismissedUris(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']);
    expect(listDismissed()).toEqual([
      'spotify:track:a',
      'spotify:track:b',
      'spotify:track:c',
    ]);
  });

  it('addDismissedUris con lista vacia no cambia nada', () => {
    addDismissedUri('spotify:track:a');
    addDismissedUris([]);
    expect(listDismissed()).toEqual(['spotify:track:a']);
  });

  it('addDismissedUris no duplica URIs repetidas dentro del lote', () => {
    addDismissedUris(['spotify:track:a', 'spotify:track:a', 'spotify:track:b']);
    expect(listDismissed()).toEqual(['spotify:track:a', 'spotify:track:b']);
  });

  it('removeDismissedUris quita varias e ignora las ausentes', () => {
    addDismissedUris(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']);
    removeDismissedUris(['spotify:track:a', 'spotify:track:c', 'spotify:track:nope']);
    expect(listDismissed()).toEqual(['spotify:track:b']);
  });

  it('removeDismissedUris con lista vacia no cambia nada', () => {
    addDismissedUris(['spotify:track:a', 'spotify:track:b']);
    removeDismissedUris([]);
    expect(listDismissed()).toEqual(['spotify:track:a', 'spotify:track:b']);
  });
});
