import type { SpotifyAuthFlowState, SpotifyTokens } from './types';

/**
 * Wrapper de sessionStorage para el state OAuth y los tokens.
 * Mismo patron que core/user/storage.ts: try/catch global, devuelve null
 * en caso de error (Safari modo privado, WebView restringida).
 *
 * Por que sessionStorage y NO localStorage:
 * Reglas de privacidad de CLAUDE.md: ningun token vive mas alla de la pestana.
 */

const FLOW_KEY = 'cadencia:spotify:authFlow:v1';
const TOKENS_KEY = 'cadencia:spotify:tokens:v1';

// Keys del rebrand previo (Vatios → Cadencia). Las leemos como fallback para
// que un usuario con el flow OAuth a medio completar tras una actualizacion
// de la app no pierda la sesion en curso. Despues de leer, migramos al
// nombre nuevo y borramos la vieja.
const LEGACY_FLOW_KEY = 'vatios:spotify:authFlow:v1';
const LEGACY_TOKENS_KEY = 'vatios:spotify:tokens:v1';

function isStringField(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isAuthFlowState(v: unknown): v is SpotifyAuthFlowState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isStringField(o['codeVerifier']) && isStringField(o['state']);
}

function isTokens(v: unknown): v is SpotifyTokens {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    isStringField(o['accessToken']) &&
    isStringField(o['refreshToken']) &&
    typeof o['expiresAtMs'] === 'number' &&
    typeof o['scope'] === 'string'
  );
}

function safeGet(key: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  } catch {
    // Silencioso: el usuario sigue trabajando en memoria si falla.
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function saveAuthFlow(flow: SpotifyAuthFlowState): void {
  safeSet(FLOW_KEY, JSON.stringify(flow));
}

/**
 * Lee la key actual; si esta vacia, intenta la legacy y migra.
 */
function readAndMigrate(currentKey: string, legacyKey: string): string | null {
  const current = safeGet(currentKey);
  if (current !== null) return current;
  const legacy = safeGet(legacyKey);
  if (legacy === null) return null;
  safeSet(currentKey, legacy);
  safeRemove(legacyKey);
  return legacy;
}

export function loadAuthFlow(): SpotifyAuthFlowState | null {
  const raw = readAndMigrate(FLOW_KEY, LEGACY_FLOW_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAuthFlowState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAuthFlow(): void {
  safeRemove(FLOW_KEY);
  safeRemove(LEGACY_FLOW_KEY);
}

export function saveTokens(tokens: SpotifyTokens): void {
  safeSet(TOKENS_KEY, JSON.stringify(tokens));
}

export function loadTokens(): SpotifyTokens | null {
  const raw = readAndMigrate(TOKENS_KEY, LEGACY_TOKENS_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTokens(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  safeRemove(TOKENS_KEY);
  safeRemove(LEGACY_TOKENS_KEY);
}

/**
 * True si los tokens existen y el accessToken aun no ha expirado (con un
 * margen de 30s para evitar requests con un token a punto de morir).
 */
export function tokensAreFresh(tokens: SpotifyTokens, nowMs: number = Date.now()): boolean {
  return tokens.expiresAtMs > nowMs + 30_000;
}
