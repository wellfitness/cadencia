import { useState } from 'react';
import type { PlaylistHistoryEntry } from '@core/sync/types';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { ZoneStackedBar } from '@ui/components/ZoneStackedBar';
import { deletePlaylistHistoryEntry } from '@core/playlist/history';

export interface HistoryEntryRowProps {
  entry: PlaylistHistoryEntry;
}

function formatDuration(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const SPORT_LABEL: Record<'bike' | 'run', string> = {
  bike: 'Ciclismo',
  run: 'Carrera',
};

const MODE_LABEL: Record<'gpx' | 'session', string> = {
  gpx: 'Outdoor (GPX)',
  session: 'Indoor (sesión)',
};

/**
 * Fila colapsable de una entrada del historial. Muestra fecha, deporte,
 * duracion y distribucion de zonas. Boton "Abrir en Spotify" si la
 * entrada conserva el id de la playlist creada. Boton borrar con confirmacion.
 */
export function HistoryEntryRow({ entry }: HistoryEntryRowProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const replacedCount = entry.tracks.filter((t) => t.wasReplaced).length;

  return (
    <li className="rounded-md border border-gris-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gris-800">
            {formatDate(entry.createdAt)}
          </p>
          <p className="text-xs text-gris-500 mt-0.5">
            {SPORT_LABEL[entry.sport]} · {MODE_LABEL[entry.mode]} ·{' '}
            <span className="tabular-nums">{formatDuration(entry.totalDurationSec)}</span> ·{' '}
            {entry.tracks.length}{' '}
            {entry.tracks.length === 1 ? 'tema' : 'temas'}
            {replacedCount > 0 ? (
              <>
                {' '}
                · <span className="text-tulipTree-700">{replacedCount} sustituidos</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.spotifyPlaylistId ? (
            <a
              href={`https://open.spotify.com/playlist/${encodeURIComponent(entry.spotifyPlaylistId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-turquesa-300 text-turquesa-700 hover:bg-turquesa-50 text-xs font-semibold min-h-[32px] whitespace-nowrap"
              aria-label="Abrir en Spotify"
            >
              <MaterialIcon name="open_in_new" size="small" />
              Spotify
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-rosa-300 text-rosa-700 hover:bg-rosa-50 text-xs font-semibold min-h-[32px]"
            aria-label="Borrar entrada del historial"
          >
            <MaterialIcon name="delete_outline" size="small" />
            Borrar
          </button>
        </div>
      </div>
      <ZoneStackedBar
        zoneDurationsSec={entry.zoneDurations}
        totalSec={entry.totalDurationSec}
        zones={[1, 2, 3, 4, 5, 6]}
        className="mt-2"
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Borrar esta entrada del historial"
        icon="delete_outline"
        confirmLabel="Sí, borrar"
        cancelLabel="Cancelar"
        confirmVariant="critical"
        onConfirm={() => {
          deletePlaylistHistoryEntry(entry.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
        message={
          <p>
            Vas a borrar la lista del{' '}
            <strong>{formatDate(entry.createdAt)}</strong>. La playlist en
            tu Spotify no se ve afectada — solo desaparece de tus estadísticas.
          </p>
        }
      />
    </li>
  );
}
