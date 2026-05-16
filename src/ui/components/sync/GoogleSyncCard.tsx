import { useEffect, useState } from 'react';
import {
  connect,
  disconnect,
  isConnected,
  getSyncInfo,
  init,
  syncNow,
  getConflicts,
  clearConflicts,
  getBackup,
  clearBackup,
} from '@integrations/gdrive/sync';
import type { MergeConflict } from '@core/sync/merge';
import { isConfigured } from '@integrations/gdrive/config';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SyncStatusBadge } from './SyncStatusBadge';

/**
 * Tarjeta opt-in para conectar Google Drive y sincronizar datos entre
 * dispositivos. Renderiza un placeholder cuando VITE_GOOGLE_CLIENT_ID
 * no esta configurado en el deploy.
 *
 * El boton dispara `connect()` que abre el popup OAuth de Google. Tras OK,
 * el badge cambia a "Sincronizado" y los cambios futuros del cadenciaStore
 * viajan a Drive automaticamente.
 *
 * Cuando hay conexion activa, expone tres controles adicionales:
 *  - "Sincronizar ahora": fuerza un pull manual (util tras un import grande).
 *  - Panel de conflictos: si el merge detecto colisiones (mismo timestamp
 *    con datos distintos), se listan aqui con boton para borrar el log.
 *  - Backup pre-sync: si el ultimo sync hizo merge, guardamos snapshot del
 *    local en localStorage. El usuario puede descartarlo cuando esta seguro.
 */
export function GoogleSyncCard(): JSX.Element {
  const [connected, setConnected] = useState<boolean>(() => isConnected());
  const [email, setEmail] = useState<string>(() => getSyncInfo().email ?? '');
  const [busy, setBusy] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>(
    () => getSyncInfo().lastSyncAt,
  );
  const [conflicts, setConflicts] = useState<MergeConflict[]>(() =>
    isConnected() ? getConflicts() : [],
  );
  const [hasBackup, setHasBackup] = useState<boolean>(
    () => isConnected() && getBackup() !== null,
  );
  const [showConflicts, setShowConflicts] = useState<boolean>(false);

  useEffect(() => {
    void init();
  }, []);

  // Escucha el evento global para refrescar lastSyncAt y conflictos tras
  // cualquier cambio del motor de sync (cada pull/push, expired, error).
  useEffect(() => {
    const handler = (): void => {
      setLastSyncAt(getSyncInfo().lastSyncAt);
      if (isConnected()) {
        setConflicts(getConflicts());
        setHasBackup(getBackup() !== null);
      }
    };
    window.addEventListener('gdrive-sync-status', handler);
    return () => window.removeEventListener('gdrive-sync-status', handler);
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
    setInfo(null);
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
      setLastSyncAt(getSyncInfo().lastSyncAt);
      setConflicts(getConflicts());
      setHasBackup(getBackup() !== null);
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
    setInfo(null);
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
      setConflicts([]);
      setHasBackup(false);
      setShowConflicts(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      await syncNow();
      setLastSyncAt(getSyncInfo().lastSyncAt);
      setConflicts(getConflicts());
      setHasBackup(getBackup() !== null);
      setInfo('Sincronización completada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearConflicts = (): void => {
    clearConflicts();
    setConflicts([]);
    setShowConflicts(false);
    setInfo('Log de conflictos limpiado.');
  };

  const handleClearBackup = (): void => {
    if (
      !window.confirm(
        '¿Descartar el backup pre-sync? Es un snapshot de tus datos locales antes del último merge. Si los datos actuales se ven bien, puedes borrarlo sin problema.',
      )
    ) {
      return;
    }
    clearBackup();
    setHasBackup(false);
    setInfo('Backup descartado.');
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
        <div className="space-y-3">
          <p className="text-sm text-gris-700">
            Conectado como <strong>{email || 'tu cuenta de Google'}</strong>.
          </p>
          {lastSyncAt && (
            <p className="text-xs text-gris-500">
              Última sincronización: {formatRelativeTime(lastSyncAt)}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={busy || syncing}
              className="px-4 py-2 rounded-md border border-turquesa-600 text-turquesa-700 hover:bg-turquesa-50 disabled:opacity-50 min-h-[44px] text-sm font-medium inline-flex items-center gap-2"
            >
              <MaterialIcon name="sync" size="small" />
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={busy || syncing}
              className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 disabled:opacity-50 min-h-[44px] text-sm"
            >
              {busy ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-tulipTree-300 bg-tulipTree-50 p-3 text-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-tulipTree-900 flex items-center gap-2">
                  <MaterialIcon name="warning" size="small" className="text-tulipTree-700" />
                  <strong>{conflicts.length}</strong> conflicto(s) registrado(s) en el log.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConflicts((v) => !v)}
                  className="text-tulipTree-800 hover:text-tulipTree-900 text-xs underline"
                >
                  {showConflicts ? 'Ocultar' : 'Ver detalles'}
                </button>
              </div>
              <p className="text-tulipTree-800 text-xs">
                Un conflicto se registra cuando dos dispositivos editaron la misma sección
                con el mismo timestamp y valores distintos. Se conserva el valor remoto
                (idempotencia tras un pull) y se anota el descartado por si quieres
                revisarlo.
              </p>
              {showConflicts && (
                <ul className="space-y-1 text-xs text-tulipTree-900 max-h-48 overflow-y-auto">
                  {conflicts.slice(-20).map((c, i) => (
                    <li key={`${c.section}-${c.resolvedAt}-${i}`}>
                      <strong>{c.section}</strong> · resuelto{' '}
                      {formatRelativeTime(c.resolvedAt)}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={handleClearConflicts}
                className="text-tulipTree-800 hover:text-tulipTree-900 text-xs underline"
              >
                Limpiar log de conflictos
              </button>
            </div>
          )}

          {hasBackup && (
            <div className="rounded-md border border-gris-200 bg-gris-50 p-3 text-sm space-y-2">
              <p className="text-gris-700 flex items-center gap-2">
                <MaterialIcon name="backup" size="small" className="text-gris-600" />
                Hay un backup local pre-sync.
              </p>
              <p className="text-gris-600 text-xs">
                Snapshot de tus datos justo antes del último merge con Drive. Pensado
                como red de seguridad si un sync deja datos en peor estado del esperado.
                Si todo se ve bien, puedes descartarlo.
              </p>
              <button
                type="button"
                onClick={handleClearBackup}
                className="text-gris-700 hover:text-gris-900 text-xs underline"
              >
                Descartar backup
              </button>
            </div>
          )}
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
      {info && !error && (
        <p className="text-sm text-turquesa-700" role="status">
          {info}
        </p>
      )}
    </div>
  );
}

/**
 * Devuelve una cadena relativa tipo "hace 2 min", "hace 1 h", "hace 3 d".
 * Para distancias mayores a 7 dias usa la fecha local formateada.
 */
function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'fecha desconocida';
  const diff = Date.now() - t;
  if (diff < 0) return 'en el futuro';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(t).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
