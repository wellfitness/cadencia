import type { Track } from '@core/tracks';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackPreviewButton } from '@ui/components/TrackPreviewButton';
import { DuplicateBadge } from './DuplicateBadge';

export interface UploadedTrackRowProps {
  track: Track;
  /** Si la canción está descartada globalmente (`dismissedTrackUris`). */
  dismissed: boolean;
  /** Tamaño del grupo de versiones (>=2 muestra el chip «N versiones»). */
  duplicateCount?: number;
  /** Nombre de la lista de origen; vacío («») para no mostrar la insignia
   *  (vista de una sola lista, donde el origen es obvio). */
  listName?: string;
  /**
   * Alterna el estado de descarte. El padre conoce la URI y el estado
   * siguiente, así que esta fila solo dispara el toggle sin argumentos.
   */
  onToggleDismiss: () => void;
}

/**
 * Fila de una canción dentro de una lista subida por el usuario, en la
 * pestaña «Mis listas». A diferencia de `TrackRow` (catálogo nativo), aquí
 * no hay allowlist: el único control es descartar/recuperar la canción del
 * set global `dismissedTrackUris`, que el `livePool` del wizard ya filtra.
 *
 * Estado descartado con triple señal visual (no solo color, WCAG): tachado
 * en el nombre, opacidad reducida y pastilla «fuera». Patrón heredado de
 * `TrackRow` para mantener coherencia entre ambos editores.
 */
export function UploadedTrackRow({
  track,
  dismissed,
  duplicateCount = 1,
  listName = '',
  onToggleDismiss,
}: UploadedTrackRowProps): JSX.Element {
  const visibleGenres = track.genres.slice(0, 3);
  const extraGenres = track.genres.length - visibleGenres.length;
  const isDuplicate = duplicateCount >= 2;
  const hasMetaRow = visibleGenres.length > 0 || isDuplicate || listName !== '';

  const containerClasses = dismissed
    ? 'bg-gris-50 border-gris-200 opacity-75 hover:opacity-100 hover:border-gris-300'
    : 'bg-white border-gris-200 hover:border-turquesa-300 hover:shadow-sm';

  const titleClasses = dismissed
    ? 'text-gris-500 line-through decoration-rosa-400 decoration-1'
    : 'text-gris-800';

  return (
    <div
      className={`flex items-center gap-3 p-2.5 md:p-3 rounded-lg border transition-all duration-200 ease-out ${containerClasses}`}
    >
      <TrackPreviewButton uri={track.uri} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate transition-colors ${titleClasses}`}>
          {track.name}
        </p>
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
        <span
          className={`px-2 py-0.5 rounded-md font-semibold ${
            dismissed ? 'bg-gris-100 text-gris-500' : 'bg-turquesa-50 text-turquesa-800'
          }`}
        >
          {Math.round(track.tempoBpm)}
          <span className="text-[10px] font-normal opacity-70"> BPM</span>
        </span>
        {dismissed && (
          <span className="text-[10px] text-rosa-600 font-semibold inline-flex items-center gap-0.5">
            <MaterialIcon name="block" size="small" className="text-rosa-500" />
            fuera
          </span>
        )}
      </div>

      {dismissed ? (
        <button
          type="button"
          onClick={onToggleDismiss}
          aria-label={`Recuperar «${track.name}»`}
          title="Recuperar — volverá a aparecer en futuras listas"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-turquesa-300 text-turquesa-700 hover:bg-turquesa-50 text-xs font-semibold min-h-[36px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
        >
          <MaterialIcon name="undo" size="small" />
          <span className="hidden sm:inline">Recuperar</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleDismiss}
          aria-label={`No quiero «${track.name}» en mis listas`}
          title="No la quiero — dejará de aparecer en futuras listas"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gris-300 text-gris-600 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 text-xs font-semibold min-h-[36px] whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400"
        >
          <MaterialIcon name="do_not_disturb_on" size="small" />
          <span className="hidden sm:inline">No la quiero</span>
        </button>
      )}
    </div>
  );
}
