import type { CreatedPlaylist, SpotifyUserProfile } from './types';

const API_BASE = 'https://api.spotify.com/v1';

/** Maximo de URIs por POST a /playlists/{id}/tracks segun docs Spotify. */
const ADD_TRACKS_BATCH_SIZE = 100;

interface SpotifyError {
  message: string;
  status: number;
}

function isSpotifyErrorResponse(v: unknown): v is { error: SpotifyError } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o['error'] !== 'object' || o['error'] === null) return false;
  const err = o['error'] as Record<string, unknown>;
  return typeof err['message'] === 'string';
}

/**
 * Error 403 Forbidden de la Web API de Spotify. En el modelo BYOC puro de
 * Cadencia, este 403 casi siempre significa que el usuario olvido anadir su
 * propio email a "Users and Access" en SU PROPIA app de Spotify (Spotify
 * limita Development Mode a 5 cuentas autorizadas explicitamente). Se
 * diferencia del Error generico para que la UI pueda abrir el
 * SpotifyAccessDeniedDialog con instrucciones de como autorizarse en su
 * dashboard, en lugar del banner de error generico.
 *
 * Tambien aplica a otros 403 (scope insuficiente, endpoint retirado, rate
 * limit) — la UI los trata como mismo caso porque el remedio inmediato
 * (revisar la app del usuario en developer.spotify.com) es tambien valido
 * para esos escenarios poco frecuentes.
 */
export class SpotifyAuthorizationError extends Error {
  readonly status: number;
  readonly path: string;
  readonly method: string;
  readonly serverMessage: string;
  constructor(args: {
    status: number;
    path: string;
    method: string;
    serverMessage: string;
  }) {
    super(`Spotify API ${args.status} en ${args.method} ${args.path}: ${args.serverMessage}`);
    this.name = 'SpotifyAuthorizationError';
    this.status = args.status;
    this.path = args.path;
    this.method = args.method;
    this.serverMessage = args.serverMessage;
  }
}

async function fetchSpotify(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = init.method ?? 'GET';
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    // Leer el cuerpo del error de la forma mas tolerante posible:
    // primero como texto (siempre funciona), despues intentar parsear JSON.
    const rawBody = await res.text().catch(() => '');
    let parsedMessage: string | null = null;
    try {
      const json: unknown = JSON.parse(rawBody);
      if (isSpotifyErrorResponse(json)) {
        parsedMessage = json.error.message;
      }
    } catch {
      // Body no era JSON. Dejamos el rawBody como esta.
    }
    // Logger en consola para debugging avanzado
    if (typeof console !== 'undefined') {
      console.error('[Spotify API error]', {
        status: res.status,
        statusText: res.statusText,
        path,
        method,
        parsedMessage,
        rawBody: rawBody.slice(0, 500), // primeros 500 chars
      });
    }
    // Mensaje a la UI: incluimos el cuerpo (truncado) si Spotify no dio JSON,
    // o el message parseado si si.
    const detail =
      parsedMessage !== null
        ? parsedMessage
        : rawBody !== ''
          ? rawBody.slice(0, 200)
          : res.statusText;
    if (res.status === 403) {
      throw new SpotifyAuthorizationError({
        status: 403,
        path,
        method,
        serverMessage: detail,
      });
    }
    // Incluimos method+path en el message para que el banner de error de la UI
    // permita al usuario enviar una captura util sin tener que abrir DevTools.
    throw new Error(`Spotify API ${res.status} en ${method} ${path}: ${detail}`);
  }
  return res;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

function isSpotifyPlaylist(v: unknown): v is SpotifyPlaylist {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || typeof o['name'] !== 'string') return false;
  const urls = o['external_urls'];
  if (typeof urls !== 'object' || urls === null) return false;
  return typeof (urls as Record<string, unknown>)['spotify'] === 'string';
}

/** Limites duros de Spotify para name/description de playlist. */
const MAX_PLAYLIST_NAME_CHARS = 100;
const MAX_PLAYLIST_DESCRIPTION_CHARS = 300;

/**
 * Crea una playlist en la cuenta del token.
 *
 * Endpoint: `POST /v1/me/playlists` (no `/users/{id}/playlists`). El antiguo
 * endpoint con `user_id` explicito fue retirado el 11 de febrero de 2026 y
 * devuelve 403 Forbidden silencioso. El nuevo endpoint `/me/playlists`
 * deduce el dueno del token.
 *
 * Notas adicionales: Spotify ignora actualmente el campo `public:false` y
 * crea la playlist como publica (la respuesta inmediata dice `public:false`
 * pero un GET posterior la muestra como `public:true`). Para anadir tracks
 * a la playlist resultante el cliente necesita scope `playlist-modify-public`
 * ademas de `playlist-modify-private`. Mantenemos `public:false` aqui por
 * intencion documental para cuando Spotify lo respete.
 *
 * `name` y `description` se truncan a los limites duros de Spotify (100 y
 * 300 caracteres). Sin trunc, la API responde con un mensaje generico
 * dificil de relacionar con el campo culpable.
 *
 * Referencia: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
 */
export async function createPlaylist(
  accessToken: string,
  name: string,
  description: string,
): Promise<{ id: string; externalUrl: string; name: string }> {
  const safeName = name.slice(0, MAX_PLAYLIST_NAME_CHARS);
  const safeDescription = description.slice(0, MAX_PLAYLIST_DESCRIPTION_CHARS);
  const res = await fetchSpotify(accessToken, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({ name: safeName, description: safeDescription, public: false }),
  });
  const json: unknown = await res.json();
  if (!isSpotifyPlaylist(json)) {
    throw new Error('Spotify /users/{id}/playlists devolvio una respuesta inesperada');
  }
  return {
    id: json.id,
    name: json.name,
    externalUrl: json.external_urls.spotify,
  };
}

/**
 * Anade URIs a una playlist existente. Si hay mas de 100 URIs las pagina
 * (Spotify tiene limite duro de 100 por peticion). Las URIs ya deben venir
 * en formato `spotify:track:XXX`.
 *
 * Endpoint: `POST /v1/playlists/{id}/items` (no `/tracks`).
 *
 * En la migracion de Web API del 11 de febrero de 2026 Spotify renombro
 * el endpoint de `tracks` a `items` (para soportar tambien episodios de
 * podcast en playlists). El antiguo `/tracks` devuelve 403 Forbidden
 * silencioso para apps en Development Mode aunque token, scope y body
 * sean correctos. El nuevo `/items` funciona perfectamente.
 *
 * Referencia: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: readonly string[],
): Promise<void> {
  for (let i = 0; i < uris.length; i += ADD_TRACKS_BATCH_SIZE) {
    const batch = uris.slice(i, i + ADD_TRACKS_BATCH_SIZE);
    await fetchSpotify(accessToken, `/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
  }
}

interface SpotifyMeResponse {
  product?: string;
}

function isSpotifyMeResponse(v: unknown): v is SpotifyMeResponse {
  return typeof v === 'object' && v !== null;
}

/**
 * Lee el perfil minimo del usuario autenticado: solo el campo `product` para
 * gating de Premium en los controles de Modo TV.
 *
 * Endpoint: `GET /v1/me`. Requiere scope `user-read-private` para que `product`
 * venga relleno; sin ese scope la respuesta es 200 pero `product` viene como
 * undefined. En ese caso degradamos a `productPremium: false` para que la UI
 * no asuma Premium y oculte los controles que requieren /me/player/*.
 *
 * Spotify documenta tres valores de `product`: `premium`, `free` y `open`
 * (alias historico de `free`). Cualquier valor que no sea exactamente
 * `premium` se trata como no-Premium.
 *
 * Referencia: https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile
 */
export async function getCurrentUser(accessToken: string): Promise<SpotifyUserProfile> {
  const res = await fetchSpotify(accessToken, '/me');
  const json: unknown = await res.json();
  if (!isSpotifyMeResponse(json)) {
    throw new Error('Spotify /me devolvio una respuesta inesperada');
  }
  const product =
    json.product === 'premium' || json.product === 'free' || json.product === 'open'
      ? json.product
      : 'free';
  return {
    product,
    productPremium: product === 'premium',
  };
}

/**
 * Helper de alto nivel: crea la playlist y le anade los tracks de una.
 * Devuelve un CreatedPlaylist listo para mostrar al usuario.
 */
export async function createPlaylistWithTracks(args: {
  accessToken: string;
  name: string;
  description: string;
  uris: readonly string[];
}): Promise<CreatedPlaylist> {
  const playlist = await createPlaylist(args.accessToken, args.name, args.description);
  if (args.uris.length > 0) {
    await addTracksToPlaylist(args.accessToken, playlist.id, args.uris);
  }
  return {
    id: playlist.id,
    name: playlist.name,
    externalUrl: playlist.externalUrl,
    trackCount: args.uris.length,
  };
}
