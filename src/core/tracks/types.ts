/**
 * Origen del track. En el catalogo nativo unificado, refleja el nombre del
 * CSV de procedencia (informativo). En tracks subidos por el usuario en
 * runtime se usa la cadena 'user'.
 */
export type TrackSource = string;

/**
 * Track tal y como lo consume el motor de matching. Mantiene solo los campos
 * usados en el algoritmo + algunos descriptivos para la UI (titulo, artista,
 * album, duracion). Los campos crudos del CSV de Spotify que no usamos
 * (Liveness, Speechiness, Loudness, etc.) se descartan en el parser.
 */
export interface Track {
  uri: string;                 // spotify:track:XXX...
  name: string;
  album: string;
  artists: string[];           // split de "Artist Name(s)" por ';'
  genres: string[];            // split de "Genres" por ',' + lowercase + trim + dedupe
  tempoBpm: number;
  energy: number;              // 0-1
  valence: number;             // 0-1
  danceability: number;        // 0-1
  durationMs: number;
  source: TrackSource;
}
