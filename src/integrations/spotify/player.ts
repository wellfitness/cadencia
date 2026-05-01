/**
 * Wrapper REST sobre los endpoints `/v1/me/player/*` de Spotify Web API.
 * Permite controlar la reproduccion (play/pause/next) en cualquier dispositivo
 * Spotify activo del usuario (movil, ordenador, smart speaker) desde Cadencia.
 *
 * **Alcance V1**: solo control via REST. Spotify sigue reproduciendo en su
 * propia app/dispositivo; Cadencia no es el reproductor (eso requeriria el
 * Web Playback SDK que aplazamos por incompatibilidad iOS Safari).
 *
 * **Premium gating**: TODOS estos endpoints devuelven 403 si la cuenta no es
 * Premium. La UI debe haber filtrado `productPremium` antes de invocarlos.
 *
 * **Diseno de errores**: en vez de `throw`, devolvemos `PlayerResult<T>` con
 * un codigo discriminado. La UI decide como degradar:
 *   - `no-active-device`: mostrar "Abre Spotify en tu movil/ordenador"
 *   - `not-premium`: usuario perdio Premium en mitad de sesion → ocultar UI
 *   - `token-expired`: 401, el caller deberia refrescar el token y reintentar
 *   - `network`: error de red, reintento exponencial razonable
 *   - `unknown`: HTTP 4xx/5xx no clasificable, mostrar mensaje generico
 *
 * Endpoints documentados:
 *   https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 */

const API_BASE = 'https://api.spotify.com/v1';

/**
 * Resultado del control del player. Discriminacion explicita para que la UI
 * haga `switch` sin parsear strings.
 */
export type PlayerResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: PlayerError };

export type PlayerError =
  | { kind: 'no-active-device' }
  | { kind: 'not-premium' }
  | { kind: 'token-expired' }
  | { kind: 'network'; message: string; method?: string; path?: string }
  | { kind: 'unknown'; status: number; message: string; method?: string; path?: string };

/**
 * Estado actual del reproductor del usuario. Modelo minimo: solo lo que el
 * Modo TV necesita para sincronizar el timer con la realidad de Spotify.
 *
 * `device` puede ser null si Spotify no tiene ningun dispositivo activo
 * (ningun cliente Spotify abierto). En ese caso casi todo lo demas es null.
 */
export interface PlayerState {
  isPlaying: boolean;
  /** URI del track actual (`spotify:track:XXX`) o null si no hay track. */
  currentTrackUri: string | null;
  /** Posicion en milisegundos dentro del track actual, o null. */
  positionMs: number | null;
  device: PlayerDevice | null;
}

export interface PlayerDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface RawDevice {
  id?: string;
  name?: string;
  type?: string;
  is_active?: boolean;
}

interface RawPlayerState {
  is_playing?: boolean;
  progress_ms?: number | null;
  item?: { uri?: string } | null;
  device?: RawDevice | null;
}

function isRawPlayerState(v: unknown): v is RawPlayerState {
  return typeof v === 'object' && v !== null;
}

function parseDevice(raw: RawDevice | null | undefined): PlayerDevice | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    type: typeof raw.type === 'string' ? raw.type : 'Unknown',
    isActive: raw.is_active === true,
  };
}

/**
 * Mapea HTTP status + body a un PlayerError. Reglas extraidas de la doc de
 * Spotify y de pruebas en cuentas Free vs Premium con/sin device activo.
 *
 * Para los kinds reportables (`network`, `unknown`) propagamos `method` y
 * `path` ademas del status y el detalle, para que la UI pueda mostrar al
 * usuario un mensaje copiable al portapapeles que sirva para reportar el
 * fallo (ej. "Spotify API 502 en PUT /me/player/play: Bad Gateway").
 */
async function classifyError(
  res: Response,
  method: string,
  path: string,
): Promise<PlayerError> {
  if (res.status === 401) return { kind: 'token-expired' };
  // 404 en /me/player y /me/player/play significa "no hay device activo".
  // En otros endpoints 404 podria ser "playlist no existe" pero aqui solo
  // tocamos /me/player/*, asi que la inferencia es segura.
  if (res.status === 404) return { kind: 'no-active-device' };
  if (res.status === 403) {
    // 403 puede ser:
    //   - PREMIUM_REQUIRED: cuenta no Premium
    //   - User not registered in Developer Dashboard (raro tras OAuth ok)
    // Leemos el body para distinguir.
    const body = await res.text().catch(() => '');
    if (body.toLowerCase().includes('premium')) return { kind: 'not-premium' };
    return {
      kind: 'unknown',
      status: 403,
      message: body.slice(0, 200) || 'Forbidden',
      method,
      path,
    };
  }
  const body = await res.text().catch(() => '');
  return {
    kind: 'unknown',
    status: res.status,
    message: body.slice(0, 200) || res.statusText,
    method,
    path,
  };
}

async function callPlayer(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<PlayerResult<Response>> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = init.method ?? 'GET';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    if (typeof console !== 'undefined') {
      console.error('[Spotify Player network]', { method, path, message });
    }
    return { ok: false, error: { kind: 'network', message, method, path } };
  }
  // Spotify usa 204 No Content para play/pause/next/previous con exito.
  // 200 OK con body para getPlayerState. 202 Accepted para algunas
  // transferencias asincronas. Todos son "ok" desde el punto de vista de la
  // API; solo 4xx/5xx son errores reales.
  if (!res.ok) {
    const error = await classifyError(res, method, path);
    if (typeof console !== 'undefined' && (error.kind === 'unknown' || error.kind === 'not-premium')) {
      console.error('[Spotify Player error]', {
        status: res.status,
        method,
        path,
        error,
      });
    }
    return { ok: false, error };
  }
  return { ok: true, value: res };
}

/**
 * Lee el estado actual del reproductor.
 *
 * Endpoint: `GET /v1/me/player`. Devuelve 204 No Content cuando el usuario
 * no esta reproduciendo nada (ningun device activo). Lo modelamos como
 * `device: null, isPlaying: false, ...` en lugar de error para que la UI
 * sepa "no hay nada sonando" sin condicionales raros.
 *
 * Requiere scope `user-read-playback-state`.
 */
export async function getPlayerState(accessToken: string): Promise<PlayerResult<PlayerState>> {
  const result = await callPlayer(accessToken, '/me/player');
  if (!result.ok) return result;
  // 204 = nothing playing, no body
  if (result.value.status === 204) {
    return {
      ok: true,
      value: { isPlaying: false, currentTrackUri: null, positionMs: null, device: null },
    };
  }
  let json: unknown;
  try {
    json = await result.value.json();
  } catch {
    return { ok: false, error: { kind: 'unknown', status: 200, message: 'Invalid JSON' } };
  }
  if (!isRawPlayerState(json)) {
    return {
      ok: false,
      error: { kind: 'unknown', status: 200, message: 'Unexpected /me/player shape' },
    };
  }
  return {
    ok: true,
    value: {
      isPlaying: json.is_playing === true,
      currentTrackUri:
        typeof json.item?.uri === 'string' ? json.item.uri : null,
      positionMs: typeof json.progress_ms === 'number' ? json.progress_ms : null,
      device: parseDevice(json.device),
    },
  };
}

/**
 * Lista los dispositivos Spotify del usuario (activos e inactivos). Util
 * para que la UI ofrezca "transferir reproduccion a este dispositivo" si
 * el usuario tiene Spotify abierto pero idle en otro sitio.
 *
 * Endpoint: `GET /v1/me/player/devices`.
 */
export async function getDevices(accessToken: string): Promise<PlayerResult<PlayerDevice[]>> {
  const result = await callPlayer(accessToken, '/me/player/devices');
  if (!result.ok) return result;
  let json: unknown;
  try {
    json = await result.value.json();
  } catch {
    return { ok: false, error: { kind: 'unknown', status: 200, message: 'Invalid JSON' } };
  }
  if (typeof json !== 'object' || json === null) {
    return {
      ok: false,
      error: { kind: 'unknown', status: 200, message: 'Unexpected /devices shape' },
    };
  }
  const rawDevices = (json as { devices?: unknown }).devices;
  if (!Array.isArray(rawDevices)) {
    return { ok: true, value: [] };
  }
  const devices: PlayerDevice[] = [];
  for (const d of rawDevices) {
    const parsed = parseDevice(d as RawDevice);
    if (parsed !== null) devices.push(parsed);
  }
  return { ok: true, value: devices };
}

/**
 * Inicia reproduccion. Tres modos de uso:
 *   - `play(token)`: reanuda lo que estuviera pausado.
 *   - `play(token, {uris: [...]})`: empieza a reproducir UNA o varias URIs
 *     concretas. Cadencia usa este caso al cambiar de bloque.
 *   - `play(token, {deviceId})`: cambia el device antes de reproducir.
 *
 * Endpoint: `PUT /v1/me/player/play`.
 *
 * Spotify devuelve 204 No Content cuando hay device activo y la peticion
 * se acepta. 404 cuando no hay device activo (la app debe ofrecer al
 * usuario "abre Spotify"). 403 si la cuenta no es Premium.
 *
 * `position_ms`: opcional para empezar el track en un punto concreto.
 * Cadencia no lo usa por defecto (siempre desde el principio del bloque).
 */
export async function play(
  accessToken: string,
  options: PlayOptions = {},
): Promise<PlayerResult> {
  const path = options.deviceId !== undefined
    ? `/me/player/play?device_id=${encodeURIComponent(options.deviceId)}`
    : '/me/player/play';
  const body: Record<string, unknown> = {};
  if (options.uris !== undefined && options.uris.length > 0) body['uris'] = options.uris;
  if (options.contextUri !== undefined) body['context_uri'] = options.contextUri;
  if (options.positionMs !== undefined) body['position_ms'] = options.positionMs;
  const init: RequestInit = { method: 'PUT' };
  if (Object.keys(body).length > 0) init.body = JSON.stringify(body);
  const result = await callPlayer(accessToken, path, init);
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export interface PlayOptions {
  /** Lista de URIs `spotify:track:XXX` a reproducir. Si solo hay una, ignora cola. */
  uris?: readonly string[];
  /** Context URI: playlist, album, artist (`spotify:playlist:XXX`). */
  contextUri?: string;
  /** Posicion inicial en ms dentro del primer track. */
  positionMs?: number;
  /** Forzar el device sobre el que reproducir. */
  deviceId?: string;
}

/**
 * Pausa la reproduccion actual.
 * Endpoint: `PUT /v1/me/player/pause`.
 */
export async function pause(accessToken: string, deviceId?: string): Promise<PlayerResult> {
  const path = deviceId !== undefined
    ? `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`
    : '/me/player/pause';
  const result = await callPlayer(accessToken, path, { method: 'PUT' });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

/**
 * Salta al siguiente track de la cola.
 * Endpoint: `POST /v1/me/player/next`.
 */
export async function next(accessToken: string, deviceId?: string): Promise<PlayerResult> {
  const path = deviceId !== undefined
    ? `/me/player/next?device_id=${encodeURIComponent(deviceId)}`
    : '/me/player/next';
  const result = await callPlayer(accessToken, path, { method: 'POST' });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

/**
 * Vuelve al track anterior. Spotify aplica su regla "si llevas >3s del
 * track actual, te lleva al inicio del track actual; si <3s, al anterior".
 * No tenemos forma de forzar siempre "anterior". El usuario lo entiende.
 *
 * Endpoint: `POST /v1/me/player/previous`.
 */
export async function previous(accessToken: string, deviceId?: string): Promise<PlayerResult> {
  const path = deviceId !== undefined
    ? `/me/player/previous?device_id=${encodeURIComponent(deviceId)}`
    : '/me/player/previous';
  const result = await callPlayer(accessToken, path, { method: 'POST' });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

/**
 * Transfiere la reproduccion a un device especifico. Util cuando hay un
 * device disponible pero no activo (el usuario tiene Spotify abierto en el
 * movil pero esta idle).
 *
 * Endpoint: `PUT /v1/me/player`.
 *
 * `play=true` arranca la reproduccion automaticamente al transferir; con
 * `false` el device queda activo pero pausado.
 */
export async function transferPlayback(
  accessToken: string,
  deviceId: string,
  play: boolean,
): Promise<PlayerResult> {
  const result = await callPlayer(accessToken, '/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
