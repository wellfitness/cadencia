import type { PlaylistHistoryEntry, PlaylistHistoryTrack } from './historyTypes';
import type { HeartRateZone } from '../physiology/karvonen';
import type { Sport } from '../user/userInputs';

/**
 * Funciones puras de agregacion sobre el historial. NO importan de UI ni
 * de cadenciaStore: reciben el array de entradas vivas (filtrado de
 * tombstones) y devuelven estructuras planas listas para render.
 *
 * Convenciones:
 *  - Todos los rankings descartan elementos con appearances === 0.
 *  - Los limites son recomendaciones; el caller puede pedir mas si quiere.
 *  - El orden secundario en empates esta definido para hacer la salida
 *    estable y testeable (no aleatorio entre runs).
 */

export interface TopTrackEntry {
  uri: string;
  name: string;
  artist: string;
  appearances: number;
  /** Cuantas de las apariciones fueron por sustitucion manual del usuario. */
  replacementsByUser: number;
}

export interface TopArtistEntry {
  artist: string;
  appearances: number;
  /** URIs unicas de este artista en el historial. */
  uniqueTracks: number;
}

export interface TopGenreEntry {
  genre: string;
  /** Tiempo total acumulado escuchando este genero, en segundos. */
  totalDurationSec: number;
  appearances: number;
}

export interface ZoneDistribution {
  zone: HeartRateZone;
  totalDurationSec: number;
  /** 0..1, fraccion del tiempo total. 0 si no hay duracion. */
  pctOfTotal: number;
}

export interface HistorySummary {
  totalPlaylists: number;
  totalDurationSec: number;
  zoneDistribution: ZoneDistribution[];
  /** Tracks con wasReplaced=true / total de tracks. 0..1. 0 si no hay tracks. */
  replacementRate: number;
  /** Cuantas playlists por deporte. */
  bySport: Record<Sport, number>;
}

const ZONES: readonly HeartRateZone[] = [1, 2, 3, 4, 5, 6];

/**
 * Resumen agregado sobre todas las entradas. Usado en la cabecera de la
 * pestana de Estadisticas.
 */
export function computeSummary(entries: readonly PlaylistHistoryEntry[]): HistorySummary {
  let totalDuration = 0;
  let replacedTracks = 0;
  let totalTracks = 0;
  const bySport: Record<Sport, number> = { bike: 0, run: 0 };
  const zoneTotals: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const entry of entries) {
    totalDuration += entry.totalDurationSec;
    bySport[entry.sport] += 1;
    for (const zone of ZONES) {
      zoneTotals[zone] += entry.zoneDurations[zone] ?? 0;
    }
    for (const track of entry.tracks) {
      totalTracks += 1;
      if (track.wasReplaced) replacedTracks += 1;
    }
  }

  const zoneDistribution: ZoneDistribution[] = ZONES.map((zone) => ({
    zone,
    totalDurationSec: zoneTotals[zone],
    pctOfTotal: totalDuration > 0 ? zoneTotals[zone] / totalDuration : 0,
  }));

  return {
    totalPlaylists: entries.length,
    totalDurationSec: totalDuration,
    zoneDistribution,
    replacementRate: totalTracks > 0 ? replacedTracks / totalTracks : 0,
    bySport,
  };
}

/**
 * Top tracks por nº de apariciones. Tie-break: mas sustituciones manuales
 * primero (senal mas fuerte de "este lo elijo yo activamente"); luego
 * orden alfabetico para estabilidad determinista.
 */
export function computeTopTracks(
  entries: readonly PlaylistHistoryEntry[],
  limit = 20,
): TopTrackEntry[] {
  type Acc = { name: string; artist: string; appearances: number; replacementsByUser: number };
  const byUri = new Map<string, Acc>();

  for (const entry of entries) {
    for (const track of entry.tracks) {
      const existing = byUri.get(track.uri);
      if (existing) {
        existing.appearances += 1;
        if (track.wasReplaced) existing.replacementsByUser += 1;
      } else {
        byUri.set(track.uri, {
          name: track.name,
          artist: track.artist,
          appearances: 1,
          replacementsByUser: track.wasReplaced ? 1 : 0,
        });
      }
    }
  }

  const result: TopTrackEntry[] = Array.from(byUri.entries()).map(([uri, acc]) => ({
    uri,
    name: acc.name,
    artist: acc.artist,
    appearances: acc.appearances,
    replacementsByUser: acc.replacementsByUser,
  }));

  result.sort((a, b) => {
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    if (b.replacementsByUser !== a.replacementsByUser) {
      return b.replacementsByUser - a.replacementsByUser;
    }
    return a.name.localeCompare(b.name);
  });

  return result.slice(0, limit);
}

/**
 * El campo `artist` viene joineado con ", " en el snapshot. Lo dividimos
 * para contar artistas individuales en colaboraciones. Ediciones con
 * comas en el nombre del artista (raro) cuentan como dos artistas; edge
 * case aceptado a cambio de simplicidad.
 */
function splitArtists(artist: string): string[] {
  return artist
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function computeTopArtists(
  entries: readonly PlaylistHistoryEntry[],
  limit = 15,
): TopArtistEntry[] {
  type Acc = { appearances: number; uris: Set<string> };
  const byArtist = new Map<string, Acc>();

  for (const entry of entries) {
    for (const track of entry.tracks) {
      for (const a of splitArtists(track.artist)) {
        const existing = byArtist.get(a);
        if (existing) {
          existing.appearances += 1;
          existing.uris.add(track.uri);
        } else {
          byArtist.set(a, { appearances: 1, uris: new Set([track.uri]) });
        }
      }
    }
  }

  const result: TopArtistEntry[] = Array.from(byArtist.entries()).map(([artist, acc]) => ({
    artist,
    appearances: acc.appearances,
    uniqueTracks: acc.uris.size,
  }));

  result.sort((a, b) => {
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    if (b.uniqueTracks !== a.uniqueTracks) return b.uniqueTracks - a.uniqueTracks;
    return a.artist.localeCompare(b.artist);
  });

  return result.slice(0, limit);
}

/**
 * Top generos ponderado por duracion total escuchada. Razon: un track Z6
 * de sprint dura 30s y un Z2 puede durar 5min. Contar apariciones a secas
 * sesgaria a sprints. Ponderar por duracion refleja "tiempo real con ese
 * genero sonando".
 */
export function computeTopGenresByDuration(
  entries: readonly PlaylistHistoryEntry[],
  limit = 10,
): TopGenreEntry[] {
  type Acc = { totalDurationSec: number; appearances: number };
  const byGenre = new Map<string, Acc>();

  for (const entry of entries) {
    for (const track of entry.tracks) {
      for (const genre of track.genres) {
        if (genre.length === 0) continue;
        const existing = byGenre.get(genre);
        if (existing) {
          existing.totalDurationSec += track.durationSec;
          existing.appearances += 1;
        } else {
          byGenre.set(genre, { totalDurationSec: track.durationSec, appearances: 1 });
        }
      }
    }
  }

  const result: TopGenreEntry[] = Array.from(byGenre.entries()).map(([genre, acc]) => ({
    genre,
    totalDurationSec: acc.totalDurationSec,
    appearances: acc.appearances,
  }));

  result.sort((a, b) => {
    if (b.totalDurationSec !== a.totalDurationSec) {
      return b.totalDurationSec - a.totalDurationSec;
    }
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    return a.genre.localeCompare(b.genre);
  });

  return result.slice(0, limit);
}

/** Helper expuesto para tests y uso interno (filtra tracks reemplazados). */
export function countReplacedTracks(entries: readonly PlaylistHistoryEntry[]): number {
  let n = 0;
  for (const entry of entries) {
    for (const track of entry.tracks) {
      if (track.wasReplaced) n += 1;
    }
  }
  return n;
}

/** Total de tracks (suma de tracks.length de cada entrada). */
export function countTotalTracks(entries: readonly PlaylistHistoryEntry[]): number {
  return entries.reduce((acc: number, e: PlaylistHistoryEntry) => acc + e.tracks.length, 0);
}

/** Re-export tipo conveniencia. */
export type { PlaylistHistoryEntry, PlaylistHistoryTrack };
