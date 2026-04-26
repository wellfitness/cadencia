import type { CreatedPlaylist } from './types';

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
        method: init.method ?? 'GET',
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
    throw new Error(`Spotify API ${res.status}: ${detail}`);
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

/**
 * Crea una playlist en la cuenta del token.
 *
 * Notas de la API de Spotify (Dev Mode hardening 2025):
 *
 * 1. Usa `POST /v1/me/playlists` (no `/users/{id}/playlists`). El endpoint
 *    con `user_id` explicito devuelve 403 silencioso aunque token, scope y
 *    user_id sean validos. El endpoint `/me/playlists` deduce el dueno del
 *    token y no aplica esa restriccion.
 *
 * 2. `public: false` es ignorado en silencio: la respuesta inmediata dice
 *    `public:false` pero un GET a la misma playlist devuelve `public:true`,
 *    y un PUT con `public:false` no la convierte. Por eso el cliente debe
 *    pedir tambien scope `playlist-modify-public` (sino el POST a
 *    /playlists/{id}/tracks devuelve 403). Mantenemos `public:false` aqui
 *    por intencion documental: si Spotify revierte la restriccion en el
 *    futuro funcionara como queremos sin cambiar codigo.
 */
export async function createPlaylist(
  accessToken: string,
  name: string,
  description: string,
): Promise<{ id: string; externalUrl: string; name: string }> {
  const res = await fetchSpotify(accessToken, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
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
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: readonly string[],
): Promise<void> {
  for (let i = 0; i < uris.length; i += ADD_TRACKS_BATCH_SIZE) {
    const batch = uris.slice(i, i + ADD_TRACKS_BATCH_SIZE);
    await fetchSpotify(accessToken, `/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
  }
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
