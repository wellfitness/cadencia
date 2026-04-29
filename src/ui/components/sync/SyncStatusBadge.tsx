import { useEffect, useState } from 'react';
import type { SyncStatus } from '@core/sync/types';
import { isConnected as isSyncConnected } from '@integrations/gdrive/sync';

interface Props {
  className?: string;
}

/**
 * Badge que escucha el evento global 'gdrive-sync-status' y refleja el
 * estado actual del motor de sync con un color y label legibles.
 *
 * Estado inicial: 'synced' si ya hay conexion al montar (estado calmo
 * sin pings), 'disconnected' si no.
 */
export function SyncStatusBadge({ className = '' }: Props): JSX.Element {
  const [status, setStatus] = useState<SyncStatus>(() =>
    isSyncConnected() ? 'synced' : 'disconnected',
  );

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ status: SyncStatus }>).detail;
      if (detail?.status) setStatus(detail.status);
    };
    window.addEventListener('gdrive-sync-status', handler);
    return () => window.removeEventListener('gdrive-sync-status', handler);
  }, []);

  const labels: Record<SyncStatus, string> = {
    disconnected: 'No conectado',
    connecting: 'Conectando…',
    synced: 'Sincronizado',
    syncing: 'Sincronizando…',
    token_expired: 'Sesión expirada',
    error: 'Error de sincronización',
  };
  const colorClass: Record<SyncStatus, string> = {
    disconnected: 'bg-gris-100 text-gris-700',
    connecting: 'bg-tulipTree-100 text-tulipTree-800',
    synced: 'bg-turquesa-100 text-turquesa-800',
    syncing: 'bg-tulipTree-100 text-tulipTree-800',
    token_expired: 'bg-rosa-100 text-rosa-800',
    error: 'bg-rosa-100 text-rosa-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass[status]} ${className}`.trim()}
    >
      {labels[status]}
    </span>
  );
}
