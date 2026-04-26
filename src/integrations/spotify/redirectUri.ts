/**
 * Devuelve el Redirect URI a usar en el flow OAuth.
 *
 * - Web (dev y prod): `${window.location.origin}/callback` ej.
 *   `http://localhost:5173/callback` o `https://vatios-con-ritmo.com/callback`.
 * - Capacitor APK: `vatiosconritmo://callback` (deep link nativo).
 *
 * El usuario debe registrar TODOS los Redirect URIs en developer.spotify.com
 * para que Spotify los acepte. Ver .env.example.
 */
const ANDROID_DEEP_LINK = 'vatiosconritmo://callback';

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
}

export function getRedirectUri(): string {
  const w = window as unknown as CapacitorWindow;
  if (w.Capacitor?.isNativePlatform?.() === true) {
    return ANDROID_DEEP_LINK;
  }
  return `${window.location.origin}/callback`;
}

export function isCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as CapacitorWindow;
  return w.Capacitor?.isNativePlatform?.() === true;
}
