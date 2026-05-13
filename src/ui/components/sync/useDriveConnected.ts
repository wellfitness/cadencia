import { useEffect, useState } from 'react';
import { isConnected } from '@integrations/gdrive/sync';

/**
 * Hook reactivo al estado de conexion con Drive. Devuelve true si la
 * sincronizacion esta activa, escuchando el evento `gdrive-sync-status`
 * que el motor de sync emite en cada cambio (connect/disconnect, token
 * expirado, error).
 *
 * Util en componentes que deben reaccionar al connect/disconnect sin
 * remontaje: por ejemplo, App.tsx promociona la persistencia local
 * cuando Drive se conecta (Drive sincroniza == datos deben sobrevivir
 * al cierre de pestana, o el sync no tendria sentido).
 */
export function useDriveConnected(): boolean {
  const [connected, setConnected] = useState<boolean>(() => isConnected());
  useEffect(() => {
    const handler = (): void => setConnected(isConnected());
    window.addEventListener('gdrive-sync-status', handler);
    return () => window.removeEventListener('gdrive-sync-status', handler);
  }, []);
  return connected;
}
