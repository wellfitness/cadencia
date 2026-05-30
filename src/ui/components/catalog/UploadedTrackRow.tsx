import type { Track } from '@core/tracks';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackPreviewButton } from '@ui/components/TrackPreviewButton';
import { formatTrackDuration } from '@ui/utils/formatTrackDuration';
import { DuplicateBadge } from './DuplicateBadge';

export interface UploadedTrackRowProps {
  track: Track;
  /** Tamaño del grupo de versiones (>=2 muestra el chip «N versiones»). */
  duplicateCount?: number;
  /** Nombre de la lista de origen; vacío («») para no mostrar la insignia
   *  (vista de una sola lista, donde el origen es obvio). */
  listName?: string;
  /** Quita esta copia concreta de su lista (reescribe el CSV de esa lista). */
  onRemove: () => void;
}

/**
 * Fila de una canción dentro de «Mis listas». La acción por tema es **quitar
 * esta copia de su lista** (no un descarte global por URI): así, si la canción
 * está repetida dentro de la lista o existe en varias listas, las demás copias
 * se conservan y el usuario puede deduplicar dejando al menos una. El borrado
 * es reversible desde el aviso de «deshacer» que muestra el contenedor.
 */
export function UploadedTrackRow({
  track,
  duplicateCount = 1,
  listName = '',
  onRemove,
}: UploadedTrackRowProps): JSX.Element {
  const visibleGenres = track.genres.slice(0, 3);
  const extraGenres = track.genres.length - visibleGenres.length;
  const isDuplicate = duplicateCount >= 2;
  const hasMetaRow = visibleGenres.length > 0 || isDuplicate || listName !== '';

  return (
    <div className="flex items-center gap-3 p-2.5 md:p-3 rounded-lg border border-gris-200 bg-white hover:border-turquesa-300 hover:shadow-sm transition-all duration-200 ease-out">
      <TrackPreviewButton uri={track.uri} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-gris-800">{track.name}</p>
        <p className="text-xs text-gris-600 truncate">
          {track.artists.join(', ')}
          {track.album !== '' && <span className="text-gris-400"> · {track.album}</span>}
        </p>
        {hasMetaRow && (
          <div className="flex flex-nowrap items-center gap-1 mt-1 overflow-hidden">
            <DuplicateBadge count={duplicateCount} />
            {listName !== '' && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gris-100 text-gris-600 truncate max-w-[120px]"
                title={`Lista: ${listName}`}
              >
                <MaterialIcon name="queue_music" size="small" className="text-gris-400" />
                {listName}
              </span>
            )}
            {visibleGenres.map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gris-100 text-gris-600 truncate max-w-[100px]"
                title={g}
              >
                {g}
              </span>
            ))}
            {extraGenres > 0 && (
              <span className="text-[10px] text-gris-500 self-center whitespace-nowrap">
                +{extraGenres}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="text-xs tabular-nums flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className="px-2 py-0.5 rounded-md font-semibold bg-turquesa-50 text-turquesa-800">
          {Math.round(track.tempoBpm)}
          <span className="text-[10px] font-normal opacity-70"> BPM</span>
        </span>
        <span className="text-[10px] text-gris-400 inline-flex items-center gap-0.5">
          <MaterialIcon name="schedule" size="small" className="text-gris-400" />
          {formatTrackDuration(track.durationMs)}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar «${track.name}» de la lista`}
        title="Quitar esta copia de la lista"
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gris-300 text-gris-600 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 text-xs font-semibold min-h-[36px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400"
      >
        <MaterialIcon name="playlist_remove" size="small" />
        <span className="hidden sm:inline">Quitar</span>
      </button>
    </div>
  );
}
