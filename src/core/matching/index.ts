export type { MatchPreferences, MatchedSegment, MatchQuality, ZoneMusicCriteria } from './types';
export { EMPTY_PREFERENCES } from './types';
export { ZONE_MUSIC_CRITERIA, applyAllEnergetic } from './zoneCriteria';
export { scoreTrack } from './score';
export { matchTracksToSegments, type CrossZoneMode, type MatchOptions } from './match';
export { replaceTrackInSegment, type ReplaceResult } from './replaceTrack';
export { analyzePoolCoverage, type PoolCoverage, type ZoneCoverage } from './poolCoverage';
