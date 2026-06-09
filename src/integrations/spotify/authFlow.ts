import { getAuthorizationUrl } from './auth';
import { computeCodeChallenge, generateCodeVerifier, generateState } from './pkce';
import { getRedirectUri } from './redirectUri';
import { saveAuthFlow } from './storage';
import { SPOTIFY_SCOPES } from './types';

/**
 * Prepara el flujo OAuth PKCE de Spotify: genera el verifier/challenge y el
 * state CSRF, los persiste en sessionStorage (para verificarlos en /callback)
 * y devuelve la URL del endpoint de autorizacion — SIN navegar. Aislar la
 * parte con efectos (saveAuthFlow + construccion de URL) de la navegacion la
 * hace unitestable sin tocar `window.location`.
 *
 * `scopes` por defecto son los de creacion de playlists; el Modo TV pasa un
 * conjunto extendido cuando necesita permisos de reproduccion.
 */
export async function buildSpotifyAuthorizationUrl(
  clientId: string,
  scopes: readonly string[] = SPOTIFY_SCOPES,
): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await computeCodeChallenge(verifier);
  const state = generateState();
  saveAuthFlow({ codeVerifier: verifier, state });
  return getAuthorizationUrl({
    clientId,
    redirectUri: getRedirectUri(),
    codeChallenge: challenge,
    state,
    scopes,
  });
}

/**
 * Arranca el login de Spotify: prepara el PKCE y navega al endpoint de
 * autorizacion. La navegacion es un full-page redirect — la pestana sale de la
 * app y vuelve por /callback tras conceder permisos.
 *
 * Fuente unica de "arrancar el login": la disparan tanto ResultStep (al pulsar
 * «Crear playlist» sin sesion) como MusicStep (conexion anticipada opcional),
 * de modo que el redirect ocurra antes de editar la lista y no en el paso final.
 */
export async function beginSpotifyAuthorization(
  clientId: string,
  scopes: readonly string[] = SPOTIFY_SCOPES,
): Promise<void> {
  const url = await buildSpotifyAuthorizationUrl(clientId, scopes);
  window.location.assign(url);
}
