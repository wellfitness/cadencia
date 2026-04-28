import type { HeartRateZone } from '@core/physiology/karvonen';

/**
 * Color de texto WCAG AA (4.5:1) sobre cada fondo de zona. Z2 (verde claro)
 * y Z3 (amarillo) requieren texto oscuro para superar contraste; el resto
 * mantiene blanco sobre fondos saturados oscuros.
 *
 * Vive en este archivo aparte (no en ZoneBadge.tsx) para no romper la regla
 * react-refresh/only-export-components: ese archivo solo debe exportar el
 * componente.
 */
export function zoneTextColor(zone: HeartRateZone): string {
  if (zone === 2 || zone === 3) return 'text-gris-900';
  return 'text-white';
}
