import { describe, it, expect, beforeEach } from 'vitest';
import {
  addDismissedUri,
  removeDismissedUri,
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
