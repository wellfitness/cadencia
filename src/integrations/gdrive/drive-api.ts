import { GDRIVE_CONFIG } from './config';
import type { SyncedData } from '@core/sync/types';

/**
 * Cliente REST puro de Google Drive API v3 contra `appDataFolder`.
 * Sin SDK pesado: solo `fetch()`. Incluye retry automatico en 401 si
 * hay token refresher inyectado (sync.ts registra uno al inicializar).
 */

const { API_FILES, API_UPLOAD, FILE_NAME } = GDRIVE_CONFIG;

let _tokenRefresher: (() => Promise<string | null>) | null = null;

/**
 * Inyecta la funcion que refresca el token cuando llega 401. Sync la
 * registra en init() para evitar dependencia circular auth <-> drive-api.
 */
export function setTokenRefresher(fn: (() => Promise<string | null>) | null): void {
  _tokenRefresher = fn;
}

export class DriveApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

async function fetchWithAuth(
  url: string,
  options: RequestInit,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  // Nunca cachear: la API de Drive devuelve 304 con CDN si lo permitimos,
  // ocultando cambios reales tras el sync.
  const opts: RequestInit = { ...options, headers, cache: 'no-store' };

  let res = await fetch(url, opts);

  if (res.status === 401 && _tokenRefresher) {
    const newToken = await _tokenRefresher();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...opts, headers });
    }
  }

  if (!res.ok) {
    throw new DriveApiError(`Drive API ${res.status}: ${res.statusText}`, res.status);
  }
  return res;
}

export interface DriveFileMeta {
  id: string;
  name?: string;
  version: string;
  modifiedTime?: string;
}

/** Busca el archivo de Cadencia en appDataFolder. Devuelve null si no existe. */
export async function findFile(accessToken: string): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}'`,
    fields: 'files(id,name,modifiedTime,version)',
    pageSize: '1',
  });
  const res = await fetchWithAuth(`${API_FILES}?${params.toString()}`, {}, accessToken);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files && data.files.length > 0 ? data.files[0]! : null;
}

/** Descarga el contenido completo del archivo como SyncedData. */
export async function readFile(accessToken: string, fileId: string): Promise<SyncedData> {
  const res = await fetchWithAuth(`${API_FILES}/${fileId}?alt=media`, {}, accessToken);
  return res.json() as Promise<SyncedData>;
}

/**
 * Lee solo metadata del archivo (id, version, modifiedTime). Llamada
 * ligera (~200 bytes) usada por el polling para detectar cambios sin
 * descargar el archivo completo.
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileMeta> {
  const res = await fetchWithAuth(
    `${API_FILES}/${fileId}?fields=id,version,modifiedTime`,
    {},
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}

const BOUNDARY = 'cadencia_drive_boundary';

function buildMultipartBody(metadata: object, data: SyncedData): string {
  return [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(data),
    `--${BOUNDARY}--`,
  ].join('\r\n');
}

/** Crea por primera vez el archivo en appDataFolder. */
export async function createFile(
  accessToken: string,
  data: SyncedData,
): Promise<DriveFileMeta> {
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const body = buildMultipartBody(metadata, data);
  const res = await fetchWithAuth(
    `${API_UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime,version`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}

/**
 * Sobrescribe el contenido del archivo existente. La API devuelve la
 * nueva `version` que el caller cachea para detectar colisiones futuras.
 */
export async function updateFile(
  accessToken: string,
  fileId: string,
  data: SyncedData,
): Promise<DriveFileMeta> {
  const metadata = { mimeType: 'application/json' };
  const body = buildMultipartBody(metadata, data);
  const res = await fetchWithAuth(
    `${API_UPLOAD}/files/${fileId}?uploadType=multipart&fields=id,modifiedTime,version`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}
