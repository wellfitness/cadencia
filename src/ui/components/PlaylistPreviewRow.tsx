import type { MatchedSegment } from '@core/matching';
import { MaterialIcon } from './MaterialIcon';
import { SlopePill } from './SlopePill';
import { ZoneBadge } from './ZoneBadge';

export interface PlaylistPreviewRowProps {
  matched: MatchedSegment;
  index: number;
  /**
   * Pinta la pendiente media del segmento al lado del ZoneBadge. Solo activar
   * en modo GPX; en sesión indoor los datos de elevación son 0.
   */
  showSlope?: boolean;
}

/**
 * Variante de solo lectura de PlaylistTrackRow para el preview en MusicStep.
 *
 * Decisiones visuales clave:
 *  - Sin botones, sin cover-placeholder. Toda la edición vive en ResultStep.
 *  - Una **barra vertical de color por zona** a la izquierda hace de ancla
 *    cromática sin robar tanto espacio como un cuadrado 48px. Mantiene la
 *    lectura de la zona "de un vistazo" en una lista densa.
 *  - Tipografía: título dominante (gris-900, semibold), artista secundario
 *    (gris-500), índice y BPM en tabular-nums tono atenuado.
 *  - Hover sutil (tinte turquesa-50/40 + border turquesa-200) que comunica
 *    "se puede escanear" sin sugerir click.
 *  - Mobile: BPM se oculta < 640 px para liberar el ancho del título; la
 *    zona y la pendiente siguen visibles como metadatos críticos.
 */
export function PlaylistPreviewRow({
  matched,
  index,
  showSlope = false,
}: PlaylistPreviewRowProps): JSX.Element {
  const { track, zone } = matched;

  if (track === null) {
    return (
      <article
        className="relative flex items-center gap-3 overflow-hidden rounded-md border border-tulipTree-200 bg-tulipTree-50/60 pl-4 pr-3 py-2.5"
        aria-label={`Tramo ${index}: sin tema disponible`}
      >
        <ZoneStripe zone={zone} />
        <span className="text-xs font-semibold text-gris-400 tabular-nums shrink-0 w-6 text-right">
          {index}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <MaterialIcon
            name="music_off"
            size="small"
            className="text-tulipTree-600 shrink-0"
          />
          <p className="text-sm font-semibold text-gris-700 truncate">
            Sin tema para esta zona
          </p>
        </div>
        <ZoneBadge zone={zone} size="sm" />
      </article>
    );
  }

  return (
    <article
      className="group relative flex items-center gap-3 overflow-hidden rounded-md border border-gris-200 bg-white pl-4 pr-3 py-2.5 transition-colors duration-150 hover:border-turquesa-200 hover:bg-turquesa-50/30"
      aria-label={`Tramo ${index}: ${track.name} de ${track.artists.join(', ')}, zona ${zone}, ${Math.round(track.tempoBpm)} BPM`}
    >
      <ZoneStripe zone={zone} />

      <span
        className="text-xs font-semibold text-gris-400 tabular-nums shrink-0 w-6 text-right"
        aria-hidden
      >
        {index}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-gris-900 truncate leading-tight">
          {track.name}
        </p>
        <p className="text-xs text-gris-500 truncate leading-tight mt-0.5">
          {track.artists.join(', ')}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showSlope && <SlopePill segment={matched} />}
        <span
          className="hidden sm:inline text-xs font-medium text-gris-500 tabular-nums"
          aria-hidden
        >
          {Math.round(track.tempoBpm)} bpm
        </span>
        <ZoneBadge zone={zone} size="sm" />
      </div>
    </article>
  );
}

interface ZoneStripeProps {
  zone: MatchedSegment['zone'];
}

/**
 * Barra vertical de 4 px pegada al borde izquierdo, coloreada según la zona.
 * Sustituye al placeholder cover 48×48 que usa la fila editable: en una lista
 * densa de solo lectura no aporta y resta legibilidad.
 *
 * Las clases necesitan estar literales para que Tailwind las recoja en el
 * escaneo estático (no se generan dinámicamente por concatenación).
 */
function ZoneStripe({ zone }: ZoneStripeProps): JSX.Element {
  const ZONE_BG: Record<number, string> = {
    1: 'bg-zone-1',
    2: 'bg-zone-2',
    3: 'bg-zone-3',
    4: 'bg-zone-4',
    5: 'bg-zone-5',
    6: 'bg-zone-6',
  };
  const bg = ZONE_BG[zone] ?? 'bg-turquesa-500';
  return (
    <span
      className={`absolute left-0 top-0 bottom-0 w-1 ${bg}`}
      aria-hidden
    />
  );
}
