import type { Track } from './types';

/**
 * Cabecera literal que `parseTrackCsv` espera. El orden y los nombres deben
 * coincidir exactamente con `buildColumnIndices` para que el round-trip sea
 * estable. Si el parser cambia los nombres de columnas obligatorias, este
 * array debe actualizarse en sync.
 *
 * Se omite deliberadamente la columna `Source`: el catalogo nativo la incluye
 * como metadato informativo, pero los CSVs producidos por este serializador
 * son tratados como uploads del usuario y no necesitan trazabilidad de origen.
 */
const HEADER = [
  'Track URI',
  'Track Name',
  'Artist Name(s)',
  'Album Name',
  'Genres',
  'Tempo',
  'Energy',
  'Valence',
  'Danceability',
  'Duration (ms)',
] as const;

const NEEDS_QUOTING = /[",\r\n]/;

function escapeField(value: string): string {
  if (NEEDS_QUOTING.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializa una lista de tracks a un CSV compatible con `parseTrackCsv`.
 *
 * - Salida en formato RFC 4180: campos con comas, comillas o saltos de linea
 *   se entrecomillan; comillas internas se duplican (`""`).
 * - Artistas se reunen con `;`, generos con `,` (mismos separadores internos
 *   que el formato de export de Spotify del que se alimenta el parser).
 * - Numeros se serializan con la representacion canonica de JavaScript
 *   (`String(n)`), que el parser recupera con `Number(s)` sin perdida para
 *   los rangos habituales de tempo/energy/valence/duracion.
 *
 * Al ser una funcion pura sin dependencias del DOM, esta cubierta por tests
 * unitarios de round-trip junto con `parseTrackCsv`.
 */
export function serializeTracksToCsv(tracks: readonly Track[]): string {
  const lines: string[] = [HEADER.join(',')];
  for (const t of tracks) {
    const fields = [
      t.uri,
      t.name,
      t.artists.join(';'),
      t.album,
      t.genres.join(','),
      String(t.tempoBpm),
      String(t.energy),
      String(t.valence),
      String(t.danceability),
      String(t.durationMs),
    ];
    lines.push(fields.map(escapeField).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
