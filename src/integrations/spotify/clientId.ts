/**
 * Resolucion del Client ID de Spotify (modelo BYOC puro):
 *
 *   1. Client ID custom guardado por el usuario en localStorage → lo usamos
 *   2. Si no hay → null → la UI debe abrir el modal BYOC pidiendo configurarlo
 *
 * Por que solo BYOC (sin fallback compartido):
 * Spotify endurecio Extended Quota Mode el 15-mayo-2025 (>=250k MAU + empresa
 * registrada + revenue). Development Mode quedo limitado a 5 testers por
 * Client ID. El modelo "1 Client ID compartido por todos los usuarios"
 * obligaria al operador del repo a curar manualmente una lista de 5 cuentas.
 * En BYOC puro cada usuario es dueno de su propia app de Spotify (3 min en
 * developer.spotify.com) y de sus propios 5 huecos de testers — sin cuello
 * de botella ni dependencia de un mantenedor central.
 *
 * El Client ID custom vive en localStorage (no sessionStorage): debe persistir
 * entre sesiones, el usuario solo lo configura una vez. NO se sincroniza con
 * Drive: es per-device, cada navegador puede tener su propia app de Spotify
 * registrada.
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
 * Borra el Client ID custom. La proxima resolucion devolvera null y la UI
 * debe abrir el modal BYOC para reconfigurar.
 */
export function clearStoredClientId(): void {
  safeLocalRemove(CUSTOM_CLIENT_ID_KEY);
}

/**
 * Helper compatible con el call site historico de `getSpotifyClientId()`.
 * En el modelo BYOC puro es equivalente a `getStoredClientId()`, pero
 * mantenemos el nombre por consistencia con los call sites existentes
 * (callback OAuth, polling del Modo TV) que solo necesitan el string sin
 * importarles de donde viene.
 */
export function getSpotifyClientId(): string | null {
  return getStoredClientId();
}
