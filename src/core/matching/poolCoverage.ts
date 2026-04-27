import type { HeartRateZone } from '../physiology/karvonen';
import type { CadenceProfile } from '../segmentation/sessionPlan';
import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import { findCandidates } from './candidates';
import type { MatchPreferences } from './types';
import { applyAllEnergetic, getZoneCriteria } from './zoneCriteria';

/**
 * Duracion media estimada de un track (3:30). Se usa para estimar cuantos
 * tracks UNICOS necesita la sesion para cubrir su duracion total sin
 * repetir, y de forma desglosada por (zona, profile) para diagnostico.
 */
const AVG_TRACK_DURATION_SEC = 210;

export interface ZoneCoverage {
  zone: HeartRateZone;
  cadenceProfile: CadenceProfile;
  /** Tracks unicos necesarios para cubrir este (zona, profile) sin repetir. */
  needed: number;
  /** Tracks unicos disponibles en el pool que cumplen los criterios. */
  available: number;
  /** max(0, needed - available). 0 = cobertura suficiente para esta combo. */
  deficit: number;
}

export interface PoolCoverage {
  /**
   * Cobertura global. ok=true cuando hay tracks unicos suficientes en el
   * catalogo para cubrir la sesion entera (independientemente de zona/profile).
   * Esto refleja la realidad del motor: en modo overlap un track puede cruzar
   * zonas, asi que el pool relevante es el TOTAL, no la suma por zona.
   */
  ok: boolean;
  /** Tracks unicos necesarios para cubrir la duracion total de la sesion. */
  neededTotal: number;
  /** Tracks unicos en el pool (dedupados por URI). */
  availableTotal: number;
  /** Diferencia global. 0 = pool suficiente. */
  deficitTotal: number;
  /**
   * Desglose por (zona, profile) presentes en los segmentos. **Informativo,
   * no bloqueante**: una combo con deficit=N solo significa que el motor
   * puede tirar de tracks de zonas adyacentes (cadencias solapadas) o pasar
   * a relax/best-effort. La UI lo muestra como pista, no como error.
   */
  byZone: ZoneCoverage[];
}

/**
 * Pre-check de cobertura: dada una lista de segmentos y un pool de tracks,
 * estima si hay tracks unicos suficientes para asignar uno por slot sin
 * repetir.
 *
 * Decision de diseno: la validacion bloqueante es GLOBAL (pool total ≥
 * necesidad total). El desglose por (zona, profile) es informativo porque
 * las zonas comparten cadencia (por profile) y un track puede cubrir
 * segmentos de zonas adyacentes en modo overlap.
 *
 * Funcion pura, determinista.
 */
export function analyzePoolCoverage(
  segments: readonly ClassifiedSegment[],
  tracks: readonly Track[],
  preferences: MatchPreferences,
): PoolCoverage {
  // Total: tracks unicos necesarios para cubrir la sesion entera.
  const totalDurationSec = segments.reduce((acc, s) => acc + s.durationSec, 0);
  const neededTotal = totalDurationSec === 0
    ? 0
    : Math.max(1, Math.ceil(totalDurationSec / AVG_TRACK_DURATION_SEC));
  const availableTotal = new Set(tracks.map((t) => t.uri)).size;
  const deficitTotal = Math.max(0, neededTotal - availableTotal);

  // Desglose por (zona, profile): solo informativo. Mismo cálculo que antes
  // pero la conclusion ok=true/false viene del global, no de aqui.
  const durationByCombo = new Map<
    string,
    { zone: HeartRateZone; profile: CadenceProfile; durationSec: number }
  >();
  for (const seg of segments) {
    const key = `${seg.zone}-${seg.cadenceProfile}`;
    const prev = durationByCombo.get(key);
    if (prev) {
      prev.durationSec += seg.durationSec;
    } else {
      durationByCombo.set(key, {
        zone: seg.zone,
        profile: seg.cadenceProfile,
        durationSec: seg.durationSec,
      });
    }
  }

  const profileOrder: Record<CadenceProfile, number> = { flat: 0, climb: 1, sprint: 2 };
  const sortedCombos = [...durationByCombo.values()].sort((a, b) => {
    if (a.zone !== b.zone) return a.zone - b.zone;
    return profileOrder[a.profile] - profileOrder[b.profile];
  });

  const byZone: ZoneCoverage[] = [];
  for (const combo of sortedCombos) {
    if (combo.durationSec === 0) continue;
    const baseCriteria = getZoneCriteria(combo.zone, combo.profile);
    const effective = applyAllEnergetic(baseCriteria, preferences.allEnergetic);
    const { candidates } = findCandidates(tracks, effective);
    const available = new Set(candidates.map((t) => t.uri)).size;
    const needed = Math.max(1, Math.ceil(combo.durationSec / AVG_TRACK_DURATION_SEC));
    byZone.push({
      zone: combo.zone,
      cadenceProfile: combo.profile,
      needed,
      available,
      deficit: Math.max(0, needed - available),
    });
  }

  return {
    ok: deficitTotal === 0,
    neededTotal,
    availableTotal,
    deficitTotal,
    byZone,
  };
}
