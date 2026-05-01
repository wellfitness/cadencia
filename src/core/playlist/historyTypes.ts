import type { MatchQuality } from '../matching/types';
import type { Sport } from '../user/userInputs';

/**
 * Entrada del historial de playlists creadas en Spotify por el usuario.
 *
 * Captura snapshot al pulsar "Crear playlist en Spotify" tras exito de la
 * API. NO se capturan generaciones intermedias ni cambios de seed: solo lo
 * que el usuario llevo realmente a su cuenta de Spotify. Esto convierte el
 * historial en una senal de gustos REALES (lo que se llevo) en lugar de
 * intenciones (lo que ojeo).
 *
 * Mismo patron de array merge LWW + tombstones que `savedSessions` y
 * `plannedEvents`. Tombstones expiran a 30 dias via cleanExpiredTombstones.
 */
export interface PlaylistHistoryEntry {
  /** UUID v4. Estable a lo largo del ciclo de vida del item. */
  id: string;
  /** ISO timestamp del momento del exito de createPlaylistWithTracks. */
  createdAt: string;
  /** Bumpea cuando hay borrado logico (para LWW del merge). */
  updatedAt: string;
  /** Borrado logico. Mismo patron que SavedSession. */
  deletedAt?: string;

  sport: Sport;
  /** 'gpx' = ruta outdoor; 'session' = sesion indoor por bloques. */
  mode: 'gpx' | 'session';
  /** Suma de durationSec de todos los tracks. */
  totalDurationSec: number;
  /** Tiempo total acumulado por zona, en segundos. */
  zoneDurations: Record<1 | 2 | 3 | 4 | 5 | 6, number>;

  /** Si la creacion en Spotify devolvio el id, se guarda aqui. */
  spotifyPlaylistId?: string;
  /** Semilla del motor de matching. null si era undefined (legacy determinista). */
  seed: number | null;
  /** Si la sesion venia de una SavedSession del usuario, su id. */
  savedSessionId?: string;

  tracks: readonly PlaylistHistoryTrack[];
}

/**
 * Snapshot frozen de un track en una playlist concreta. Guardamos los
 * campos necesarios para stats y para mostrar la entrada cronologica
 * aunque el catalogo cambie despues (CSV borrado, track removido de
 * Spotify, etc.).
 */
export interface PlaylistHistoryTrack {
  uri: string;
  name: string;
  /** Artistas joineados con ", " (Track.artists es array; aqui plano). */
  artist: string;
  genres: readonly string[];
  tempoBpm: number;
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  /** Duracion del SEGMENTO que cubre este track (no del audio del track). */
  durationSec: number;
  matchQuality: MatchQuality;
  /** True si el usuario lo metio con "Otro tema" (no fue eleccion del motor). */
  wasReplaced: boolean;
}
