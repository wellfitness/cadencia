import { useEffect, useState } from 'react';
import {
  connect,
  disconnect,
  isConnected,
  getSyncInfo,
  init,
} from '@integrations/gdrive/sync';
import { isConfigured } from '@integrations/gdrive/config';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SyncStatusBadge } from './SyncStatusBadge';

/**
 * Tarjeta opt-in para conectar Google Drive y sincronizar datos entre
 * dispositivos. Renderiza un placeholder cuando VITE_GOOGLE_CLIENT_ID
 * no esta configurado en el deploy.
 *
 * El boton dispara `connect()` que abre el popup OAuth de Google.
 * Tras OK, el badge cambia a "Sincronizado" y los cambios futuros del
 * cadenciaStore viajan a Drive automaticamente.
 */
export function GoogleSyncCard(): JSX.Element {
  const [connected, setConnected] = useState<boolean>(() => isConnected());
  const [email, setEmail] = useState<string>(() => getSyncInfo().email ?? '');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, []);

  if (!isConfigured()) {
    return (
      <div className="rounded-xl border border-gris-200 bg-white p-4">
        <h3 className="font-display text-base text-gris-800 flex items-center gap-2">
          <MaterialIcon name="cloud_off" size="small" className="text-gris-500" />
          Sincronizar con Google Drive
        </h3>
        <p className="text-sm text-gris-600 mt-2">
          Sincronización con Google Drive no configurada en este despliegue.
        </p>
      </div>
    );
  }

  const handleConnect = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await Promise.race([
        connect(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('La conexión tardó demasiado. Inténtalo de nuevo.')),
            30_000,
          ),
        ),
      ]);
      setConnected(true);
      setEmail(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con Google');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    if (
      !window.confirm(
        '¿Desconectar Google Drive? Tus datos en Drive permanecen intactos en tu cuenta. Tus datos en este navegador tampoco se borran. Solo se desactiva la sincronización.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await Promise.race([
        disconnect(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('La desconexión tardó demasiado. Inténtalo de nuevo.')),
            15_000,
          ),
        ),
      ]);
      setConnected(false);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gris-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base text-gris-800 flex items-center gap-2">
          <MaterialIcon name="cloud_sync" size="small" className="text-turquesa-600" />
          Sincronizar con Google Drive
        </h3>
        <SyncStatusBadge />
      </div>
      <p className="text-sm text-gris-600">
        Opcional. Tus ajustes (peso, FTP, FC, preferencias musicales y sesiones
        guardadas) viajan en una carpeta privada de tu propio Drive — invisible para
        nosotros. Cadencia funciona igual sin esto.
      </p>
      {connected ? (
        <div className="space-y-2">
          <p className="text-sm text-gris-700">
            Conectado como <strong>{email || 'tu cuenta de Google'}</strong>.
          </p>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={busy}
            className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 disabled:opacity-50 min-h-[44px] text-sm"
          >
            {busy ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-turquesa-600 text-white hover:bg-turquesa-700 disabled:opacity-50 min-h-[44px] text-sm font-medium inline-flex items-center gap-2"
        >
          <MaterialIcon name="login" size="small" />
          {busy ? 'Conectando…' : 'Conectar mi Google Drive'}
        </button>
      )}
      {error && (
        <p className="text-sm text-rosa-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
