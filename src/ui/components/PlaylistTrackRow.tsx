import type { MatchedSegment } from '@core/matching';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';
import { ZoneBadge } from './ZoneBadge';

export interface PlaylistTrackRowProps {
  matched: MatchedSegment;
  index: number;
  /** Llamado al pulsar "Otro tema". Si no se provee, el boton no se muestra. */
  onReplace?: () => void;
  /** Indica que en esta fila no hay alternativas en el catalogo. */
  noAlternative?: boolean;
  /** Marca visual: el usuario sustituyo este tema manualmente. */
  replaced?: boolean;
}

const QUALITY_LABEL: Record<MatchedSegment['matchQuality'], string | null> = {
  strict: null,
  relaxed: 'Encaje aproximado',
  'best-effort': 'Encaje libre',
};

/**
 * Fila de la lista final en la pantalla Resultado. Variante de TrackCard
 * con boton "Otro tema" siempre visible (no hover-only para mobile).
 */
export function PlaylistTrackRow({
  matched,
  index,
  onReplace,
  noAlternative = false,
  replaced = false,
}: PlaylistTrackRowProps): JSX.Element {
  const { track, zone, matchQuality } = matched;
  const qualityLabel = QUALITY_LABEL[matchQuality];

  if (track === null) {
    return (
      <article className="flex items-center gap-3 rounded-lg border border-gris-200 bg-gris-50 p-3">
        <PlaceholderCover />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gris-500 italic">
            Sin tema disponible para esta zona
          </p>
        </div>
        <ZoneBadge zone={zone} size="sm" />
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-gris-200 bg-white p-3 hover:border-turquesa-300 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <PlaceholderCover />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-gris-400 tabular-nums shrink-0">
              {index}.
            </span>
            <p className="text-sm font-semibold text-gris-800 truncate">{track.name}</p>
            {replaced && (
              <span
                title="Sustituido manualmente"
                className="text-xs text-turquesa-700 shrink-0 inline-flex items-center gap-0.5"
              >
                <MaterialIcon name="edit" size="small" className="text-turquesa-600" />
              </span>
            )}
          </div>
          <p className="text-xs text-gris-500 truncate">{track.artists.join(', ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ZoneBadge zone={zone} size="sm" />
          <span className="text-xs text-gris-500 tabular-nums">
            {Math.round(track.tempoBpm)} bpm
          </span>
        </div>
      </div>
      {onReplace && (
        <div className="mt-2 pt-2 border-t border-gris-100 flex items-center justify-between gap-2">
          {qualityLabel && (
            <span
              className="text-xs text-tulipTree-600 flex items-center gap-1"
              title="No habia un tema exacto para esta zona en tu catalogo"
            >
              <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
              {qualityLabel}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            iconLeft="refresh"
            onClick={onReplace}
            disabled={noAlternative}
            className="ml-auto"
            aria-label={`Cambiar tema del tramo ${index}`}
          >
            Otro tema
          </Button>
        </div>
      )}
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
