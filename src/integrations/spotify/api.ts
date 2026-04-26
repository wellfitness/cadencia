import type { CreatedPlaylist, SpotifyUser } from './types';

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
    let detail = `${res.status}`;
    try {
      const json: unknown = await res.json();
      if (isSpotifyErrorResponse(json)) {
        detail = `${res.status} ${json.error.message}`;
      }
    } catch {
      // sin body parseable, dejamos solo el status
    }
    throw new Error(`Spotify API ${detail}`);
  }
  return res;
}

interface SpotifyMe {
  id: string;
  display_name: string | null;
}

function isSpotifyMe(v: unknown): v is SpotifyMe {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['id'] === 'string';
}

export async function getCurrentUser(accessToken: string): Promise<SpotifyUser> {
  const res = await fetchSpotify(accessToken, '/me');
  const json: unknown = await res.json();
  if (!isSpotifyMe(json)) {
    throw new Error('Spotify /me devolvio una respuesta inesperada');
  }
  return {
    id: json.id,
    displayName: typeof json.display_name === 'string' ? json.display_name : null,
  };
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

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
): Promise<{ id: string; externalUrl: string; name: string }> {
  const res = await fetchSpotify(accessToken, `/users/${encodeURIComponent(userId)}/playlists`, {
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
  userId: string;
  name: string;
  description: string;
  uris: readonly string[];
}): Promise<CreatedPlaylist> {
  const playlist = await createPlaylist(
    args.accessToken,
    args.userId,
    args.name,
    args.description,
  );
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
