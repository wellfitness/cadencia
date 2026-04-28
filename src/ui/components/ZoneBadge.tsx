import type { HeartRateZone } from '@core/physiology/karvonen';
import { zoneTextColor } from './zoneColors';

export interface ZoneBadgeProps {
  zone: HeartRateZone;
  /** Label opcional al lado del codigo Z1..Z5 (ej: "Tempo", "Aerobico base"). */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Badge semantico de zona Z1..Z6. Usa la paleta de zonas del proyecto
 * (azul -> verde -> amarillo -> naranja -> rojo -> carmesi oscuro) destinada
 * exclusivamente a visualizacion de datos.
 */
export function ZoneBadge({ zone, label, size = 'md', className = '' }: ZoneBadgeProps): JSX.Element {
  const colorClass = ZONE_BG[zone];
  const textClass = zoneTextColor(zone);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${textClass} ${colorClass} ${sizeClass} ${className}`.trim()}
      aria-label={label ? `Zona ${zone}: ${label}` : `Zona ${zone}`}
    >
      <span>Z{zone}</span>
      {label && <span className="font-medium opacity-90">{label}</span>}
    </span>
  );
}

const ZONE_BG: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};
