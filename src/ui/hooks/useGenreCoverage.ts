import { useMemo } from 'react';
import {
  computeGenreCoverage,
  deriveSessionCombos,
  type GenreCoverage,
} from '@core/tracks';
import type { Track } from '@core/tracks';
import type { ClassifiedSegment } from '@core/segmentation';
import type { Sport } from '@core/user';

/**
 * Hook que envuelve `computeGenreCoverage + deriveSessionCombos` con useMemo.
 * Recalcula solo cuando cambian las dependencias referenciales (tracks,
 * segments o sport). Devuelve cobertura para los top-N generos del pool.
 *
 * Cuando segments es undefined o vacio, se usa la rejilla canonica del
 * sport — util en /preferencias y /catalogo donde no hay sesion activa.
 */
export function useGenreCoverage(
  tracks: readonly Track[],
  segments: readonly ClassifiedSegment[] | undefined,
  sport: Sport,
  topN = 12,
): readonly GenreCoverage[] {
  return useMemo(() => {
    const combos = deriveSessionCombos(segments, sport);
    return computeGenreCoverage(tracks, combos, sport, topN);
  }, [tracks, segments, sport, topN]);
}
