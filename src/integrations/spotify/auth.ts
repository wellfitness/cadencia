import type { SpotifyTokens } from './types';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Construye la URL para que el usuario inicie el flow de autorizacion en
 * Spotify. Tras conceder permisos, Spotify hara redirect a redirectUri
 * anadiendo `?code=...&state=...` (o `?error=...` si rechaza).
 */
export function getAuthorizationUrl(args: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes: readonly string[];
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    response_type: 'code',
    redirect_uri: args.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: args.codeChallenge,
    state: args.state,
    scope: args.scopes.join(' '),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function isTokenResponse(v: unknown): v is TokenResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['access_token'] === 'string' &&
    typeof o['refresh_token'] === 'string' &&
    typeof o['expires_in'] === 'number' &&
    typeof o['scope'] === 'string'
  );
}

function tokenResponseToTokens(json: TokenResponse): SpotifyTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAtMs: Date.now() + json.expires_in * 1000,
    scope: json.scope,
  };
}

function isOAuthErrorBody(v: unknown): v is { error: string; error_description?: string } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['error'] === 'string';
}

async function postTokenRequest(body: URLSearchParams): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    // Spotify devuelve OAuth-standard JSON en errores: { error, error_description }.
    // Parseamos para mostrar el campo legible en lugar del raw, que ayuda al
    // usuario a entender (y reportar) errores tipo invalid_grant, invalid_client.
    const rawBody = await res.text().catch(() => '');
    let detail = rawBody;
    try {
      const json: unknown = JSON.parse(rawBody);
      if (isOAuthErrorBody(json)) {
        detail =
          json.error_description !== undefined && json.error_description !== ''
            ? `${json.error}: ${json.error_description}`
            : json.error;
      }
    } catch {
      // Body no era JSON, dejamos el rawBody.
    }
    if (typeof console !== 'undefined') {
      console.error('[Spotify OAuth error]', {
        status: res.status,
        statusText: res.statusText,
        endpoint: 'POST /api/token',
        detail,
      });
    }
    throw new Error(`Spotify /api/token ${res.status}: ${detail}`);
  }
  const json: unknown = await res.json();
  if (!isTokenResponse(json)) {
    throw new Error('Spotify /api/token devolvio una respuesta inesperada');
  }
  return tokenResponseToTokens(json);
}

/**
 * Intercambia el `code` recibido en el callback por el par accessToken+refreshToken.
 * Usa PKCE (sin client_secret, con code_verifier).
 */
export function exchangeCodeForTokens(args: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<SpotifyTokens> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: args.clientId,
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: args.redirectUri,
      code_verifier: args.codeVerifier,
    }),
  );
}

/**
 * Refresca el accessToken usando el refreshToken vigente. Spotify puede
 * devolver un nuevo refreshToken; si no lo hace, mantenemos el viejo.
 *
 * Nota: el endpoint /api/token devuelve refresh_token siempre con PKCE,
 * asi que la deteccion del fallback es defensiva.
 */
export async function refreshAccessToken(args: {
  clientId: string;
  refreshToken: string;
}): Promise<SpotifyTokens> {
  const tokens = await postTokenRequest(
    new URLSearchParams({
      client_id: args.clientId,
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
    }),
  );
  return {
    ...tokens,
    refreshToken: tokens.refreshToken !== '' ? tokens.refreshToken : args.refreshToken,
  };
}
