/**
 * Configuracion del modulo de sync con Google Drive.
 *
 * Scope minimo `drive.appdata`: carpeta oculta del propio usuario,
 * invisible incluso para el en su Drive UI normal. Solo Cadencia (con
 * este Client ID) puede leer y escribir en ella, y solo en su cuenta.
 * No requiere verificacion de Google porque es "non-sensitive".
 */
function readClientId(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env['VITE_GOOGLE_CLIENT_ID'];
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export const GDRIVE_CONFIG = {
  /** Scope minimo: carpeta oculta de la app, invisible en Drive del usuario. */
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  /** Nombre del unico archivo que la app crea en appDataFolder. */
  FILE_NAME: 'cadencia_data.json',
  /** Client ID Web inyectado por Vite desde .env.local */
  CLIENT_ID: readClientId(),
  /** API endpoints */
  API_FILES: 'https://www.googleapis.com/drive/v3/files',
  API_UPLOAD: 'https://www.googleapis.com/upload/drive/v3',
  /** Esperar 2s tras ultimo cambio antes de hacer push (debounce). */
  DEBOUNCE_MS: 2000,
  /** Tiempo minimo entre push consecutivos para no saturar la API. */
  SYNC_COOLDOWN_MS: 5000,
  /** Frecuencia con la que se comprueba si hay cambios remotos. */
  POLL_INTERVAL_MS: 30000,
} as const;

/** Si la app fue desplegada con Client ID configurado. */
export function isConfigured(): boolean {
  return GDRIVE_CONFIG.CLIENT_ID.length > 0;
}
