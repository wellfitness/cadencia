import type { MatchedSegment } from '../matching/types';
import type { RouteMeta } from '../segmentation/types';

const PRODUCT_NAME = 'Vatios con Ritmo';
const FALLBACK_ROUTE_NAME = 'Sin título';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Nombre por defecto de la playlist en Spotify.
 * Formato: "Vatios con Ritmo - {ruta} - {YYYY-MM-DD}".
 */
export function buildPlaylistName(routeName: string, date: Date): string {
  const trimmed = routeName.trim();
  const display = trimmed === '' ? FALLBACK_ROUTE_NAME : trimmed;
  return `${PRODUCT_NAME} - ${display} - ${formatDate(date)}`;
}

function formatDuration(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${pad(m)} min`;
}

/**
 * Descripcion humanamente legible que aparece bajo el titulo en Spotify.
 * Limite de Spotify: 300 caracteres.
 */
export function buildPlaylistDescription(meta: RouteMeta): string {
  const km = (meta.totalDistanceMeters / 1000).toFixed(1);
  const elev = Math.round(meta.totalElevationGainMeters);
  const dur = formatDuration(meta.totalDurationSec);
  return `Generada para una ruta de ${km} km · ${elev} m+ · ${dur}. Cada tema encaja con la potencia estimada de su tramo.`;
}

/**
 * Extrae las URIs de Spotify de los segmentos casados, descartando los que
 * no tienen track (caso degenerado: catalogo vacio).
 */
export function extractUris(matched: readonly MatchedSegment[]): string[] {
  const out: string[] = [];
  for (const m of matched) {
    if (m.track !== null) out.push(m.track.uri);
  }
  return out;
}
