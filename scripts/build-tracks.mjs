#!/usr/bin/env node
/**
 * build-tracks.mjs — Compila el catálogo nativo unificado.
 *
 * Lee todos los CSVs de Spotify en src/data/tracks/sources/, deduplica:
 *   1) Estricto por Track URI (first-wins).
 *   2) Blando por (artista normalizado + título normalizado): tracks con
 *      URIs distintos pero misma canción base — remasters, single edits,
 *      "Radio Edit", "12'' Version", "2009 Remaster"... — se colapsan en
 *      uno solo (first-wins también, alfabético por nombre de archivo).
 * Descarta tracks que no encajen en NINGUNA cadencia de las 6 zonas
 * (60-80 ∪ 70-90 ∪ 90-115 ∪ 110-160 ∪ 140-180 ∪ 180-230 BPM) y escribe
 * el resultado en src/data/tracks/all.csv.
 *
 * Se ejecuta a mano (`pnpm build:tracks`) cuando se actualicen las listas en
 * sources/. NO corre en cada `pnpm build` para no añadir latencia ni riesgo.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCES_DIR = join(ROOT, 'src', 'data', 'tracks', 'sources');
const OUT_FILE = join(ROOT, 'src', 'data', 'tracks', 'all.csv');

// Rangos de cadencia por profile (1:1) y su correspondiente 2:1 half-time.
// Un track encaja en alguno si su BPM cae en cualquiera de estas ventanas.
// Manten en sync con src/core/matching/zoneCriteria.ts.
const FIT_RANGES = [
  [60, 80],   // climb 1:1
  [70, 90],   // flat 1:1
  [90, 115],  // sprint 1:1
  [110, 160], // climb 2:1 (55-80 rpm)
  [140, 180], // flat 2:1
  [180, 230], // sprint 2:1
];

/**
 * Limite duro del catalogo unificado. Si tras dedups + filtros pasamos de
 * este numero, recortamos a los mas populares (columna 'Popularity' de
 * Spotify, 0-100). Previene que el bundle se infle con CSVs masivos.
 */
const MAX_CATALOG_SIZE = 10000;

function fitsAnyCadence(bpm) {
  for (const [lo, hi] of FIT_RANGES) {
    if (bpm >= lo && bpm <= hi) return true;
  }
  return false;
}

/**
 * Normaliza un titulo de track para detectar versiones de la misma cancion
 * con distinto URI: quita sufijos tipicos de Spotify ("- Remastered 2011",
 * "(Radio Edit)", "(Live)", "[2009 Remaster]"), acentos, signos y espacios
 * sobrantes. Se usa solo como CLAVE de dedup blando — el track guardado
 * conserva su nombre original tal cual.
 */
function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*remaster[^)]*\)/gi, '')
    .replace(/\([^)]*remastered[^)]*\)/gi, '')
    .replace(/\([^)]*live[^)]*\)/gi, '')
    .replace(/\([^)]*acoustic[^)]*\)/gi, '')
    .replace(/\([^)]*radio edit[^)]*\)/gi, '')
    .replace(/\([^)]*single version[^)]*\)/gi, '')
    .replace(/\([^)]*album version[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/-\s*remaster[^-]*$/gi, '')
    .replace(/-\s*remastered[^-]*$/gi, '')
    .replace(/-\s*live[^-]*$/gi, '')
    .replace(/-\s*\d{4}\s*remaster.*$/gi, '')
    .replace(/-\s*radio\s*(edit|version|mix).*$/gi, '')
    .replace(/-\s*\d+''?\s*\D+\s*version.*$/gi, '')
    .replace(/-\s*from.*$/gi, '')
    .replace(/-\s*single.*$/gi, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza el primer artista del campo "Artist Name(s)" (separadores
 * tipicos: ';' o ','). Se usa con normalizeTitle para construir la
 * clave de dedup blando.
 */
function normalizeFirstArtist(s) {
  const first = String(s || '').split(/[,;]/)[0] || '';
  return first
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function softKey(name, artist) {
  const a = normalizeFirstArtist(artist);
  const t = normalizeTitle(name);
  if (!a || !t) return '';
  return a + ' :: ' + t;
}

/** Parser CSV minimo: respeta comillas dobles, separa por coma. */
function parseLine(line) {
  const parts = [];
  let cur = '';
  let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

/** Encierra un campo en comillas si contiene coma o comilla. */
function quote(field) {
  if (field == null) return '';
  const s = String(field);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const files = readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.csv')).sort();
  if (files.length === 0) {
    console.error('No se encontraron CSVs en', SOURCES_DIR);
    process.exit(1);
  }

  // Headers canónicos del CSV unificado (mismo nombre que los de Spotify
  // + columna 'Source' al final).
  const HEADERS = [
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
    'Source',
  ];

  const byUri = new Map();
  const bySoft = new Map(); // softKey -> uri ya guardado (para dedup blando)
  // popularityByUri[uri] = number 0-100, usado para recortar al MAX_CATALOG_SIZE.
  const popularityByUri = new Map();
  const stats = {
    read: 0,
    dupes: 0,        // descartes por URI duplicado
    softDupes: 0,    // descartes por dedup blando (URI distinto, misma cancion)
    badDuration: 0,  // descartes por Duration (ms) ausente o invalido
    orphans: 0,
    capCut: 0,       // descartes por superar MAX_CATALOG_SIZE
    kept: 0,
    perFile: {},
  };

  for (const file of files) {
    const sourceName = file.replace(/\.csv$/, '');
    const content = readFileSync(join(SOURCES_DIR, file), 'utf-8');
    const lines = content.split(/\r?\n/);
    const header = parseLine(lines[0]).map((h) => h.trim());
    const idx = (name) =>
      header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const cols = {
      uri: idx('Track URI'),
      name: idx('Track Name'),
      artists: idx('Artist Name(s)'),
      album: idx('Album Name'),
      genres: idx('Genres'),
      tempo: idx('Tempo'),
      energy: idx('Energy'),
      valence: idx('Valence'),
      danceability: idx('Danceability'),
      duration: idx('Duration (ms)'),
      popularity: idx('Popularity'),
    };
    if (cols.uri < 0 || cols.tempo < 0) {
      console.error(`[${file}] sin columnas Track URI o Tempo, salto`);
      continue;
    }

    let perFileKept = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const parts = parseLine(line);
      const uri = parts[cols.uri];
      const tempo = parseFloat(parts[cols.tempo]);
      if (!uri || isNaN(tempo)) continue;
      stats.read++;

      if (byUri.has(uri)) {
        stats.dupes++;
        continue;
      }
      if (!fitsAnyCadence(tempo)) {
        stats.orphans++;
        continue;
      }

      // Filtro durationMs: si la columna esta vacia o no es positiva, el
      // track explota el matching (un slot por segundo de zona). Es preferible
      // descartar ese track que dejarlo pasar y romper la regla cero
      // repeticiones.
      const durationStr = cols.duration >= 0 ? (parts[cols.duration] ?? '') : '';
      const duration = parseFloat(durationStr);
      if (!Number.isFinite(duration) || duration <= 0) {
        stats.badDuration++;
        continue;
      }

      // Dedup blando: si ya hay un track con misma cancion+artista
      // (normalizado), saltamos este aunque tenga URI distinto. First-wins
      // por orden alfabetico de archivo (definido por sort() arriba).
      const trackName = parts[cols.name] ?? '';
      const trackArtists = parts[cols.artists] ?? '';
      const sk = softKey(trackName, trackArtists);
      if (sk !== '' && bySoft.has(sk)) {
        stats.softDupes++;
        continue;
      }
      if (sk !== '') bySoft.set(sk, uri);

      // Memorizar popularidad para el recorte posterior. Spotify la trae
      // como 0-100; si la columna no existe o falta, usamos 0 (ultimo en
      // ranking de tiebreaker).
      const popularity =
        cols.popularity >= 0
          ? parseFloat(parts[cols.popularity] ?? '0')
          : 0;
      popularityByUri.set(uri, Number.isFinite(popularity) ? popularity : 0);

      byUri.set(uri, [
        uri,
        parts[cols.name] ?? '',
        parts[cols.artists] ?? '',
        cols.album >= 0 ? (parts[cols.album] ?? '') : '',
        cols.genres >= 0 ? (parts[cols.genres] ?? '') : '',
        parts[cols.tempo] ?? '',
        cols.energy >= 0 ? (parts[cols.energy] ?? '') : '',
        cols.valence >= 0 ? (parts[cols.valence] ?? '') : '',
        cols.danceability >= 0 ? (parts[cols.danceability] ?? '') : '',
        cols.duration >= 0 ? (parts[cols.duration] ?? '') : '',
        sourceName,
      ]);
      perFileKept++;
      stats.kept++;
    }
    stats.perFile[file] = perFileKept;
  }

  // Recorte por MAX_CATALOG_SIZE: si pasamos del limite, conservamos los
  // mas populares. Spotify Popularity 0-100 es estable y refleja escuchas
  // recientes — el track con popularity baja casi nunca lo conoce el usuario.
  let allRows = Array.from(byUri.entries());
  if (allRows.length > MAX_CATALOG_SIZE) {
    stats.capCut = allRows.length - MAX_CATALOG_SIZE;
    allRows.sort((a, b) => {
      const pa = popularityByUri.get(a[0]) ?? 0;
      const pb = popularityByUri.get(b[0]) ?? 0;
      if (pb !== pa) return pb - pa; // popularidad desc
      return a[0].localeCompare(b[0]); // tiebreaker estable por uri
    });
    allRows = allRows.slice(0, MAX_CATALOG_SIZE);
    stats.kept = MAX_CATALOG_SIZE;
  }

  // Escribir CSV ordenado por tempo ascendente — facilita inspeccion humana.
  const rows = allRows
    .map(([, row]) => row)
    .sort((a, b) => parseFloat(a[5]) - parseFloat(b[5]));
  const out = [
    HEADERS.join(','),
    ...rows.map((r) => r.map(quote).join(',')),
  ].join('\n');
  writeFileSync(OUT_FILE, out + '\n', 'utf-8');

  console.log('Catálogo unificado escrito en', OUT_FILE);
  console.log('Tracks por archivo origen:');
  for (const [k, v] of Object.entries(stats.perFile))
    console.log('  ' + k + ': ' + v + ' añadidos');
  console.log('---');
  console.log('Leídos:', stats.read);
  console.log('Duplicados por URI saltados:', stats.dupes);
  console.log('Duplicados blandos saltados (versiones misma canción):', stats.softDupes);
  console.log('Sin Duration (ms) válido descartados:', stats.badDuration);
  console.log('Huérfanos descartados (no encajan en ninguna cadencia):', stats.orphans);
  if (stats.capCut > 0) {
    console.log(
      `Recorte por MAX_CATALOG_SIZE=${MAX_CATALOG_SIZE} (popularidad asc):`,
      stats.capCut,
    );
  }
  console.log('Total final en all.csv:', stats.kept);
}

main();
