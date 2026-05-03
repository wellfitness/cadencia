/**
 * Resolucion del Client ID activo de Spotify, con cascada de prioridad:
 *
 *   1. Client ID custom guardado por el usuario (BYOC, localStorage)
 *   2. VITE_SPOTIFY_CLIENT_ID del build (fallback para los testers conocidos)
 *   3. null  → la UI debe abrir el modal BYOC pidiendo configurarlo
 *
 * Por que existe el modelo BYOC:
 * Spotify endurecio Extended Quota Mode el 15-mayo-2025 (>=250k MAU + empresa
 * registrada + revenue). Development Mode quedo limitado a 5 testers por
 * Client ID. Cadencia es un proyecto open source sin SL ni monetizacion, asi
 * que la unica via de uso publico es que cada usuario cree SU PROPIO Client
 * ID (3 minutos en developer.spotify.com) y lo pegue en la app. Cada usuario
 * es entonces dueno de su propia quota de Development Mode.
 *
 * El Client ID custom vive en localStorage (no sessionStorage): debe
 * persistir entre sesiones, el usuario solo lo configura una vez. NO se
 * sincroniza con Drive: es per-device, cada navegador puede tener su
 * propia app de Spotify registrada.
 */

const CUSTOM_CLIENT_ID_KEY = 'cadencia:spotify:custom-client-id:v1';

/**
 * Formato canonico de Client ID de Spotify: 32 chars hexadecimales (16 bytes
 * en hex). Validado tanto al pegar en la UI como al leer de localStorage,
 * para descartar valores corruptos o pegados con espacios sobrantes.
 */
const CLIENT_ID_REGEX = /^[a-f0-9]{32}$/i;

/**
 * Devuelve true si el string tiene el formato canonico de un Client ID de
 * Spotify (32 chars hex). Util para validacion inline en formularios.
 */
export function isValidClientIdFormat(value: string): boolean {
  return CLIENT_ID_REGEX.test(value);
}

function safeLocalGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Silencioso: el flujo OAuth no podra arrancar pero la app sigue.
  }
}

function safeLocalRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Lee el Client ID custom que el usuario haya guardado (BYOC). Devuelve null
 * si no hay ninguno o si el valor guardado esta corrupto (no pasa el regex).
 *
 * Devuelve siempre el id en lowercase (Spotify usa lowercase canonicamente y
 * `setStoredClientId` ya normaliza al guardar; este lowercase aqui cubre
 * tambien valores legacy escritos antes de la normalizacion).
 */
export function getStoredClientId(): string | null {
  const raw = safeLocalGet(CUSTOM_CLIENT_ID_KEY);
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (!CLIENT_ID_REGEX.test(normalized)) return null;
  return normalized;
}

/**
 * Persiste el Client ID custom en localStorage. Lanza si:
 * - el formato no es valido (regex 32 hex), para que la UI muestre error inline.
 * - el navegador bloquea localStorage (Safari modo privado, WebView restringida)
 *   y el valor no llega a persistir. Sin esta segunda comprobacion el usuario
 *   teclearia su id, el modal se cerraria, y al reintentar OAuth la cascada
 *   devolveria null otra vez — modal infinito sin explicacion.
 *
 * Normaliza a lowercase antes de guardar: Spotify devuelve los Client IDs en
 * lowercase pero por si acaso el usuario pega uno con mayusculas, queda
 * consistente.
 */
export function setStoredClientId(value: string): void {
  const normalized = value.trim().toLowerCase();
  if (!CLIENT_ID_REGEX.test(normalized)) {
    throw new Error('El Client ID debe ser 32 caracteres hexadecimales');
  }
  safeLocalSet(CUSTOM_CLIENT_ID_KEY, normalized);
  // Verificacion read-after-write: si safeLocalSet fallo silenciosamente
  // (Safari private, WebView restringida, cuota llena), el read siguiente
  // devolvera null o el valor anterior. Lanzamos error explicito para que
  // la UI lo presente al usuario.
  const persisted = safeLocalGet(CUSTOM_CLIENT_ID_KEY);
  if (persisted === null || persisted.trim().toLowerCase() !== normalized) {
    throw new Error(
      'No se pudo guardar el Client ID en este navegador. Comprueba que tienes el almacenamiento local habilitado (los modos privados de algunos navegadores lo bloquean).',
    );
  }
}

/**
 * Borra el Client ID custom. La proxima resolucion volvera al fallback de
 * `VITE_SPOTIFY_CLIENT_ID` (si existe) o devolvera null.
 */
export function clearStoredClientId(): void {
  safeLocalRemove(CUSTOM_CLIENT_ID_KEY);
}

/**
 * Lee VITE_SPOTIFY_CLIENT_ID del build. Es el fallback para los testers
 * conocidos del Development Mode de Elena: si no han configurado su propio
 * Client ID, usan el suyo y todo sigue funcionando como antes del pivote
 * a BYOC.
 *
 * Devuelve null si la variable de entorno no esta definida o esta vacia
 * (caso self-host BYOC puro: el operador del repo no quiere ofrecer ningun
 * fallback compartido).
 */
function getBuildClientId(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env['VITE_SPOTIFY_CLIENT_ID'];
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return raw.trim();
}

/**
 * Origen del Client ID resuelto, util para que la UI ramifique mensajes:
 * - el modal de 403 dice cosas distintas si el problema viene del Client ID
 *   compartido ("no estas en mi lista de testers, configura el tuyo") o del
 *   custom del usuario ("anade tu cuenta a Users and Access en TU app").
 * - la seccion de preferencias muestra el estado actual.
 */
export type ClientIdSource = 'custom' | 'default';

export interface ResolvedClientId {
  clientId: string;
  source: ClientIdSource;
}

/**
 * Resuelve el Client ID activo aplicando la cascada custom > default > null.
 * Devuelve tanto el id como el origen para que la UI pueda discriminar.
 */
export function resolveActiveClientId(): ResolvedClientId | null {
  const stored = getStoredClientId();
  if (stored !== null) {
    return { clientId: stored, source: 'custom' };
  }
  const build = getBuildClientId();
  if (build !== null) {
    return { clientId: build, source: 'default' };
  }
  return null;
}

/**
 * Helper compatible con el call site historico de `getSpotifyClientId()`,
 * que solo necesita el string del id sin importarle el origen. Ahorra
 * destructuring en los call sites donde el origen no se usa (callback OAuth,
 * polling del Modo TV).
 */
export function getSpotifyClientId(): string | null {
  return resolveActiveClientId()?.clientId ?? null;
}
