import type { HeartRateZone, KarvonenZoneRange } from '@core/physiology/karvonen';
import type { RouteMeta } from '@core/segmentation';
import { Card } from './Card';
import { MaterialIcon } from './MaterialIcon';
import { ZoneBadge } from './ZoneBadge';
import { ZoneStackedBar } from './ZoneStackedBar';
import { ZONE_LABEL_SHORT } from './zoneLabels';

export interface RouteSummaryProps {
  meta: RouteMeta;
  /** Rangos Karvonen del usuario para mostrar BPM por zona. Opcional: solo se calcula si tiene FC max + FC reposo. */
  karvonenZones?: readonly KarvonenZoneRange[];
  className?: string;
}

const ZONE_BAR_BG: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};

// Highlight para la zona dominante en la lista. Se mapea estatico para que
// Tailwind JIT genere las clases (no construir `bg-zone-${z}/10` dinamico).
const ZONE_HIGHLIGHT: Record<HeartRateZone, string> = {
  1: 'bg-zone-1/10 ring-1 ring-zone-1/40 rounded-lg p-2 -mx-2',
  2: 'bg-zone-2/10 ring-1 ring-zone-2/40 rounded-lg p-2 -mx-2',
  3: 'bg-zone-3/10 ring-1 ring-zone-3/40 rounded-lg p-2 -mx-2',
  4: 'bg-zone-4/10 ring-1 ring-zone-4/40 rounded-lg p-2 -mx-2',
  5: 'bg-zone-5/10 ring-1 ring-zone-5/40 rounded-lg p-2 -mx-2',
  6: 'bg-zone-6/10 ring-1 ring-zone-6/40 rounded-lg p-2 -mx-2',
};

/**
 * Devuelve la zona con mayor duracion entre las renderizadas. En caso de
 * empate, prioriza la zona MAS BAJA (criterio determinista, favorece la mas
 * representativa por convencion).
 */
function findDominantZone(
  zones: readonly HeartRateZone[],
  zoneDurationsSec: Record<HeartRateZone, number>,
): HeartRateZone | null {
  let best: HeartRateZone | null = null;
  let bestDur = -1;
  for (const z of zones) {
    const dur = zoneDurationsSec[z] ?? 0;
    if (dur > bestDur) {
      best = z;
      bestDur = dur;
    }
  }
  return bestDur > 0 ? best : null;
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

function formatPower(watts: number): string {
  return `${Math.round(watts)} W`;
}

export function RouteSummary({
  meta,
  karvonenZones,
  className = '',
}: RouteSummaryProps): JSX.Element {
  const zones: HeartRateZone[] = [1, 2, 3, 4, 5];
  const totalSec = meta.totalDurationSec || 1; // evitar div/0
  const dominantZone = findDominantZone(zones, meta.zoneDurationsSec);

  const bpmRangeFor = (zone: HeartRateZone): string | null => {
    if (!karvonenZones) return null;
    const range = karvonenZones.find((r) => r.zone === zone);
    if (!range) return null;
    return `${Math.round(range.minBpm)}–${Math.round(range.maxBpm)} bpm`;
  };

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <Card title={meta.name} titleIcon="route">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Stat label="Distancia" value={formatDistance(meta.totalDistanceMeters)} icon="straighten" />
          <Stat
            label="Desnivel +"
            value={formatElevation(meta.totalElevationGainMeters)}
            icon="trending_up"
          />
          <Stat label="Duración" value={formatDuration(meta.totalDurationSec)} icon="schedule" />
          <Stat
            label="Potencia"
            value={formatPower(meta.averagePowerWatts)}
            sub={`NP ${formatPower(meta.normalizedPowerWatts)}`}
            icon="bolt"
          />
        </div>
        {!meta.hadRealTimestamps && (
          <p className="mt-3 text-xs text-gris-500 flex items-center gap-1.5">
            <MaterialIcon name="info" size="small" className="text-gris-400" />
            La duración y velocidad se han estimado por la pendiente (el GPX no tenía timestamps).
          </p>
        )}
      </Card>

      <Card title="Distribución por zonas" titleIcon="show_chart">
        <ZoneStackedBar
          zoneDurationsSec={meta.zoneDurationsSec}
          totalSec={meta.totalDurationSec}
          zones={zones}
          className="mb-4"
        />
        <ul className="space-y-3">
          {zones.map((z) => {
            const dur = meta.zoneDurationsSec[z];
            const pct = (dur / totalSec) * 100;
            const bpm = bpmRangeFor(z);
            const isDominant = z === dominantZone;
            const liClass = [
              'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3',
              isDominant ? ZONE_HIGHLIGHT[z] : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li key={z} className={liClass}>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="sm:w-36 shrink-0">
                    <ZoneBadge zone={z} label={ZONE_LABEL_SHORT[z]} size="sm" />
                  </div>
                  {karvonenZones && (
                    <div className="sm:w-24 shrink-0 text-xs text-gris-500 tabular-nums whitespace-nowrap">
                      {bpm ?? ''}
                    </div>
                  )}
                </div>
                <div
                  className="flex-1 min-w-0 h-3 rounded-full bg-gris-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${pct.toFixed(0)} % del tiempo en zona ${z}${bpm ? `, ${bpm}` : ''}`}
                >
                  <div
                    className={`h-full ${ZONE_BAR_BG[z]} transition-[width] duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-24 text-right tabular-nums text-sm text-gris-700 font-medium">
                  {pct.toFixed(0)}% · {formatDuration(dur)}
                </div>
              </li>
            );
          })}
        </ul>
        {!karvonenZones && (
          <p className="mt-3 text-xs text-gris-500 flex items-start gap-1.5">
            <MaterialIcon name="info" size="small" className="text-gris-400 mt-0.5" />
            Para ver los rangos de BPM esperados en cada zona, vuelve atrás e introduce tu FC
            máxima y FC en reposo.
          </p>
        )}
      </Card>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
}

function Stat({ label, value, sub, icon }: StatProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-gris-500 flex items-center gap-1">
        <MaterialIcon name={icon} size="small" className="text-turquesa-600" />
        {label}
      </span>
      <span className="text-xl md:text-2xl font-bold text-gris-800 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-gris-500 tabular-nums">{sub}</span>}
    </div>
  );
}
