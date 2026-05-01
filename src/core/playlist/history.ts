import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import type { MatchedSegment } from '../matching/types';
import type { Sport } from '../user/userInputs';
import type { HeartRateZone } from '../physiology/karvonen';
import type { PlaylistHistoryEntry, PlaylistHistoryTrack } from './historyTypes';

/**
 * CRUD del historial de playlists creadas en Spotify. Mismo patron de
 * borrado logico (tombstones con `deletedAt` + cleanup automatico a 30
 * dias) que `savedSessions` y `plannedEvents`.
 */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface CreatePlaylistHistoryInput {
  sport: Sport;
  mode: 'gpx' | 'session';
  matched: readonly MatchedSegment[];
  replacedIndices: ReadonlySet<number>;
  seed: number | null;
  spotifyPlaylistId?: string;
  savedSessionId?: string;
}

const EMPTY_ZONE_DURATIONS: Record<HeartRateZone, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
};

/**
 * Construye una entrada del historial a partir del estado del wizard al
 * confirmar la creacion en Spotify. Solo incluye segmentos con track no
 * nulo: los huecos por catalogo insuficiente no llegaron a Spotify y no
 * deben contar en las estadisticas.
 */
export function createPlaylistHistoryEntry(
  input: CreatePlaylistHistoryInput,
): PlaylistHistoryEntry {
  const now = new Date().toISOString();
  const tracks: PlaylistHistoryTrack[] = [];
  const zoneDurations: Record<HeartRateZone, number> = { ...EMPTY_ZONE_DURATIONS };
  let totalDurationSec = 0;

  input.matched.forEach((segment, index) => {
    if (segment.track === null) return;
    const wasReplaced = input.replacedIndices.has(index);
    const dur = Math.round(segment.durationSec);
    tracks.push({
      uri: segment.track.uri,
      name: segment.track.name,
      artist: segment.track.artists.join(', '),
      genres: segment.track.genres,
      tempoBpm: segment.track.tempoBpm,
      zone: segment.zone,
      durationSec: dur,
      matchQuality: segment.matchQuality,
      wasReplaced,
    });
    zoneDurations[segment.zone] = (zoneDurations[segment.zone] ?? 0) + dur;
    totalDurationSec += dur;
  });

  const entry: PlaylistHistoryEntry = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    sport: input.sport,
    mode: input.mode,
    totalDurationSec,
    zoneDurations,
    seed: input.seed,
    tracks,
  };
  if (input.spotifyPlaylistId !== undefined) {
    entry.spotifyPlaylistId = input.spotifyPlaylistId;
  }
  if (input.savedSessionId !== undefined) {
    entry.savedSessionId = input.savedSessionId;
  }

  const data = loadCadenciaData();
  data.playlistHistory = [...data.playlistHistory, entry];
  data._sectionMeta.playlistHistory = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return entry;
}

/** Devuelve las entradas vivas del historial, mas reciente primero. */
export function listPlaylistHistory(): PlaylistHistoryEntry[] {
  return loadCadenciaData()
    .playlistHistory.filter((h) => !h.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPlaylistHistoryEntry(id: string): PlaylistHistoryEntry | null {
  const found = loadCadenciaData().playlistHistory.find((h) => h.id === id);
  if (!found || found.deletedAt) return null;
  return found;
}

/** Borrado logico: tombstone con `deletedAt`. Se propaga via Drive sync. */
export function deletePlaylistHistoryEntry(id: string): void {
  const data = loadCadenciaData();
  const idx = data.playlistHistory.findIndex((h) => h.id === id);
  if (idx === -1) return;
  const current = data.playlistHistory[idx];
  if (!current || current.deletedAt) return;
  const now = new Date().toISOString();
  const tombstone: PlaylistHistoryEntry = {
    ...current,
    deletedAt: now,
    updatedAt: now,
  };
  data.playlistHistory = [
    ...data.playlistHistory.slice(0, idx),
    tombstone,
    ...data.playlistHistory.slice(idx + 1),
  ];
  data._sectionMeta.playlistHistory = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}

/**
 * Tombstone masivo a todas las entradas vivas. Mantiene los items en el
 * array para que el merge LWW propague el delete a otros dispositivos
 * antes de purgarse a los 30 dias. Si no hay entradas vivas, no escribe.
 */
export function clearAllPlaylistHistory(): void {
  const data = loadCadenciaData();
  if (!data.playlistHistory.some((h) => !h.deletedAt)) return;
  const now = new Date().toISOString();
  data.playlistHistory = data.playlistHistory.map((h) =>
    h.deletedAt ? h : { ...h, deletedAt: now, updatedAt: now },
  );
  data._sectionMeta.playlistHistory = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}
