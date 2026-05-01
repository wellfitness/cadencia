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
 * Scopes para crear/modificar playlists (flujo "Crear en Spotify"). Necesitamos
 * AMBOS (privado y publico) por una limitacion de la Web API de Spotify en
 * 2025: aunque pasemos `public: false` al crear la playlist, Spotify la guarda
 * como publica y luego para anadirle tracks reclama el scope de publico. Sin
 * `playlist-modify-public` el POST a /playlists/{id}/items devuelve 403.
 */
export const SPOTIFY_PLAYLIST_SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
] as const;

/**
 * Scopes para los controles de Spotify en Modo TV (REST player + detectar
 * Premium). El usuario los acepta junto con los de playlist en el mismo
 * consent OAuth — ambas funcionalidades viven bajo el mismo token.
 *
 * - `user-modify-playback-state`: enviar play/pause/next/seek a /me/player/*
 * - `user-read-playback-state`: leer el estado actual del reproductor
 *   (pausado, track sonando, dispositivo activo) para sincronizar el timer
 *   del Modo TV con la realidad de la cuenta Spotify del usuario.
 * - `user-read-private`: leer el campo `product` de /me y saber si es Premium.
 *   Sin Premium los endpoints de /me/player/* devuelven 403, asi que
 *   detectamos esto antes y degradamos la UI a "abrir Spotify aparte".
 */
export const SPOTIFY_PLAYER_SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-private',
] as const;

/**
 * Union de todos los scopes que pedimos en el flow OAuth. Existing users con
 * tokens de la version anterior (solo PLAYLIST_SCOPES) siguen pudiendo crear
 * playlists; solo se les pide re-autorizar cuando intentan usar los controles
 * de musica en Modo TV (vinculado a `tokenHasScopes`).
 *
 * No pedimos `streaming` (Web Playback SDK) deliberadamente: el SDK quedo
 * fuera del alcance V1 por incompatibilidad con iOS Safari.
 */
export const SPOTIFY_SCOPES = [
  ...SPOTIFY_PLAYLIST_SCOPES,
  ...SPOTIFY_PLAYER_SCOPES,
] as const;

/**
 * Perfil minimo del usuario que necesitamos: solo el campo `product` para
 * gating de Premium. Lo cacheamos junto a los tokens (sessionStorage).
 *
 * `product` segun la docs de Spotify puede ser `premium`, `free` u `open`
 * (alias antiguo de free). Cualquier valor distinto de `premium` significa
 * que los endpoints /me/player/* devolveran 403.
 */
export interface SpotifyUserProfile {
  product: 'premium' | 'free' | 'open';
  productPremium: boolean;
}
