import { GDRIVE_CONFIG } from './config';

/**
 * Autenticacion OAuth2 con Google Identity Services (GIS) en flow popup.
 *
 * No usa SDK pesado: solo el script GIS (cargado en index.html) y APIs
 * basicas. PKCE no es necesario aqui — GIS gestiona el flow implicit
 * (token directo, sin authorization code) que es seguro para SPAs con
 * scope `drive.appdata`.
 *
 * Tokens cacheados en localStorage con expiry 5 minutos antes del real
 * para evitar 401 racy durante peticiones en vuelo.
 */

const TOKEN_KEY = 'cadencia:gdrive:token';
const TOKEN_EXPIRY_KEY = 'cadencia:gdrive:tokenExpiry';
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

interface GoogleAccountsOauth2 {
  initTokenClient: (config: TokenClientConfig) => TokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface SignInResult {
  token: string;
  email: string;
}

/**
 * Devuelve el namespace OAuth2 de GIS con tipos explicitos. El global
 * `window.google` lo declara la libreria GIS sin tipos, asi que casteamos
 * a nuestros interfaces aqui — un solo punto de entrada controlado.
 */
function getOauth2(): GoogleAccountsOauth2 {
  if (typeof window === 'undefined') {
    throw new Error('Window no disponible (SSR).');
  }
  const w = window as unknown as { google?: { accounts?: { oauth2?: unknown } } };
  const oauth2 = w.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error(
      'Google Identity Services no cargado. Verifica el script en index.html.',
    );
  }
  return oauth2 as GoogleAccountsOauth2;
}

/**
 * Inicia sesion interactiva. Abre popup de Google con consentimiento
 * (`prompt: 'consent'`). El usuario otorga acceso a la carpeta privada.
 */
export function signIn(): Promise<SignInResult> {
  return new Promise((resolve, reject) => {
    const oauth2 = getOauth2();
    const client = oauth2.initTokenClient({
      client_id: GDRIVE_CONFIG.CLIENT_ID,
      scope: GDRIVE_CONFIG.SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
          return;
        }
        const token = response.access_token;
        const expiresIn = response.expires_in || 3600;
        try {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
        } catch {
          // ignore — el token sigue valido en memoria via la promesa
        }
        void fetchUserEmail(token).then((email) => resolve({ token, email }));
      },
      error_callback: (err) => {
        reject(new Error(err.message ?? 'Error en autenticacion'));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Recupera token cacheado si sigue valido. Si expiro, intenta refresh
 * silencioso (sin popup). Si falla, devuelve null para que el caller
 * sepa que necesita reauth interactiva.
 */
export async function getTokenSilent(): Promise<string | null> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
    if (token && Date.now() < expiry - TOKEN_BUFFER_MS) return token;
  } catch {
    // ignore
  }
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

/**
 * Fuerza refresh limpiando cache y pidiendo nuevo token sin popup.
 * Si silentRefresh requiere consentimiento (cache de Google expirado),
 * fallara y devolveremos null.
 */
export async function refreshToken(): Promise<string | null> {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // ignore
  }
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

/** Revoca el token actual y limpia cache. */
export async function signOut(): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  if (token) {
    try {
      const oauth2 = getOauth2();
      const tokenStr = token;
      await new Promise<void>((resolve) => {
        oauth2.revoke(tokenStr, () => resolve());
      });
    } catch {
      // ignore — no critico (GIS no cargado o revoke fallo)
    }
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // ignore
  }
}

function silentRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth2 = getOauth2();
    const client = oauth2.initTokenClient({
      client_id: GDRIVE_CONFIG.CLIENT_ID,
      scope: GDRIVE_CONFIG.SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        try {
          localStorage.setItem(TOKEN_KEY, response.access_token);
          localStorage.setItem(
            TOKEN_EXPIRY_KEY,
            String(Date.now() + (response.expires_in || 3600) * 1000),
          );
        } catch {
          // ignore
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error('Silent refresh failed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function fetchUserEmail(token: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const info = (await res.json()) as { email?: string };
      return info.email ?? '';
    }
  } catch {
    // No critico — el email es solo para mostrarlo en la UI
  }
  return '';
}
