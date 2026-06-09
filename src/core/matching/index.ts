export type { MatchPreferences, MatchedSegment, MatchQuality, ZoneMusicCriteria } from './types';
export { EMPTY_PREFERENCES } from './types';
export { ZONE_MUSIC_CRITERIA, applyAllEnergetic, getZoneCriteria } from './zoneCriteria';
export { scoreTrack } from './score';
export {
  matchTracksToSegments,
  summarizeRepetitions,
  type CrossZoneMode,
  type MatchOptions,
  type RepetitionSummary,
} from './match';
export {
  getAlternativesForSegment,
  replaceTrackInSegment,
  moveTrackToSegment,
  type AlternativeCandidate,
  type ReplaceResult,
  type MoveResult,
} from './replaceTrack';
export { analyzePoolCoverage, type PoolCoverage, type ZoneCoverage } from './poolCoverage';
export { computeMatchSignature } from './signature';
