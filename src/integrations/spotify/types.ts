/**
 * Tokens devueltos por el endpoint /api/token de Spotify (PKCE flow).
 * Se persisten solo en sessionStorage (expira con la pestana).
 */
export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  /** Timestamp absoluto (ms epoch) en el que expira el accessToken. */
  expiresAtMs: number;
  /** Scopes concedidos, separados por espacio. */
  scope: string;
}

/**
 * Estado del flujo OAuth que necesitamos persistir antes del redirect a
 * Spotify para poder verificarlo y completar el intercambio en /callback.
 */
export interface SpotifyAuthFlowState {
  codeVerifier: string;
  state: string;
}

/**
 * Resumen de la playlist creada con exito en Spotify, devuelto a la UI
 * para mostrar el enlace al usuario.
 */
export interface CreatedPlaylist {
  id: string;
  name: string;
  externalUrl: string; // https://open.spotify.com/playlist/{id}
  trackCount: number;
}

/**
 * Scopes requeridos: crear/modificar playlists. Necesitamos AMBOS (privado y
 * publico) por una limitacion de la Web API de Spotify en 2025: aunque
 * pasemos `public: false` al crear la playlist, Spotify la guarda como
 * publica y luego para anadirle tracks reclama el scope de publico. Sin
 * `playlist-modify-public` el POST a /playlists/{id}/tracks devuelve 403.
 *
 * No pedimos lectura de biblioteca, escucha, ni datos personales.
 */
export const SPOTIFY_SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
] as const;
