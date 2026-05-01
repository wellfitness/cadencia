import { describe, it, expect } from 'vitest';
import { mergeData } from './merge';
import { emptySyncedData } from './schema';
import type {
  PlannedEvent,
  PlaylistHistoryEntry,
  SavedSession,
  SyncedData,
  UploadedCsvRecord,
} from './types';
import { EMPTY_USER_INPUTS } from '../user/userInputs';

function session(
  id: string,
  name: string,
  updatedAt: string,
  deletedAt?: string,
): SavedSession {
  const s: SavedSession = {
    id,
    name,
    plan: { name, items: [] },
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt,
  };
  if (deletedAt !== undefined) s.deletedAt = deletedAt;
  return s;
}

function csv(
  id: string,
  name: string,
  updatedAt: string,
  deletedAt?: string,
): UploadedCsvRecord {
  const c: UploadedCsvRecord = {
    id,
    name,
    csvText: 'Track URI,Name\nspotify:track:foo,Foo',
    trackCount: 1,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt,
  };
  if (deletedAt !== undefined) c.deletedAt = deletedAt;
  return c;
}

function userInputsAt(weightKg: number, ts: string): SyncedData {
  const d = emptySyncedData();
  d.userInputs = { ...EMPTY_USER_INPUTS, weightKg };
  d._sectionMeta.userInputs = { updatedAt: ts };
  d.updatedAt = ts;
  return d;
}

describe('mergeData — atomic LWW por seccion', () => {
  it('local mas reciente gana en userInputs', () => {
    const local = userInputsAt(70, '2026-04-29T10:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T09:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(70);
  });

  it('remote mas reciente gana en userInputs', () => {
    const local = userInputsAt(70, '2026-04-29T09:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
  });

  it('en empate exacto wins remote y registra conflicto', () => {
    const ts = '2026-04-29T10:00:00Z';
    const local = userInputsAt(70, ts);
    const remote = userInputsAt(65, ts);
    const { merged, conflicts } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.section).toBe('userInputs');
  });

  it('seccion sin meta en un lado wins el otro', () => {
    const local = emptySyncedData();
    const remote = userInputsAt(65, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(65);
  });

  it('updatedAt del merged es el max de los meta de secciones', () => {
    const local = userInputsAt(70, '2026-04-29T10:00:00Z');
    const remote = userInputsAt(65, '2026-04-29T11:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.updatedAt).toBe('2026-04-29T11:00:00.000Z');
  });
});

describe('mergeData — savedSessions array merge', () => {
  it('union: items presentes en cualquiera aparecen en merged', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    local._sectionMeta.savedSessions = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.savedSessions = [session('b', 'B', '2026-04-29T11:00:00Z')];
    remote._sectionMeta.savedSessions = { updatedAt: '2026-04-29T11:00:00Z' };

    const { merged } = mergeData(local, remote);
    const ids = merged.savedSessions.map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('item con mismo id: LWW por updatedAt del item', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A-local', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [session('a', 'A-remote', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.name).toBe('A-remote');
  });

  it('tombstone gana sobre version sin borrar si su timestamp es mayor', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [
      session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('item resucitado: version sin deletedAt mas reciente que tombstone gana', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T12:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [
      session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBeUndefined();
  });
});

describe('mergeData — uploadedCsvs array merge', () => {
  it('union: items presentes en cualquier lado aparecen en merged', () => {
    const local = emptySyncedData();
    local.uploadedCsvs = [csv('a', 'mi-rock.csv', '2026-04-29T10:00:00Z')];
    local._sectionMeta.uploadedCsvs = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.uploadedCsvs = [csv('b', 'mi-pop.csv', '2026-04-29T11:00:00Z')];
    remote._sectionMeta.uploadedCsvs = { updatedAt: '2026-04-29T11:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.uploadedCsvs.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('item con mismo id: LWW por updatedAt del item', () => {
    const local = emptySyncedData();
    local.uploadedCsvs = [csv('a', 'old-name.csv', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.uploadedCsvs = [csv('a', 'new-name.csv', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.uploadedCsvs[0]?.name).toBe('new-name.csv');
  });

  it('tombstone se propaga si tiene timestamp mayor', () => {
    const local = emptySyncedData();
    local.uploadedCsvs = [csv('a', 'foo.csv', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.uploadedCsvs = [
      csv('a', 'foo.csv', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.uploadedCsvs[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });
});

describe('mergeData — nativeCatalogPrefs atomic LWW', () => {
  it('local mas reciente gana', () => {
    const local = emptySyncedData();
    local.nativeCatalogPrefs = { excludedUris: ['spotify:track:1'] };
    local._sectionMeta.nativeCatalogPrefs = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.nativeCatalogPrefs = { excludedUris: ['spotify:track:2'] };
    remote._sectionMeta.nativeCatalogPrefs = { updatedAt: '2026-04-29T09:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.nativeCatalogPrefs?.excludedUris).toEqual(['spotify:track:1']);
  });

  it('remote mas reciente gana', () => {
    const local = emptySyncedData();
    local.nativeCatalogPrefs = { excludedUris: ['spotify:track:1'] };
    local._sectionMeta.nativeCatalogPrefs = { updatedAt: '2026-04-29T09:00:00Z' };
    const remote = emptySyncedData();
    remote.nativeCatalogPrefs = { excludedUris: ['spotify:track:2'] };
    remote._sectionMeta.nativeCatalogPrefs = { updatedAt: '2026-04-29T10:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.nativeCatalogPrefs?.excludedUris).toEqual(['spotify:track:2']);
  });
});

describe('mergeData — plannedEvents (array merge LWW por id)', () => {
  function event(
    id: string,
    date: string,
    updatedAt: string,
    deletedAt?: string,
  ): PlannedEvent {
    const e: PlannedEvent = {
      id,
      type: 'outdoor',
      date,
      name: `Evento ${id}`,
      recurrence: null,
      skippedDates: [],
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt,
    };
    if (deletedAt !== undefined) e.deletedAt = deletedAt;
    return e;
  }

  it('union cuando local y remote tienen eventos distintos', () => {
    const local = emptySyncedData();
    local.plannedEvents = [event('a', '2026-05-05', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.plannedEvents = [event('b', '2026-05-06', '2026-04-29T10:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.plannedEvents).toHaveLength(2);
    expect(merged.plannedEvents.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('mismo id: gana el de updatedAt mas reciente', () => {
    const local = emptySyncedData();
    local.plannedEvents = [event('a', '2026-05-05', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.plannedEvents = [event('a', '2026-05-09', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.plannedEvents).toHaveLength(1);
    expect(merged.plannedEvents[0]?.date).toBe('2026-05-09');
  });

  it('tombstone propaga a otros dispositivos', () => {
    const local = emptySyncedData();
    local.plannedEvents = [event('a', '2026-05-05', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.plannedEvents = [
      event('a', '2026-05-05', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.plannedEvents[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('actualiza _sectionMeta.plannedEvents al max de updatedAt', () => {
    const local = emptySyncedData();
    local.plannedEvents = [event('a', '2026-05-05', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.plannedEvents = [event('b', '2026-05-06', '2026-04-29T12:00:00Z')];
    const { merged } = mergeData(local, remote);
    // El motor reformatea timestamps con `.toISOString()` (incluye .000Z).
    expect(new Date(merged._sectionMeta.plannedEvents!.updatedAt).getTime()).toBe(
      new Date('2026-04-29T12:00:00Z').getTime(),
    );
  });
});

describe('mergeData — dismissedTrackUris atomic LWW', () => {
  it('local mas reciente gana sobre array completo', () => {
    const local = emptySyncedData();
    local.dismissedTrackUris = ['spotify:track:a', 'spotify:track:b'];
    local._sectionMeta.dismissedTrackUris = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.dismissedTrackUris = ['spotify:track:c'];
    remote._sectionMeta.dismissedTrackUris = { updatedAt: '2026-04-29T09:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.dismissedTrackUris).toEqual(['spotify:track:a', 'spotify:track:b']);
  });

  it('remote mas reciente gana sobre array completo', () => {
    const local = emptySyncedData();
    local.dismissedTrackUris = ['spotify:track:a'];
    local._sectionMeta.dismissedTrackUris = { updatedAt: '2026-04-29T09:00:00Z' };
    const remote = emptySyncedData();
    remote.dismissedTrackUris = ['spotify:track:b', 'spotify:track:c'];
    remote._sectionMeta.dismissedTrackUris = { updatedAt: '2026-04-29T10:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.dismissedTrackUris).toEqual(['spotify:track:b', 'spotify:track:c']);
  });
});

describe('mergeData — playlistHistory (array merge LWW por id)', () => {
  function historyEntry(
    id: string,
    updatedAt: string,
    deletedAt?: string,
  ): PlaylistHistoryEntry {
    const e: PlaylistHistoryEntry = {
      id,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt,
      sport: 'bike',
      mode: 'session',
      totalDurationSec: 60,
      zoneDurations: { 1: 0, 2: 60, 3: 0, 4: 0, 5: 0, 6: 0 },
      seed: 42,
      tracks: [],
    };
    if (deletedAt !== undefined) e.deletedAt = deletedAt;
    return e;
  }

  it('union cuando local y remote tienen entradas distintas', () => {
    const local = emptySyncedData();
    local.playlistHistory = [historyEntry('a', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.playlistHistory = [historyEntry('b', '2026-04-29T10:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.playlistHistory).toHaveLength(2);
    expect(merged.playlistHistory.map((h) => h.id).sort()).toEqual(['a', 'b']);
  });

  it('mismo id: gana el de updatedAt mas reciente', () => {
    const local = emptySyncedData();
    local.playlistHistory = [historyEntry('a', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.playlistHistory = [historyEntry('a', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.playlistHistory).toHaveLength(1);
    expect(merged.playlistHistory[0]?.updatedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('tombstone propaga a otros dispositivos', () => {
    const local = emptySyncedData();
    local.playlistHistory = [historyEntry('a', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.playlistHistory = [
      historyEntry('a', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z'),
    ];
    const { merged } = mergeData(local, remote);
    expect(merged.playlistHistory[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('actualiza _sectionMeta.playlistHistory al max de updatedAt', () => {
    const local = emptySyncedData();
    local.playlistHistory = [historyEntry('a', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.playlistHistory = [historyEntry('b', '2026-04-29T12:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(new Date(merged._sectionMeta.playlistHistory!.updatedAt).getTime()).toBe(
      new Date('2026-04-29T12:00:00Z').getTime(),
    );
  });
});
