import { passesCadenceFilter } from '../matching/candidates';
import { getZoneCriteria } from '../matching/zoneCriteria';
import type { HeartRateZone } from '../physiology/karvonen';
import type { CadenceProfile } from '../segmentation/sessionPlan';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Sport } from '../user/userInputs';
import { categorizeTag, MACRO_GENRES, type MacroGenreId } from './genreCategories';
import { getTopMacroGenres } from './topGenres';
import type { Track } from './types';

/**
 * Una celda de cobertura: cuantos tracks de un macro-genero pasan el
 * filtro de cadencia (1:1 ∪ 2:1) para una combinacion concreta
 * (zona, profile, sport).
 */
export interface GenreZoneCell {
  zone: HeartRateZone;
  cadenceProfile: CadenceProfile;
  candidateCount: number;
}

/**
 * Cobertura de un macro-genero sobre el catalogo activo: total de tracks
 * que lo contienen y desglose por celda (zona × profile). El campo
 * `genre` es el id estable del macro (compatibilidad de API con UI).
 */
export interface GenreCoverage {
  /** Id estable del macro (`'house'`, `'rock'`, ...). */
  genre: MacroGenreId;
  /** Etiqueta legible para mostrar al usuario (`'House'`, `'Rock'`, ...). */
  label: string;
  totalTracks: number;
  cells: readonly GenreZoneCell[];
}

/** Combinacion (zona, profile) sobre la que reportar cobertura. */
export interface ZoneProfileCombo {
  zone: HeartRateZone;
  cadenceProfile: CadenceProfile;
}

/**
 * Rejilla canonica de combinaciones cuando no hay sesion activa (catalogo /
 * preferencias page). En bike refleja las (zona, profile) realmente posibles
 * segun reconcileCadenceProfile: Z1-Z2 solo flat; Z3-Z4 flat + climb; Z5
 * climb; Z6 sprint. En run el profile es siempre 'flat' (informativo).
 */
const BIKE_CANONICAL_COMBOS: readonly ZoneProfileCombo[] = [
  { zone: 1, cadenceProfile: 'flat' },
  { zone: 2, cadenceProfile: 'flat' },
  { zone: 3, cadenceProfile: 'flat' },
  { zone: 3, cadenceProfile: 'climb' },
  { zone: 4, cadenceProfile: 'flat' },
  { zone: 4, cadenceProfile: 'climb' },
  { zone: 5, cadenceProfile: 'climb' },
  { zone: 6, cadenceProfile: 'sprint' },
];

const RUN_CANONICAL_COMBOS: readonly ZoneProfileCombo[] = [
  { zone: 1, cadenceProfile: 'flat' },
  { zone: 2, cadenceProfile: 'flat' },
  { zone: 3, cadenceProfile: 'flat' },
  { zone: 4, cadenceProfile: 'flat' },
  { zone: 5, cadenceProfile: 'flat' },
  { zone: 6, cadenceProfile: 'flat' },
];

/** Orden estable para profile dentro de una misma zona. */
const PROFILE_ORDER: Record<CadenceProfile, number> = {
  flat: 0,
  climb: 1,
  sprint: 2,
};

/**
 * Extrae las combinaciones unicas (zona, profile) de los segmentos de la
 * sesion activa, ordenadas por (zona asc, profile flat<climb<sprint). Si
 * `segments` es undefined o vacio devuelve la rejilla canonica del sport
 * pasado: util para mostrar cobertura en la pagina de preferencias o el
 * editor de catalogo, donde no hay sesion en curso.
 */
export function deriveSessionCombos(
  segments: readonly ClassifiedSegment[] | undefined,
  sport: Sport,
): readonly ZoneProfileCombo[] {
  if (segments === undefined || segments.length === 0) {
    return sport === 'run' ? RUN_CANONICAL_COMBOS : BIKE_CANONICAL_COMBOS;
  }
  const seen = new Map<string, ZoneProfileCombo>();
  for (const seg of segments) {
    // En run el profile es siempre 'flat' (placeholder informativo). Lo
    // normalizamos para que segments con profile='climb' no inflen combos.
    const profile: CadenceProfile = sport === 'run' ? 'flat' : seg.cadenceProfile;
    const key = `${seg.zone}-${profile}`;
    if (!seen.has(key)) {
      seen.set(key, { zone: seg.zone, cadenceProfile: profile });
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    if (a.zone !== b.zone) return a.zone - b.zone;
    return PROFILE_ORDER[a.cadenceProfile] - PROFILE_ORDER[b.cadenceProfile];
  });
}

/**
 * Calcula la cobertura por macro-genero sobre un pool de tracks y una
 * lista de combinaciones (zona, profile). Usa getTopMacroGenres para
 * limitar al top-N macros mas frecuentes (default = todos los macros con
 * al menos un track), y para cada macro cuenta cuantos tracks (unicos)
 * con tags de ese macro pasan el filtro de cadencia (1:1 ∪ 2:1) en cada
 * celda.
 *
 * Pure: no depende de DOM, fetch ni reloj. Determinista.
 */
export function computeGenreCoverage(
  tracks: readonly Track[],
  combos: readonly ZoneProfileCombo[],
  sport: Sport,
  topN: number = MACRO_GENRES.length,
): readonly GenreCoverage[] {
  if (tracks.length === 0 || combos.length === 0) return [];
  const top = getTopMacroGenres(tracks, topN);
  if (top.length === 0) return [];

  // Pre-construye los criterios de cada combo una sola vez (compartido entre
  // macros): evita llamar a getZoneCriteria N×M veces.
  const criteriaByCombo = combos.map((c) => ({
    combo: c,
    criteria: getZoneCriteria(c.zone, c.cadenceProfile, sport),
  }));

  // Agrupa los tracks por macro categorizando sus tags. Un track con varios
  // tags del mismo macro entra UNA sola vez en ese macro (Set dedup).
  const tracksByMacro = new Map<MacroGenreId, Set<Track>>();
  for (const m of top) {
    tracksByMacro.set(m.id, new Set());
  }
  for (const t of tracks) {
    const seen = new Set<MacroGenreId>();
    for (const g of t.genres) {
      const macro = categorizeTag(g);
      if (macro !== null && !seen.has(macro)) {
        seen.add(macro);
        tracksByMacro.get(macro)?.add(t);
      }
    }
  }

  return top.map(({ id, label, count }) => {
    const bucket = tracksByMacro.get(id) ?? new Set<Track>();
    const cells: GenreZoneCell[] = criteriaByCombo.map(({ combo, criteria }) => {
      let candidateCount = 0;
      for (const t of bucket) {
        if (passesCadenceFilter(t.tempoBpm, criteria)) candidateCount++;
      }
      return {
        zone: combo.zone,
        cadenceProfile: combo.cadenceProfile,
        candidateCount,
      };
    });
    return { genre: id, label, totalTracks: count, cells };
  });
}
