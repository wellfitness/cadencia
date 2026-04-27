import type { MatchedSegment } from '@core/matching';
import { MaterialIcon } from './MaterialIcon';
import { ZoneBadge } from './ZoneBadge';

export interface TrackCardProps {
  matched: MatchedSegment;
  /** Indice 1-based del segmento dentro de la ruta (para mostrar "Tema #N"). */
  index?: number;
  className?: string;
}

const QUALITY_LABEL: Record<MatchedSegment['matchQuality'], string | null> = {
  strict: null,
  'best-effort': 'Encaje libre: muy lejos del rango ideal de la zona',
  insufficient: 'Sin canción libre: necesitas más temas en esta zona',
};

/**
 * Tarjeta compacta para mostrar una cancion asignada a un segmento de la ruta.
 * Muestra portada placeholder, titulo, artista, zona, BPM y aviso si el match
 * fue relajado.
 */
export function TrackCard({ matched, index, className = '' }: TrackCardProps): JSX.Element {
  const { track, zone, matchQuality } = matched;
  const qualityNote = QUALITY_LABEL[matchQuality];

  if (track === null) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border border-gris-200 bg-gris-50 p-3 ${className}`.trim()}
      >
        <PlaceholderCover />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gris-500 italic">
            Sin tema disponible para esta zona
          </p>
        </div>
        <ZoneBadge zone={zone} size="sm" />
      </div>
    );
  }

  return (
    <article
      className={`flex items-center gap-3 rounded-lg border border-gris-200 bg-white p-3 hover:border-turquesa-300 transition-colors duration-200 ${className}`.trim()}
    >
      <PlaceholderCover />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {index !== undefined && (
            <span className="text-xs font-semibold text-gris-400 tabular-nums shrink-0">
              {index}.
            </span>
          )}
          <p className="text-sm font-semibold text-gris-800 truncate">{track.name}</p>
        </div>
        <p className="text-xs text-gris-500 truncate">{track.artists.join(', ')}</p>
        {qualityNote && (
          <p
            className="mt-1 text-xs text-tulipTree-600 flex items-center gap-1"
            title={qualityNote}
          >
            <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
            <span className="truncate">{qualityNote}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <ZoneBadge zone={zone} size="sm" />
        <span className="text-xs text-gris-500 tabular-nums">
          {Math.round(track.tempoBpm)} bpm
        </span>
      </div>
    </article>
  );
}

function PlaceholderCover(): JSX.Element {
  return (
    <div
      className="flex items-center justify-center w-12 h-12 rounded-md bg-gradient-to-br from-turquesa-100 to-turquesa-50 shrink-0"
      aria-hidden
    >
      <MaterialIcon name="music_note" size="medium" className="text-turquesa-600" />
    </div>
  );
}
