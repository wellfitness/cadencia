import type { MatchPreferences, MatchedSegment } from '@core/matching';
import type { ClassifiedSegment, EditableSessionPlan, RouteMeta } from '@core/segmentation';

/**
 * Persistencia del state del wizard en sessionStorage. Necesaria porque el
 * flow OAuth de Spotify hace un full page redirect (a accounts.spotify.com,
 * vuelve a /callback, redirige a /). Sin persistencia, el state de React se
 * resetea y el usuario tendria que reintroducir todo (datos -> ruta -> musica)
 * tras cada autorizacion.
 *
 * Por que sessionStorage y NO localStorage: misma regla CLAUDE.md, los datos
 * fisiologicos y la ruta se borran al cerrar la pestana. Aqui igual.
 */

export type RouteSourceType = 'gpx' | 'session';

export type MusicSourceMode = 'predefined' | 'mine' | 'both';

export interface WizardState {
  currentStep: number;
  completedSteps: readonly number[];
  routeSegments: readonly ClassifiedSegment[] | null;
  routeMeta: RouteMeta | null;
  matchedList: readonly MatchedSegment[] | null;
  musicPreferences: MatchPreferences;
  /** Origen de la ruta: GPX subido o sesion construida manualmente. */
  sourceType?: RouteSourceType;
  /**
   * Plan editable de sesion indoor cycling (solo si sourceType === 'session').
   * Se persiste en su forma editable (con grupos × N visibles) para que el
   * usuario recupere su estructura tras un redirect OAuth.
   */
  sessionPlan?: EditableSessionPlan;
  /** Plantilla de sesion activa (si la cargo desde la galeria). */
  activeTemplateId?: string | null;
  /** Fuente del catalogo elegida en MusicStep. */
  musicSourceMode?: MusicSourceMode;
  /** Indices del matching que el usuario reemplazo manualmente con "Otro tema". */
  replacedIndices?: readonly number[];
  /** Nombre custom de la playlist tecleado por el usuario en ResultStep. */
  playlistName?: string;
}

// v2: ampliacion del schema con activeTemplateId, musicSourceMode, replacedIndices,
// playlistName. Cambio de version para invalidar v1 viejos sin esos campos.
const STORAGE_KEY = 'vatios:wizardState:v2';

export function saveWizardState(state: WizardState): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cuota excedida o storage deshabilitado: no rompe la app, solo se
    // pierde la persistencia. El usuario tendra que reintroducir si vuelve
    // del OAuth.
  }
}

export function loadWizardState(): WizardState | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isWizardState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWizardState(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isWizardState(value: unknown): value is WizardState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['currentStep'] === 'number' &&
    Array.isArray(v['completedSteps']) &&
    (v['routeSegments'] === null || Array.isArray(v['routeSegments'])) &&
    (v['routeMeta'] === null || typeof v['routeMeta'] === 'object') &&
    (v['matchedList'] === null || Array.isArray(v['matchedList'])) &&
    typeof v['musicPreferences'] === 'object' &&
    v['musicPreferences'] !== null &&
    (v['sourceType'] === undefined ||
      v['sourceType'] === 'gpx' ||
      v['sourceType'] === 'session') &&
    (v['sessionPlan'] === undefined ||
      (typeof v['sessionPlan'] === 'object' && v['sessionPlan'] !== null)) &&
    (v['activeTemplateId'] === undefined ||
      v['activeTemplateId'] === null ||
      typeof v['activeTemplateId'] === 'string') &&
    (v['musicSourceMode'] === undefined ||
      v['musicSourceMode'] === 'predefined' ||
      v['musicSourceMode'] === 'mine' ||
      v['musicSourceMode'] === 'both') &&
    (v['replacedIndices'] === undefined || Array.isArray(v['replacedIndices'])) &&
    (v['playlistName'] === undefined || typeof v['playlistName'] === 'string')
  );
}
