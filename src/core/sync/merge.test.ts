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
import { EMPTY_USER_INPUTS, hasUserInputData } from '../user/userInputs';
import { EMPTY_PREFERENCES, hasMusicPreferenceData } from '../matching/types';

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

describe('mergeData — proteccion anti-vacio (userInputs)', () => {
  // El escenario del bug real: un dispositivo "joven" (dev con StrictMode,
  // wizard recien abierto, storage limpiado) escribia un userInputs todo-null
  // con timestamp fresco, que ganaba el LWW y machacaba los datos buenos del
  // Drive. La regla anti-vacio invierte ese resultado.
  function vacuousAt(ts: string): SyncedData {
    const d = emptySyncedData();
    d.userInputs = { ...EMPTY_USER_INPUTS };
    d._sectionMeta.userInputs = { updatedAt: ts };
    d.updatedAt = ts;
    return d;
  }

  function nullAt(ts: string): SyncedData {
    const d = emptySyncedData();
    d.userInputs = null;
    d._sectionMeta.userInputs = { updatedAt: ts };
    d.updatedAt = ts;
    return d;
  }

  it('un objeto vacuo local mas reciente NO derrota a datos reales remotos', () => {
    const local = vacuousAt('2026-06-10T10:00:00Z');
    const remote = userInputsAt(70, '2026-06-01T10:00:00Z');
    const { merged, conflicts } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(70);
    // La meta restaurada es la de los datos, no la del vacuo.
    expect(merged._sectionMeta.userInputs?.updatedAt).toBe('2026-06-01T10:00:00Z');
    expect(conflicts.some((c) => c.section === 'userInputs')).toBe(true);
  });

  it('un objeto vacuo remoto mas reciente NO derrota a datos reales locales', () => {
    const local = userInputsAt(70, '2026-06-01T10:00:00Z');
    const remote = vacuousAt('2026-06-10T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(70);
  });

  it('sport solo (eleccion del paso 0) cuenta como vacuo y no machaca datos', () => {
    const local = emptySyncedData();
    local.userInputs = { ...EMPTY_USER_INPUTS, sport: 'bike' };
    local._sectionMeta.userInputs = { updatedAt: '2026-06-10T10:00:00Z' };
    const remote = userInputsAt(70, '2026-06-01T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs?.weightKg).toBe(70);
  });

  it('null explicito mas reciente SI gana (forget multi-dispositivo)…', () => {
    const local = userInputsAt(70, '2026-06-01T10:00:00Z');
    const remote = nullAt('2026-06-10T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs).toBeNull();
  });

  it('…pero los datos descartados por el null quedan en el conflict log', () => {
    const local = userInputsAt(70, '2026-06-01T10:00:00Z');
    const remote = nullAt('2026-06-10T10:00:00Z');
    const { conflicts } = mergeData(local, remote);
    const safety = conflicts.find((c) => c.section === 'userInputs');
    expect(safety).toBeDefined();
    expect((safety?.loserValue as { weightKg: number }).weightKg).toBe(70);
  });

  it('vacuo vs vacuo: LWW normal sin conflicto de proteccion', () => {
    const local = vacuousAt('2026-06-10T10:00:00Z');
    const remote = vacuousAt('2026-06-01T10:00:00Z');
    const { merged, conflicts } = mergeData(local, remote);
    expect(merged.userInputs).toEqual({ ...EMPTY_USER_INPUTS });
    expect(conflicts).toHaveLength(0);
  });

  it('el merge converge: re-mergear el resultado contra el lado vacuo es estable', () => {
    const vacuous = vacuousAt('2026-06-10T10:00:00Z');
    const data = userInputsAt(70, '2026-06-01T10:00:00Z');
    const first = mergeData(vacuous, data).merged;
    const second = mergeData(vacuous, first).merged;
    expect(second.userInputs?.weightKg).toBe(70);
  });
});

describe('mergeData — proteccion anti-vacio (musicPreferences)', () => {
  it('EMPTY_PREFERENCES + seed aleatorio reciente no machaca generos guardados', () => {
    const local = emptySyncedData();
    local.musicPreferences = { ...EMPTY_PREFERENCES, seed: 12345 };
    local._sectionMeta.musicPreferences = { updatedAt: '2026-06-10T10:00:00Z' };
    const remote = emptySyncedData();
    remote.musicPreferences = { preferredGenres: ['pop', 'rock'], allEnergetic: true };
    remote._sectionMeta.musicPreferences = { updatedAt: '2026-06-01T10:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.musicPreferences?.preferredGenres).toEqual(['pop', 'rock']);
  });

  it('null explicito reciente (limpiar seleccion) si gana', () => {
    const local = emptySyncedData();
    local.musicPreferences = { preferredGenres: ['pop'], allEnergetic: false };
    local._sectionMeta.musicPreferences = { updatedAt: '2026-06-01T10:00:00Z' };
    const remote = emptySyncedData();
    remote.musicPreferences = null;
    remote._sectionMeta.musicPreferences = { updatedAt: '2026-06-10T10:00:00Z' };
    const { merged } = mergeData(local, remote);
    expect(merged.musicPreferences).toBeNull();
  });
});

describe('helpers de contenido real', () => {
  it('hasUserInputData ignora sport y detecta cualquier dato fisiologico', () => {
    expect(hasUserInputData({ ...EMPTY_USER_INPUTS })).toBe(false);
    expect(hasUserInputData({ ...EMPTY_USER_INPUTS, sport: 'run' })).toBe(false);
    expect(hasUserInputData({ ...EMPTY_USER_INPUTS, weightKg: 70 })).toBe(true);
    expect(hasUserInputData({ ...EMPTY_USER_INPUTS, sex: 'female' })).toBe(true);
    expect(hasUserInputData({ ...EMPTY_USER_INPUTS, bikeType: 'road' })).toBe(true);
  });

  it('hasMusicPreferenceData ignora el seed', () => {
    expect(hasMusicPreferenceData({ ...EMPTY_PREFERENCES })).toBe(false);
    expect(hasMusicPreferenceData({ ...EMPTY_PREFERENCES, seed: 99 })).toBe(false);
    expect(
      hasMusicPreferenceData({ preferredGenres: ['pop'], allEnergetic: false }),
    ).toBe(true);
    expect(hasMusicPreferenceData({ preferredGenres: [], allEnergetic: true })).toBe(true);
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
