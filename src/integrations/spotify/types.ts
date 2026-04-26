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
 * Datos minimos del usuario Spotify, solo para mostrar feedback humano
 * ("Hola, {nombre}") y para el endpoint POST /v1/users/{id}/playlists.
 * NO se persiste mas alla de la sesion.
 */
export interface SpotifyUser {
  id: string;
  displayName: string | null;
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
 * Scope minimo requerido: solo crear y modificar playlists privadas del usuario.
 * No pedimos lectura de su biblioteca ni reproduccion.
 */
export const SPOTIFY_SCOPES = ['playlist-modify-private'] as const;
