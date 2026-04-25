import type { GpxPoint, GpxTrack } from './types';

const GPX_NS = 'http://www.topografix.com/GPX/1/1';
const GPX_NS_OLD = 'http://www.topografix.com/GPX/1/0';

/**
 * Parsea un GPX (XML como string) a una estructura GpxTrack.
 *
 * Soporta GPX 1.0 y 1.1 (los dos formatos en circulacion). Tolera:
 * - Puntos sin <ele> (asume 0).
 * - Puntos sin <time> (devuelve hasTimestamps: false).
 * - Multiples <trkseg> dentro del mismo <trk>: se concatenan los puntos.
 *
 * Lanza Error con mensaje claro si: no es XML valido, no hay <trkpt>,
 * lat/lon fuera de rango.
 */
export function parseGpx(xmlString: string): GpxTrack {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // DOMParser no tira excepcion en XML invalido — devuelve un doc con
  // <parsererror>. Detectamos eso explicitamente.
  const parserError = doc.querySelector('parsererror');
  if (parserError !== null) {
    throw new Error(`GPX no es XML valido: ${parserError.textContent ?? 'parsererror'}`);
  }

  const root = doc.documentElement;
  if (root === null || root.localName !== 'gpx') {
    throw new Error('No es un GPX: el elemento raiz no es <gpx>');
  }

  const ns = root.namespaceURI;
  if (ns !== GPX_NS && ns !== GPX_NS_OLD) {
    // No bloqueamos, solo avisamos en consola dev — algunos exporters usan namespaces no estandar
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(`GPX con namespace inusual: ${ns ?? '(ninguno)'}`);
    }
  }

  // Nombre del track (si lo trae)
  const trkNameEl = root.querySelector('trk > name');
  const name = trkNameEl?.textContent?.trim() ?? 'Ruta sin nombre';

  // Recoger todos los <trkpt> de todos los <trkseg> dentro de <trk>
  const trkptElements = root.querySelectorAll('trk > trkseg > trkpt');
  if (trkptElements.length === 0) {
    throw new Error('GPX sin puntos de track (<trkpt>)');
  }

  const points: GpxPoint[] = [];
  let hasTimestamps = true; // se vuelve false en cuanto encontremos un punto sin time

  for (let i = 0; i < trkptElements.length; i++) {
    const el = trkptElements[i];
    if (!el) continue;

    const latStr = el.getAttribute('lat');
    const lonStr = el.getAttribute('lon');
    if (latStr === null || lonStr === null) {
      throw new Error(`<trkpt> sin lat/lon en posicion ${i}`);
    }
    const lat = Number(latStr.trim());
    const lon = Number(lonStr.trim());
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`lat fuera de rango en posicion ${i}: ${latStr}`);
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error(`lon fuera de rango en posicion ${i}: ${lonStr}`);
    }

    const eleEl = el.querySelector('ele');
    const eleStr = eleEl?.textContent?.trim();
    const ele = eleStr !== undefined && eleStr !== '' ? Number(eleStr) : 0;
    const eleFinite = Number.isFinite(ele) ? ele : 0;

    const timeEl = el.querySelector('time');
    const timeStr = timeEl?.textContent?.trim();
    let time: Date | null = null;
    if (timeStr !== undefined && timeStr !== '') {
      const d = new Date(timeStr);
      if (!Number.isNaN(d.getTime())) {
        time = d;
      } else {
        hasTimestamps = false;
      }
    } else {
      hasTimestamps = false;
    }

    points.push({ lat, lon, ele: eleFinite, time });
  }

  return { name, points, hasTimestamps };
}
