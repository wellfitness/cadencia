import { computeSegmentSlopePct, isSlopeVisuallyFlat } from '@core/segmentation';
import type { ClassifiedSegment } from '@core/segmentation';

export interface SlopePillProps {
  segment: ClassifiedSegment;
  className?: string;
}

/**
 * Pendiente media del segmento en formato compacto, pensado para vivir junto
 * al ZoneBadge en la columna derecha de la fila de playlist.
 *
 * Formato:
 *  - Subida → "+4.2%"
 *  - Bajada → "-1.2%"
 *  - Llano  → no se renderiza nada (devuelve null) para que el badge quede solo
 *
 * No pinta icono direccional: el signo ya transmite la dirección y el espacio
 * junto al badge es escaso.
 */
export function SlopePill({ segment, className = '' }: SlopePillProps): JSX.Element | null {
  const slopePct = computeSegmentSlopePct(segment);
  if (isSlopeVisuallyFlat(slopePct)) return null;

  const text = `${slopePct > 0 ? '+' : ''}${slopePct.toFixed(1)}%`;

  return (
    <span
      className={`text-xs font-semibold text-gris-600 tabular-nums whitespace-nowrap ${className}`.trim()}
      aria-label={`Pendiente media: ${text}`}
    >
      {text}
    </span>
  );
}
