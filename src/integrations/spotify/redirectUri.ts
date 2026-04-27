/**
 * Devuelve el Redirect URI a usar en el flow OAuth de Spotify.
 *
 * El usuario debe registrar este URI en developer.spotify.com (uno por entorno):
 *   - dev:  http://127.0.0.1:5173/callback
 *   - prod: https://<tu-dominio>/callback
 *
 * Spotify dejo de aceptar `localhost` a finales de 2024 — usar 127.0.0.1.
 */
export function getRedirectUri(): string {
  return `${window.location.origin}/callback`;
}
