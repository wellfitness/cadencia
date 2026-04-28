#!/usr/bin/env node
/**
 * build-tracks.mjs — Compila el catálogo nativo unificado.
 *
 * Lee todos los CSVs de Spotify en src/data/tracks/sources/, deduplica por
 * Track URI (first-wins), descarta tracks que no encajen en NINGUNA cadencia
 * de las 6 zonas (60-80 ∪ 70-90 ∪ 90-115 ∪ 110-160 ∪ 140-180 ∪ 180-230 BPM)
 * y escribe el resultado en src/data/tracks/all.csv.
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

function fitsAnyCadence(bpm) {
  for (const [lo, hi] of FIT_RANGES) {
    if (bpm >= lo && bpm <= hi) return true;
  }
  return false;
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
  const stats = { read: 0, dupes: 0, orphans: 0, kept: 0, perFile: {} };

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

  // Escribir CSV ordenado por tempo ascendente — facilita inspeccion humana.
  const rows = Array.from(byUri.values()).sort(
    (a, b) => parseFloat(a[5]) - parseFloat(b[5]),
  );
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
  console.log('Duplicados saltados:', stats.dupes);
  console.log('Huérfanos descartados (no encajan en ninguna cadencia):', stats.orphans);
  console.log('Total final en all.csv:', stats.kept);
}

main();
