import type { Track, TrackSource } from './types';

/**
 * Parser CSV minimal RFC 4180.
 * - Delimitador coma.
 * - Campos entre comillas dobles si contienen comas o saltos de linea.
 * - Doble comilla "" como escape dentro de campo entrecomillado.
 *
 * No usamos PapaParse u otra dep para mantener el bundle pequeno; el formato
 * de los CSVs de Spotify es predecible y no necesita features extra.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escape "" -> "
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === ',') {
        fields.push(current);
        current = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        current += ch ?? '';
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Indices de las columnas que nos interesan, leidos de la cabecera.
 * Si la cabecera del CSV no tiene una columna critica (URI, Tempo) tiramos
 * Error explicito: el archivo no es un export de Spotify valido.
 */
interface ColumnIndices {
  uri: number;
  name: number;
  album: number;
  artists: number;
  genres: number;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  durationMs: number;
}

function buildColumnIndices(header: string[]): ColumnIndices {
  const find = (name: string): number => {
    const idx = header.findIndex((h) => h.trim() === name);
    if (idx === -1) {
      throw new Error(`CSV de tracks invalido: falta columna '${name}'`);
    }
    return idx;
  };
  return {
    uri: find('Track URI'),
    name: find('Track Name'),
    album: find('Album Name'),
    artists: find('Artist Name(s)'),
    genres: find('Genres'),
    danceability: find('Danceability'),
    energy: find('Energy'),
    valence: find('Valence'),
    tempo: find('Tempo'),
    durationMs: find('Duration (ms)'),
  };
}

function normalizeGenres(raw: string): string[] {
  if (raw.trim() === '') return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of raw.split(',')) {
    const norm = g.trim().toLowerCase();
    if (norm !== '' && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

function normalizeArtists(raw: string): string[] {
  return raw
    .split(';')
    .map((a) => a.trim())
    .filter((a) => a !== '');
}

/**
 * Parsea un CSV de tracks de Spotify a Track[].
 * Salta filas con datos criticos invalidos (URI vacio, tempo no numerico)
 * con un warning en dev. No lanza por filas individuales.
 */
export function parseTrackCsv(csv: string, source: TrackSource): Track[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  if (headerLine === undefined) return [];

  const header = splitCsvLine(headerLine);
  const cols = buildColumnIndices(header);
  const out: Track[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const fields = splitCsvLine(line);
    const uri = fields[cols.uri]?.trim() ?? '';
    if (uri === '' || !uri.startsWith('spotify:track:')) {
      continue;
    }
    const tempoStr = fields[cols.tempo]?.trim() ?? '';
    const tempo = Number(tempoStr);
    if (!Number.isFinite(tempo) || tempo <= 0) {
      continue;
    }
    const energy = Number(fields[cols.energy]?.trim() ?? '');
    const valence = Number(fields[cols.valence]?.trim() ?? '');
    const danceability = Number(fields[cols.danceability]?.trim() ?? '');
    const durationMs = Number(fields[cols.durationMs]?.trim() ?? '');

    out.push({
      uri,
      name: fields[cols.name]?.trim() ?? '',
      album: fields[cols.album]?.trim() ?? '',
      artists: normalizeArtists(fields[cols.artists] ?? ''),
      genres: normalizeGenres(fields[cols.genres] ?? ''),
      tempoBpm: tempo,
      energy: Number.isFinite(energy) ? energy : 0,
      valence: Number.isFinite(valence) ? valence : 0,
      danceability: Number.isFinite(danceability) ? danceability : 0,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      source,
    });
  }

  return out;
}
