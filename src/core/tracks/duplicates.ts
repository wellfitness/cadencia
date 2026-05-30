import type { Track } from './types';

/**
 * Detección de canciones duplicadas en los catálogos (nativo y listas del
 * usuario). Lógica 100% pura — sin React ni DOM — para ordenar por título y
 * agrupar versiones del mismo tema aunque tengan URI distinta (remasters,
 * directos, radio edits, ediciones feat.…).
 *
 * No interviene en el motor de matching: solo alimenta la VISUALIZACIÓN de los
 * editores de catálogo. Reordenar/agrupar aquí no afecta al determinismo.
 *
 * Criterio de duplicado (acordado): «título limpio + artista». Mismo título
 * limpio Y mismo conjunto de artistas → mismo grupo. Mantener el artista en la
 * clave evita falsos positivos como «Imagine» de John Lennon vs. de Madonna.
 */

/**
 * Palabras clave que marcan un segmento como «versión» y por tanto se recortan
 * del título antes de comparar. Se matchean como palabra/frase completa (con
 * límites de palabra), nunca como substring: así «demo» no recorta
 * «demonstration» ni «live» recorta «alive». Set inicial, ampliable.
 *
 * Deliberadamente FUERA en V1: «instrumental» (un instrumental es una pista
 * genuinamente distinta), y cualquier paréntesis sin palabra clave (p. ej.
 * «(Part 2)») se conserva.
 */
const VERSION_KEYWORDS: readonly string[] = [
  'remaster',
  'remastered',
  'live',
  'radio edit',
  'radio mix',
  'single version',
  'single edit',
  'single mix',
  'album version',
  'mono',
  'stereo',
  'acoustic',
  'demo',
  'remix',
  'club mix',
  'extended mix',
  'extended version',
  'dance mix',
  'dub',
  'edit',
  'version',
  'anniversary',
  'deluxe',
  'bonus',
  're-recorded',
  'rerecorded',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `\b(remaster|live|radio edit|…)\b`, case-insensitive. */
const KEYWORD_RE = new RegExp(
  `\\b(?:${VERSION_KEYWORDS.map(escapeRegExp).join('|')})\\b`,
  'i',
);

/** Minúsculas + sin diacríticos. Mismo criterio que `normalizeForSearch`. */
function stripDiacriticsLower(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Sustituye puntuación por espacio (no la borra, para no fundir palabras),
 *  colapsa espacios y recorta. */
function removePunctuationAndCollapse(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita el segmento «feat./ft./featuring …» hasta el final del título. */
function stripFeaturing(text: string): string {
  return text.replace(/\s*[([]?\s*\b(?:feat|ft|featuring)\b\.?.*$/i, '');
}

/** Quita el último segmento tras « - » (o – / —) mientras sea una versión.
 *  Itera porque puede haber varios: «Song - Live - 2011 Remaster». */
function stripVersionSuffix(text: string): string {
  const separator = /\s+[-–—]\s+/;
  let result = text;
  for (;;) {
    const parts = result.split(separator);
    if (parts.length < 2) break;
    const last = parts[parts.length - 1] ?? '';
    if (!KEYWORD_RE.test(last)) break;
    result = parts.slice(0, -1).join(' - ');
  }
  return result;
}

/** Quita paréntesis/corchetes cuyo interior contiene una palabra clave. */
function stripVersionParentheticals(text: string): string {
  return text
    .replace(/\s*\(([^)]*)\)/g, (match, inner: string) =>
      KEYWORD_RE.test(inner) ? '' : match,
    )
    .replace(/\s*\[([^\]]*)\]/g, (match, inner: string) =>
      KEYWORD_RE.test(inner) ? '' : match,
    );
}

/**
 * Normaliza un título para agrupar versiones: minúsculas, sin tildes, sin
 * sufijos/paréntesis de versión, sin segmento feat., sin puntuación, espacios
 * colapsados.
 *
 * Salvaguarda: si tras los recortes el título queda vacío pero el original no
 * lo estaba (p. ej. el nombre era solo «(Live)»), se devuelve el nombre
 * normalizado sin recortes — nunca se «vacía» un título no vacío.
 */
export function cleanTitleForDedup(name: string): string {
  const base = stripDiacriticsLower(name);
  let working = base;
  working = stripFeaturing(working);
  working = stripVersionSuffix(working);
  working = stripVersionParentheticals(working);
  const cleaned = removePunctuationAndCollapse(working);
  if (cleaned === '') {
    const fallback = removePunctuationAndCollapse(base);
    if (fallback !== '') return fallback;
  }
  return cleaned;
}

/**
 * `true` si el título trae un marcador de versión o un segmento «feat.»: es
 * decir, si limpiarlo para dedup recorta algo más allá de la mera normalización
 * (minúsculas, diacríticos, puntuación). Se usa al deduplicar el catálogo nativo
 * para preferir la versión «limpia/original» como superviviente — p. ej. «Faded»
 * gana a «Faded - Slowed Remix», y «Hey Mama» a «Hey Mama (feat. Nicki Minaj)».
 */
export function titleHasVersionMarker(name: string): boolean {
  const plain = removePunctuationAndCollapse(stripDiacriticsLower(name));
  return cleanTitleForDedup(name) !== plain;
}

/**
 * Normaliza la lista de artistas a una clave order-insensitive: cada artista
 * en minúsculas/sin tildes/sin puntuación, descartando vacíos, ordenados y
 * unidos con «|». Así «A; B» y «B; A» comparten clave.
 */
export function normalizeArtistsForDedup(artists: readonly string[]): string {
  return artists
    .map((a) => removePunctuationAndCollapse(stripDiacriticsLower(a)))
    .filter((a) => a !== '')
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join('|');
}

/** Separador interno de la clave; carácter improbable en datos reales. */
const KEY_SEPARATOR = '\u0000';

/**
 * Clave de agrupación de un track: `tituloLimpio \0 artistasNormalizados`.
 * Devuelve '' si el título queda vacío (no agrupable).
 */
export function dedupKey(track: Pick<Track, 'name' | 'artists'>): string {
  const title = cleanTitleForDedup(track.name);
  if (title === '') return '';
  return `${title}${KEY_SEPARATOR}${normalizeArtistsForDedup(track.artists)}`;
}

/**
 * Ordena de forma estable por título limpio → artista → nombre crudo, con
 * `localeCompare('es')`. No muta el array de entrada. Genérico para reutilizarse
 * con `Track` (catálogo nativo) y con envoltorios `{ track, listName }`
 * (vista «todas las listas»).
 */
export function sortByTitleThenArtist<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  artistsOf: (item: T) => readonly string[],
): T[] {
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return [...items].sort((a, b) => {
    const byTitle = collator.compare(
      cleanTitleForDedup(nameOf(a)),
      cleanTitleForDedup(nameOf(b)),
    );
    if (byTitle !== 0) return byTitle;
    const byArtist = collator.compare(
      normalizeArtistsForDedup(artistsOf(a)),
      normalizeArtistsForDedup(artistsOf(b)),
    );
    if (byArtist !== 0) return byArtist;
    return collator.compare(nameOf(a), nameOf(b));
  });
}

export interface AnnotatedItem<T> {
  item: T;
  /** Clave de agrupación; '' si no agrupable (título vacío). */
  dupKey: string;
  /** Cuántos items comparten la clave en TODO el conjunto analizado (>=1). */
  groupSize: number;
}

/**
 * Anota cada item con su clave de duplicado y el tamaño de su grupo dentro del
 * conjunto. Preserva el orden de entrada (no ordena). Los items con clave vacía
 * nunca se agrupan entre sí (cada uno `groupSize === 1`).
 */
export function annotateDuplicates<T>(
  items: readonly T[],
  trackOf: (item: T) => Pick<Track, 'name' | 'artists'>,
): AnnotatedItem<T>[] {
  const keys = items.map((item) => dedupKey(trackOf(item)));
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (key === '') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return items.map((item, index) => {
    const key = keys[index] ?? '';
    const groupSize = key === '' ? 1 : counts.get(key) ?? 1;
    return { item, dupKey: key, groupSize };
  });
}
