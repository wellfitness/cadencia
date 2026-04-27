export type { ClassifiedSegment, RouteMeta } from './types';
export { classifyZone } from './classifyZone';
export { segmentInto60SecondBlocks, type SegmentationResult } from './blocks';
export type {
  CadenceProfile,
  Phase,
  SessionBlock,
  SessionItem,
  EditableSessionPlan,
  SessionPlan,
  SessionTemplate,
  SessionTemplateId,
  SessionPlanValidation,
} from './sessionPlan';
export {
  CADENCE_PROFILES,
  PHASES,
  defaultCadenceProfile,
  expandSessionPlan,
  calculateTotalDurationSec,
  getValidProfiles,
  reconcileCadenceProfile,
  validateSessionPlan,
} from './sessionPlan';
export { inferCadenceProfileFromSlopePct } from './blocks';
export { SESSION_TEMPLATES, findTemplate } from './sessionTemplates';
export { classifySessionPlan, buildSessionRouteMeta } from './fromSessionBlocks';
