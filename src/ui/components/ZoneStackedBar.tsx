import type { HeartRateZone } from '@core/physiology/karvonen';

export interface ZoneStackedBarProps {
  /** Duración en segundos por zona Z1..Z6. */
  zoneDurationsSec: Record<HeartRateZone, number>;
  /** Total de la sesión en segundos (para calcular %). */
  totalSec: number;
  /** Zonas a renderizar, en orden. Por defecto [1,2,3,4,5]. */
  zones?: readonly HeartRateZone[];
  className?: string;
}

const DEFAULT_ZONES: readonly HeartRateZone[] = [1, 2, 3, 4, 5];

// Mapping estatico: Tailwind JIT necesita strings literales completos para
// generar las clases. No construir dinamicamente `bg-zone-${z}`.
const ZONE_BG: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};

/**
 * Barra apilada con la distribucion de tiempo por zona. Renderiza un segmento
 * por zona con duracion > 0, contiguos (sin gap), sobre un track gris de fondo.
 *
 * Solo calcula porcentajes — el formateo humano de duracion vive en el padre.
 */
export function ZoneStackedBar({
  zoneDurationsSec,
  totalSec,
  zones = DEFAULT_ZONES,
  className = '',
}: ZoneStackedBarProps): JSX.Element {
  const safeTotal = totalSec > 0 ? totalSec : 0;

  const segments = zones
    .map((z) => {
      const dur = zoneDurationsSec[z] ?? 0;
      const pct = safeTotal > 0 ? (dur / safeTotal) * 100 : 0;
      return { zone: z, dur, pct };
    })
    .filter((s) => s.dur > 0);

  const ariaSummary = segments
    .map((s) => `Z${s.zone} ${Math.round(s.pct)}%`)
    .join(', ');
  const ariaLabel =
    segments.length > 0
      ? `Distribución de tiempo por zona: ${ariaSummary}`
      : 'Distribución de tiempo por zona: sin datos';

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`flex h-3 w-full overflow-hidden rounded-full bg-gris-100 ${className}`.trim()}
    >
      {segments.map((s) => (
        <div
          key={s.zone}
          data-zone={s.zone}
          className={`h-full ${ZONE_BG[s.zone]}`}
          style={{ width: `${s.pct}%` }}
        />
      ))}
    </div>
  );
}
