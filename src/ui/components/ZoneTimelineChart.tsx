import { useMemo, useState } from 'react';
import type { HeartRateZone } from '@core/physiology/karvonen';
import type { SessionBlock } from '@core/segmentation';
import { ZoneBadge } from './ZoneBadge';

export interface ZoneTimelineChartProps {
  /** Bloques expandidos del plan (sin grupos × N). */
  blocks: readonly SessionBlock[];
  className?: string;
}

const ZONE_BG: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};

const PHASE_LABELS: Record<string, string> = {
  warmup: 'Calentamiento',
  work: 'Trabajo',
  recovery: 'Recuperación',
  rest: 'Descanso',
  cooldown: 'Vuelta a la calma',
  main: 'Principal',
};

/**
 * Visualizacion alternativa al ElevationChart para sesiones indoor: una
 * unica barra horizontal con segmentos proporcionales a la duracion de
 * cada bloque, coloreados por zona. Sin distancia ni elevacion.
 */
export function ZoneTimelineChart({ blocks, className = '' }: ZoneTimelineChartProps): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalDurationSec = useMemo(
    () => blocks.reduce((acc, b) => acc + b.durationSec, 0),
    [blocks],
  );

  if (totalDurationSec === 0) {
    return (
      <div className={`text-sm text-gris-500 italic ${className}`.trim()}>
        Añade bloques para ver la línea de tiempo de la sesión.
      </div>
    );
  }

  const hovered: SessionBlock | null =
    hoverIndex !== null ? (blocks[hoverIndex] ?? null) : null;
  const totalMinutes = Math.round(totalDurationSec / 60);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-gris-500">Línea de tiempo</span>
        <span className="text-xs font-semibold text-gris-700 tabular-nums">
          {totalMinutes} min totales
        </span>
      </div>
      <div
        className="flex h-6 md:h-8 w-full overflow-hidden rounded-md border border-gris-200 bg-gris-50"
        role="img"
        aria-label={`Línea de tiempo de la sesión: ${totalMinutes} minutos`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {blocks.map((block, i) => {
          const widthPct = (block.durationSec / totalDurationSec) * 100;
          const isActive = hoverIndex === i;
          const phaseLabel = PHASE_LABELS[block.phase] ?? block.phase;
          return (
            <button
              key={block.id}
              type="button"
              className={`${ZONE_BG[block.zone]} cursor-pointer transition-opacity ${
                hoverIndex !== null && !isActive ? 'opacity-60' : 'opacity-100'
              }`}
              style={{ width: `${widthPct}%` }}
              onMouseEnter={() => setHoverIndex(i)}
              onClick={() => setHoverIndex((prev) => (prev === i ? null : i))}
              aria-label={`Bloque ${i + 1}: ${phaseLabel}, zona ${block.zone}, ${formatDuration(block.durationSec)}`}
              aria-pressed={isActive}
              title={`${phaseLabel} · Z${block.zone} · ${formatDuration(block.durationSec)}`}
            />
          );
        })}
      </div>

      {hovered !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gris-700">
          <ZoneBadge zone={hovered.zone} size="sm" />
          <span className="font-semibold">
            {PHASE_LABELS[hovered.phase] ?? hovered.phase}
          </span>
          <span className="text-gris-500">·</span>
          <span className="tabular-nums">{formatDuration(hovered.durationSec)}</span>
          {hovered.description !== undefined && (
            <>
              <span className="text-gris-500">·</span>
              <span className="text-gris-500 italic">{hovered.description}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (sec === 0) return `${min}'`;
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}
