/**
 * Lee VITE_SPOTIFY_CLIENT_ID de las variables de Vite.
 * Centralizado para que la UI haga un unico check.
 *
 * Devuelve null si no esta definida o esta vacia. La UI mostrara entonces
 * el mensaje "Configura tu Client ID" con instrucciones, en lugar de
 * intentar arrancar un OAuth que va a fallar.
 */
export function getSpotifyClientId(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env['VITE_SPOTIFY_CLIENT_ID'];
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return raw.trim();
}
