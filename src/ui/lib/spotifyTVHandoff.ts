import {
  SPOTIFY_PLAYER_SCOPES,
  loadTokens,
  loadUserProfile,
  tokenHasScopes,
} from '@integrations/spotify';
import type { MatchedSegment } from '@core/matching';
import type { TVHandoffSpotify } from '@core/tv/tvHandoff';

/**
 * Construye el campo `spotify` del TVHandoffPayload a partir del estado
 * actual del wizard. Devuelve null cuando alguna precondicion falla y los
 * controles integrados deben quedarse ocultos en /tv (degradacion silenciosa
 * al comportamiento legacy del Modo TV).
 *
 * Precondiciones que comprueba:
 *   1. El usuario tiene tokens Spotify (al menos un OAuth completado).
 *   2. Esos tokens incluyen los scopes de player. Tokens viejos (solo
 *      playlist scopes) NO los tienen — silent degradation hasta el
 *      proximo OAuth con SPOTIFY_SCOPES extendidos.
 *   3. La cuenta es Premium (`getCurrentUser` ya guardo el perfil).
 *      Free/open: los endpoints /me/player/* devuelven 403.
 *   4. La playlist casada (`matched`) tiene al menos un track con URI.
 *      Sesion vacia o todo `track: null` (insufficient) → no hay nada que
 *      reproducir, ocultar la barra.
 *
 * El array `blockTrackUris` resultante alinea uno-a-uno con los bloques del
 * plan expandido (sesiones indoor usan crossZoneMode='discrete', 1 track por
 * bloque). Bloques sin track quedan como cadena vacia "" — el hook del Modo
 * TV las trata como "no sincronizar este bloque".
 *
 * Esta funcion solo lee del storage (sessionStorage) — no toca la red.
 */
export function buildSpotifyTVHandoff(
  matched: readonly MatchedSegment[] | null,
): TVHandoffSpotify | null {
  if (matched === null || matched.length === 0) return null;
  const tokens = loadTokens();
  if (tokens === null) return null;
  if (!tokenHasScopes(tokens, SPOTIFY_PLAYER_SCOPES)) return null;
  const profile = loadUserProfile();
  if (profile === null || !profile.productPremium) return null;
  const blockTrackUris = matched.map((m) => m.track?.uri ?? '');
  if (blockTrackUris.every((u) => u.length === 0)) return null;
  return {
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAtMs: tokens.expiresAtMs,
      scope: tokens.scope,
    },
    productPremium: profile.productPremium,
    blockTrackUris,
  };
}
