import type { HeartRateZone } from '../physiology/karvonen';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import type { MatchPreferences } from './types';
import { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';

/**
 * Duracion media estimada de un track (3:30). Se usa para estimar cuantos
 * tracks UNICOS necesita cada zona para cubrir su tiempo total. Pesimista:
 * en modo overlap un track puede cubrir 2-3 segmentos consecutivos, asi que
 * el calculo "tiempo total / 210 s" sobrestima ligeramente la necesidad
 * real. Es preferible un falso positivo (sugerir mas listas cuando no hace
 * falta) a un falso negativo (no avisar y tener huecos en la playlist).
 */
const AVG_TRACK_DURATION_SEC = 210;

export interface ZoneCoverage {
  zone: HeartRateZone;
  /** Tracks unicos necesarios para cubrir esta zona sin repetir. */
  needed: number;
  /** Tracks unicos disponibles en el pool que cumplen criterios de esta zona. */
  available: number;
  /** max(0, needed - available). 0 = pool suficiente. */
  deficit: number;
}

export interface PoolCoverage {
  /** True si todas las zonas tienen pool suficiente para cero repeticiones. */
  ok: boolean;
  /** Una entrada por cada zona presente en los segmentos. */
  byZone: ZoneCoverage[];
  /** Suma de deficits. 0 = ok. */
  totalDeficit: number;
}

/**
 * Pre-check de cobertura: dada una lista de segmentos y un pool de tracks,
 * estima si hay tracks unicos suficientes para asignar uno por segmento sin
 * repetir, separado por zona.
 *
 * Funcion pura, determinista. Pensada para llamarse en MusicStep antes de
 * permitir avanzar al ResultStep: si ok=false la UI muestra el deficit por
 * zona y bloquea hasta que el usuario anada mas listas.
 */
export function analyzePoolCoverage(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): PoolCoverage {
  // Tiempo total por zona (segundos).
  const durationByZone = new Map<HeartRateZone, number>();
  for (const seg of segments) {
    const prev = durationByZone.get(seg.zone) ?? 0;
    durationByZone.set(seg.zone, prev + seg.durationSec);
  }

  const byZone: ZoneCoverage[] = [];
  let totalDeficit = 0;

  // Iteramos zonas en orden 1..5 para salida estable (determinismo).
  for (const zone of [1, 2, 3, 4, 5] as const) {
    const totalDurationSec = durationByZone.get(zone) ?? 0;
    if (totalDurationSec === 0) continue;

    const baseCriteria = ZONE_MUSIC_CRITERIA[zone];
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    // Reusamos el mismo pipeline que el motor de matching para que la cuenta
    // refleje exactamente lo que el motor vera (incluyendo relax/best-effort).
    const { candidates } = findCandidates(tracks, effective);
    // Dedup por URI por seguridad (los CSVs nativos ya vienen dedupados,
    // pero un usuario podria subir CSVs con URIs repetidas).
    const available = new Set(candidates.map((t) => t.uri)).size;

    const needed = Math.max(1, Math.ceil(totalDurationSec / AVG_TRACK_DURATION_SEC));
    const deficit = Math.max(0, needed - available);
    totalDeficit += deficit;

    byZone.push({ zone, needed, available, deficit });
  }

  return {
    ok: totalDeficit === 0,
    byZone,
    totalDeficit,
  };
}
