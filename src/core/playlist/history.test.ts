import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlaylistHistoryEntry,
  listPlaylistHistory,
  getPlaylistHistoryEntry,
  deletePlaylistHistoryEntry,
  clearAllPlaylistHistory,
  type CreatePlaylistHistoryInput,
} from './history';
import { clearCadenciaData, loadCadenciaData } from '@ui/state/cadenciaStore';
import type { MatchedSegment } from '@core/matching/types';
import type { Track } from '@core/tracks/types';

function track(uri: string, name: string, artists: string[] = ['Artist']): Track {
  return {
    uri,
    name,
    album: 'Album',
    artists,
    genres: ['rock'],
    tempoBpm: 80,
    energy: 0.7,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 180000,
    source: 'test',
  };
}

function segment(t: Track | null, zone: 1 | 2 | 3 | 4 | 5 | 6, durationSec: number): MatchedSegment {
  return {
    sport: 'bike',
    startSec: 0,
    durationSec,
    avgPowerWatts: 200,
    zone,
    cadenceProfile: 'flat',
    startDistanceMeters: 0,
    endDistanceMeters: 1000,
    startElevationMeters: 100,
    endElevationMeters: 100,
    startLat: 0,
    startLon: 0,
    track: t,
    matchScore: 0.8,
    matchQuality: 'strict',
  };
}

const baseInput = (
  matched: MatchedSegment[],
  replacedIndices: ReadonlySet<number> = new Set(),
): CreatePlaylistHistoryInput => ({
  sport: 'bike',
  mode: 'session',
  matched,
  replacedIndices,
  seed: 42,
});

describe('playlistHistory CRUD', () => {
  beforeEach(() => {
    clearCadenciaData();
  });

  it('createPlaylistHistoryEntry persiste y devuelve id estable', () => {
    const seg = [segment(track('uri:1', 'A'), 2, 180)];
    const created = createPlaylistHistoryEntry(baseInput(seg));
    expect(created.id.length).toBeGreaterThan(0);
    expect(listPlaylistHistory()).toHaveLength(1);
    expect(getPlaylistHistoryEntry(created.id)?.id).toBe(created.id);
  });

  it('descarta segmentos con track null (no llegaron a Spotify)', () => {
    const segs = [
      segment(track('uri:1', 'A'), 2, 60),
      segment(null, 3, 60),
      segment(track('uri:2', 'B'), 4, 60),
    ];
    const created = createPlaylistHistoryEntry(baseInput(segs));
    expect(created.tracks).toHaveLength(2);
    expect(created.tracks.map((t) => t.uri)).toEqual(['uri:1', 'uri:2']);
  });

  it('marca wasReplaced segun replacedIndices del wizard', () => {
    const segs = [
      segment(track('uri:1', 'A'), 2, 60),
      segment(track('uri:2', 'B'), 3, 60),
      segment(track('uri:3', 'C'), 4, 60),
    ];
    const replaced = new Set<number>([0, 2]);
    const created = createPlaylistHistoryEntry(baseInput(segs, replaced));
    expect(created.tracks[0]?.wasReplaced).toBe(true);
    expect(created.tracks[1]?.wasReplaced).toBe(false);
    expect(created.tracks[2]?.wasReplaced).toBe(true);
  });

  it('replacedIndices se ajusta cuando hay segmentos descartados (track null)', () => {
    // Si el segmento [1] es null (descartado), su index original 1 estaba
    // marcado como replaced, pero ese hueco no llega al historial. El
    // siguiente track en el array final corresponde al index 2 original.
    const segs = [
      segment(track('uri:1', 'A'), 2, 60),
      segment(null, 3, 60),
      segment(track('uri:2', 'B'), 4, 60),
    ];
    const replaced = new Set<number>([1, 2]); // index 1 era null, index 2 es B
    const created = createPlaylistHistoryEntry(baseInput(segs, replaced));
    expect(created.tracks).toHaveLength(2);
    // El track 'B' (index original 2) tenia wasReplaced=true.
    const trackB = created.tracks.find((t) => t.uri === 'uri:2');
    expect(trackB?.wasReplaced).toBe(true);
    // El track 'A' (index original 0) no estaba en replaced.
    const trackA = created.tracks.find((t) => t.uri === 'uri:1');
    expect(trackA?.wasReplaced).toBe(false);
  });

  it('agrega zoneDurations correctamente', () => {
    const segs = [
      segment(track('uri:1', 'A'), 2, 120),
      segment(track('uri:2', 'B'), 2, 60),
      segment(track('uri:3', 'C'), 4, 90),
    ];
    const created = createPlaylistHistoryEntry(baseInput(segs));
    expect(created.zoneDurations[2]).toBe(180);
    expect(created.zoneDurations[4]).toBe(90);
    expect(created.zoneDurations[1]).toBe(0);
    expect(created.totalDurationSec).toBe(270);
  });

  it('joinea artists multiples con coma', () => {
    const segs = [segment(track('uri:1', 'X', ['Artist A', 'Artist B']), 2, 60)];
    const created = createPlaylistHistoryEntry(baseInput(segs));
    expect(created.tracks[0]?.artist).toBe('Artist A, Artist B');
  });

  it('listPlaylistHistory ordena por createdAt desc y oculta tombstones', async () => {
    const a = createPlaylistHistoryEntry(baseInput([segment(track('uri:1', 'A'), 2, 60)]));
    await new Promise((r) => setTimeout(r, 10));
    const b = createPlaylistHistoryEntry(baseInput([segment(track('uri:2', 'B'), 3, 60)]));

    expect(listPlaylistHistory().map((e) => e.id)).toEqual([b.id, a.id]);

    deletePlaylistHistoryEntry(a.id);
    expect(listPlaylistHistory().map((e) => e.id)).toEqual([b.id]);
  });

  it('deletePlaylistHistoryEntry deja tombstone (no purga del array)', () => {
    const a = createPlaylistHistoryEntry(baseInput([segment(track('uri:1', 'A'), 2, 60)]));
    deletePlaylistHistoryEntry(a.id);
    const raw = loadCadenciaData();
    expect(raw.playlistHistory).toHaveLength(1);
    expect(raw.playlistHistory[0]?.deletedAt).toBeDefined();
  });

  it('getPlaylistHistoryEntry devuelve null para tombstones', () => {
    const a = createPlaylistHistoryEntry(baseInput([segment(track('uri:1', 'A'), 2, 60)]));
    deletePlaylistHistoryEntry(a.id);
    expect(getPlaylistHistoryEntry(a.id)).toBeNull();
  });

  it('clearAllPlaylistHistory tombstona todas las entradas vivas', () => {
    createPlaylistHistoryEntry(baseInput([segment(track('uri:1', 'A'), 2, 60)]));
    createPlaylistHistoryEntry(baseInput([segment(track('uri:2', 'B'), 3, 60)]));
    expect(listPlaylistHistory()).toHaveLength(2);
    clearAllPlaylistHistory();
    expect(listPlaylistHistory()).toHaveLength(0);
    // Los items siguen en el array fisico para propagar tombstone via Drive.
    expect(loadCadenciaData().playlistHistory).toHaveLength(2);
  });

  it('clearAllPlaylistHistory es idempotente cuando no hay entradas vivas', () => {
    clearAllPlaylistHistory(); // no-op
    const data = loadCadenciaData();
    expect(data.playlistHistory).toHaveLength(0);
  });

  it('createPlaylistHistoryEntry bumpea _sectionMeta.playlistHistory', () => {
    createPlaylistHistoryEntry(baseInput([segment(track('uri:1', 'A'), 2, 60)]));
    const data = loadCadenciaData();
    expect(data._sectionMeta.playlistHistory).toBeDefined();
    expect(data._sectionMeta.playlistHistory!.updatedAt).toBe(
      data.playlistHistory[0]!.updatedAt,
    );
  });

  it('campos opcionales (spotifyPlaylistId, savedSessionId) se respetan', () => {
    const segs = [segment(track('uri:1', 'A'), 2, 60)];
    const created = createPlaylistHistoryEntry({
      ...baseInput(segs),
      spotifyPlaylistId: 'pl-123',
      savedSessionId: 'sess-456',
    });
    expect(created.spotifyPlaylistId).toBe('pl-123');
    expect(created.savedSessionId).toBe('sess-456');
  });
});
