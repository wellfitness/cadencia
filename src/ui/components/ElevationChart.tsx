import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { HeartRateZone, KarvonenZoneRange } from '@core/physiology/karvonen';
import type { ClassifiedSegment } from '@core/segmentation';
import { ZoneBadge } from './ZoneBadge';

export interface ElevationChartProps {
  segments: readonly ClassifiedSegment[];
  /** Rangos Karvonen del usuario para mostrar BPM esperado en el tooltip. */
  karvonenZones?: readonly KarvonenZoneRange[];
  className?: string;
}

interface ChartPoint {
  distanceKm: number;
  elevation: number;
}

const ZONE_FILL: Record<HeartRateZone, string> = {
  1: '#3b82f6',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

const ZONE_LABEL: Record<HeartRateZone, string> = {
  1: 'Recuperación',
  2: 'Aeróbico',
  3: 'Tempo',
  4: 'Umbral',
  5: 'Máximo',
};

/**
 * Perfil de elevacion con bandas verticales coloreadas por zona de potencia.
 *
 * Eje X: distancia acumulada en km (mas legible para ciclistas que tiempo).
 * Eje Y: elevacion sobre nivel del mar en metros.
 * Bandas: un ReferenceArea por cada bloque de 60s, color = zona Coggan.
 * Tooltip: muestra distancia, elevacion, potencia media y zona del bloque.
 */
export function ElevationChart({
  segments,
  karvonenZones,
  className = '',
}: ElevationChartProps): JSX.Element {
  const chartData = useMemo<ChartPoint[]>(() => {
    if (segments.length === 0) return [];
    const first = segments[0]!;
    const points: ChartPoint[] = [
      { distanceKm: first.startDistanceMeters / 1000, elevation: first.startElevationMeters },
    ];
    for (const s of segments) {
      points.push({
        distanceKm: s.endDistanceMeters / 1000,
        elevation: s.endElevationMeters,
      });
    }
    return points;
  }, [segments]);

  const totalKm = chartData.length > 0 ? chartData[chartData.length - 1]!.distanceKm : 0;

  // Para el dominio Y dejamos un margen
  const elevations = chartData.map((p) => p.elevation);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const yPadding = Math.max(10, (maxEle - minEle) * 0.1);

  return (
    <div
      className={`w-full ${className}`.trim()}
      role="img"
      aria-label={`Perfil de elevación de ${totalKm.toFixed(1)} kilómetros con intensidad por zonas`}
    >
      <ResponsiveContainer width="100%" height={240} minWidth={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distanceKm"
            type="number"
            domain={[0, totalKm]}
            tickFormatter={(v: number) => `${v.toFixed(0)} km`}
            stroke="#6b7280"
            fontSize={11}
          />
          <YAxis
            domain={[Math.floor(minEle - yPadding), Math.ceil(maxEle + yPadding)]}
            tickFormatter={(v: number) => `${Math.round(v)} m`}
            stroke="#6b7280"
            fontSize={11}
            width={48}
          />
          {segments.map((s) => (
            <ReferenceArea
              key={s.startSec}
              x1={s.startDistanceMeters / 1000}
              x2={s.endDistanceMeters / 1000}
              fill={ZONE_FILL[s.zone]}
              fillOpacity={0.28}
              strokeOpacity={0}
              ifOverflow="visible"
            />
          ))}
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#374151"
            strokeWidth={1.5}
            fill="url(#elevation-fill)"
            isAnimationActive={false}
          />
          <Tooltip
            content={(props: TooltipProps<number, string>) => (
              <ChartTooltip {...props} segments={segments} karvonenZones={karvonenZones} />
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChartTooltipProps extends TooltipProps<number, string> {
  segments: readonly ClassifiedSegment[];
  karvonenZones: readonly KarvonenZoneRange[] | undefined;
}

function ChartTooltip({
  active,
  label,
  payload,
  segments,
  karvonenZones,
}: ChartTooltipProps): JSX.Element | null {
  if (!active || payload === undefined || payload.length === 0) return null;

  const distanceKm = typeof label === 'number' ? label : Number(label);
  if (!Number.isFinite(distanceKm)) return null;

  const distanceMeters = distanceKm * 1000;
  const segment = segments.find(
    (s) =>
      distanceMeters >= s.startDistanceMeters && distanceMeters <= s.endDistanceMeters,
  );

  const elevation = payload[0]?.value;
  const bpmRange = segment && karvonenZones
    ? karvonenZones.find((r) => r.zone === segment.zone)
    : undefined;

  return (
    <div className="rounded-lg border border-gris-200 bg-white px-3 py-2 shadow-lg text-sm space-y-1">
      <div className="font-semibold text-gris-800">{distanceKm.toFixed(2)} km</div>
      {typeof elevation === 'number' && (
        <div className="text-gris-600">{Math.round(elevation)} m de elevación</div>
      )}
      {segment && (
        <div className="flex flex-col gap-1 pt-1 border-t border-gris-100">
          <div className="flex items-center gap-2">
            <ZoneBadge zone={segment.zone} label={ZONE_LABEL[segment.zone]} size="sm" />
            <span className="text-gris-700 font-medium tabular-nums">
              {Math.round(segment.avgPowerWatts)} W
            </span>
          </div>
          {bpmRange && (
            <div className="text-xs text-gris-500 tabular-nums">
              {Math.round(bpmRange.minBpm)}–{Math.round(bpmRange.maxBpm)} bpm esperados
            </div>
          )}
        </div>
      )}
    </div>
  );
}
