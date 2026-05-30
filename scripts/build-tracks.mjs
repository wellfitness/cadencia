#!/usr/bin/env node
/**
 * build-tracks.mjs — Compila el catálogo nativo unificado.
 *
 * Se ejecuta con `tsx` (ver package.json) para poder importar la lógica
 * canónica de deduplicación desde `src/core/tracks/duplicates.ts` — la MISMA
 * que usa el editor de catálogos en la UI. Así hay una única fuente de verdad:
 * lo que el editor marca como duplicado es exactamente lo que el build elimina.
 *
 * Lee todos los CSVs de Spotify en src/data/tracks/sources/ y, por cada fila:
 *   1) Descarta tracks sin Tempo o cuyo BPM no encaje en NINGUNA de las 6
 *      ventanas de cadencia (60-80 ∪ 70-90 ∪ 90-115 ∪ 110-160 ∪ 140-180 ∪
 *      180-230 BPM).
 *   2) Descarta tracks sin Duration (ms) válido (rompen el matching).
 *   3) Dedup ESTRICTO por Track URI (first-wins).
 *   4) Dedup CANÓNICO por `dedupKey` (título limpio + artistas order-insensitive):
 *      todas las versiones de un mismo tema (remaster, radio edit, remix,
 *      extended, feat.…) se colapsan en una sola fila. De cada grupo sobrevive
 *      la versión «más limpia + más popular» (ver pickRepresentative).
 * Si tras dedups + filtros se supera MAX_CATALOG_SIZE, recorta a los más
 * populares. Escribe el resultado ordenado por tempo en src/data/tracks/all.csv.
 *
 * Se ejecuta a mano (`pnpm build:tracks`) cuando se actualicen las listas en
 * sources/. NO corre en cada `pnpm build` para no añadir latencia ni riesgo.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupKey, titleHasVersionMarker } from '../src/core/tracks/duplicates';

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

/** Separa el campo "Artist Name(s)" (separadores tipicos ';' o ',') en lista. */
function splitArtists(field) {
  return String(field || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
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

/**
 * De un grupo de candidatos con la misma clave canónica, elige el superviviente
 * con la regla «versión limpia + popular gana»:
 *   1) sin marcador de versión/feat (titleHasVersionMarker === false) primero,
 *   2) mayor Popularity,
 *   3) nombre más corto (más limpio),
 *   4) URI ascendente (desempate determinista).
 */
function pickRepresentative(candidates) {
  return [...candidates].sort((a, b) => {
    const ma = a.hasMarker ? 1 : 0;
    const mb = b.hasMarker ? 1 : 0;
    if (ma !== mb) return ma - mb;
    if (a.popularity !== b.popularity) return b.popularity - a.popularity;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0;
  })[0];
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

  // uri -> candidato { row, key, name, popularity, hasMarker, uri }
  const byUri = new Map();
  const stats = {
    read: 0,
    dupes: 0,        // descartes por URI duplicado
    softDupes: 0,    // descartes por dedup canonico (URI distinto, misma cancion)
    badDuration: 0,  // descartes por Duration (ms) ausente o invalido
    orphans: 0,      // descartes por no encajar en ninguna cadencia
    capCut: 0,       // descartes por superar MAX_CATALOG_SIZE
    kept: 0,
    perFile: {},
  };

  for (const file of files) {
    const sourceName = file.replace(/\.csv$/, '');
    const content = readFileSync(join(SOURCES_DIR, file), 'utf-8');
    const lines = content.split(/\r?\n/);
    const header = parseLine(lines[0]).map((h) => h.trim().replace(/^﻿/, ''));
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

      // Dedup estricto por URI: la misma pista en dos listas se cuenta una vez.
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

      const trackName = parts[cols.name] ?? '';
      const trackArtists = parts[cols.artists] ?? '';
      const popularity =
        cols.popularity >= 0 ? parseFloat(parts[cols.popularity] ?? '0') : 0;

      byUri.set(uri, {
        uri,
        name: trackName,
        key: dedupKey({ name: trackName, artists: splitArtists(trackArtists) }),
        popularity: Number.isFinite(popularity) ? popularity : 0,
        hasMarker: titleHasVersionMarker(trackName),
        row: [
          uri,
          trackName,
          trackArtists,
          cols.album >= 0 ? (parts[cols.album] ?? '') : '',
          cols.genres >= 0 ? (parts[cols.genres] ?? '') : '',
          parts[cols.tempo] ?? '',
          cols.energy >= 0 ? (parts[cols.energy] ?? '') : '',
          cols.valence >= 0 ? (parts[cols.valence] ?? '') : '',
          cols.danceability >= 0 ? (parts[cols.danceability] ?? '') : '',
          cols.duration >= 0 ? (parts[cols.duration] ?? '') : '',
          sourceName,
        ],
      });
      perFileKept++;
    }
    stats.perFile[file] = perFileKept;
  }

  // Agrupar por clave canonica y elegir un superviviente por grupo. Los tracks
  // con clave vacia (titulo no normalizable) no se agrupan: cada uno sobrevive.
  const groups = new Map(); // key -> candidato[]
  const survivors = [];
  for (const cand of byUri.values()) {
    if (cand.key === '') {
      survivors.push(cand);
      continue;
    }
    const arr = groups.get(cand.key);
    if (arr) arr.push(cand);
    else groups.set(cand.key, [cand]);
  }
  for (const group of groups.values()) {
    survivors.push(pickRepresentative(group));
    stats.softDupes += group.length - 1;
  }

  // Recorte por MAX_CATALOG_SIZE: si pasamos del limite, conservamos los mas
  // populares. Spotify Popularity 0-100 es estable y refleja escuchas recientes
  // — el track con popularity baja casi nunca lo conoce el usuario.
  let kept = survivors;
  if (kept.length > MAX_CATALOG_SIZE) {
    stats.capCut = kept.length - MAX_CATALOG_SIZE;
    kept = [...kept]
      .sort((a, b) => {
        if (b.popularity !== a.popularity) return b.popularity - a.popularity;
        return a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0; // tiebreaker estable
      })
      .slice(0, MAX_CATALOG_SIZE);
  }
  stats.kept = kept.length;

  // Escribir CSV ordenado por tempo ascendente — facilita inspeccion humana.
  const rows = kept
    .map((c) => c.row)
    .sort((a, b) => parseFloat(a[5]) - parseFloat(b[5]));
  const out = [
    HEADERS.join(','),
    ...rows.map((r) => r.map(quote).join(',')),
  ].join('\n');
  writeFileSync(OUT_FILE, out + '\n', 'utf-8');

  console.log('Catálogo unificado escrito en', OUT_FILE);
  console.log('Tracks por archivo origen (antes de dedup canónico global):');
  for (const [k, v] of Object.entries(stats.perFile))
    console.log('  ' + k + ': ' + v + ' candidatos');
  console.log('---');
  console.log('Leídos:', stats.read);
  console.log('Duplicados por URI saltados:', stats.dupes);
  console.log('Duplicados canónicos colapsados (versiones misma canción):', stats.softDupes);
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
