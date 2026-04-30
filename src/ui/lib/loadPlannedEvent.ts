import { saveWizardState, type WizardState } from '@ui/state/wizardStorage';
import { loadCadenciaData } from '@ui/state/cadenciaStore';
import { getSavedSession } from '@core/sessions/saved';
import { EMPTY_PREFERENCES } from '@core/matching';
import type { PlannedEvent, EventInstance } from '@core/calendar';

/**
 * Helpers para cargar una entrada del calendario al wizard.
 *
 * Decision de implementacion: full reload via `window.location.assign('/')`
 * en vez de navigateInApp(). Razones:
 *  - WizardApp lee `loadWizardState()` solo en el primer mount (lazy state).
 *    Un cambio del sessionStorage no se propaga a un componente ya montado.
 *  - El full reload garantiza que el wizard arranque desde cero con el state
 *    inyectado, evitando bugs sutiles de state stale (ej. plan editado en
 *    memoria que sobrevive al pushState).
 *  - El usuario percibe identico flujo: una transicion completa al wizard.
 */

const STEP_DATA = 1;
const STEP_ROUTE = 2;
const STEP_MUSIC = 3;

/**
 * Construye el WizardState base con el snapshot reactivo de
 * musicPreferences del cadenciaStore (asi el usuario mantiene sus
 * generos preferidos / "todo con energia" / seed).
 */
function baseWizardState(): WizardState {
  const data = loadCadenciaData();
  return {
    currentStep: STEP_DATA,
    completedSteps: [],
    routeSegments: null,
    routeMeta: null,
    matchedList: null,
    musicPreferences: data.musicPreferences ?? EMPTY_PREFERENCES,
  };
}

/**
 * Indica si el cadenciaStore tiene `userInputs` ya rellenos. Si no, el
 * usuario tendra que pasar por el paso `Datos` antes de continuar (no
 * podemos saltarlo, lo necesitan tanto SessionBuilder como el matching).
 */
function hasUserInputs(): boolean {
  const data = loadCadenciaData();
  return data.userInputs !== null;
}

export interface LoadIndoorResult {
  ok: true;
  jumpedTo: 'data' | 'music';
}

export interface LoadOutdoorResult {
  ok: true;
  jumpedTo: 'data' | 'route';
}

export interface LoadIndoorMissing {
  ok: false;
  reason: 'session-deleted';
}

/**
 * Carga una entrada indoor planificada al wizard. Resuelve la SavedSession
 * referenciada; si fue borrada (sync de otro device), retorna error para
 * que la UI lo muestre y permita editar/eliminar la entrada del calendario.
 *
 * Si el usuario ya tiene userInputs guardados, salta directo al paso de
 * Musica (donde el matching usa el plan ya cargado). Si no, va al paso
 * de Datos para rellenarlos primero.
 */
export function loadIndoorPlannedEvent(
  savedSessionId: string,
): LoadIndoorResult | LoadIndoorMissing {
  const session = getSavedSession(savedSessionId);
  if (session === null) return { ok: false, reason: 'session-deleted' };

  const dataReady = hasUserInputs();
  const next: WizardState = {
    ...baseWizardState(),
    sourceType: 'session',
    sessionPlan: session.plan,
    currentStep: dataReady ? STEP_MUSIC : STEP_DATA,
    completedSteps: dataReady ? [0, 1, 2] : [0],
  };
  saveWizardState(next);
  window.location.assign('/');
  return { ok: true, jumpedTo: dataReady ? 'music' : 'data' };
}

/**
 * Carga una entrada outdoor planificada al wizard. El `plannedRouteContext`
 * se mostrara como banner en `RouteStep` para recordar al usuario que debe
 * subir el GPX correspondiente.
 */
export function loadOutdoorPlannedEvent(args: {
  name: string;
  notes?: string;
  externalUrl?: string;
}): LoadOutdoorResult {
  const dataReady = hasUserInputs();
  const next: WizardState = {
    ...baseWizardState(),
    sourceType: 'gpx',
    plannedRouteContext: {
      name: args.name,
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
      ...(args.externalUrl !== undefined ? { externalUrl: args.externalUrl } : {}),
    },
    currentStep: dataReady ? STEP_ROUTE : STEP_DATA,
    completedSteps: dataReady ? [0, 1] : [0],
  };
  saveWizardState(next);
  window.location.assign('/');
  return { ok: true, jumpedTo: dataReady ? 'route' : 'data' };
}

/** Conveniencia: dispatchea por tipo de evento. */
export function loadPlannedEventToWizard(
  event: PlannedEvent | EventInstance,
):
  | LoadIndoorResult
  | LoadOutdoorResult
  | LoadIndoorMissing {
  const e = 'event' in event ? event.event : event;
  if (e.type === 'indoor') {
    return loadIndoorPlannedEvent(e.savedSessionId);
  }
  const args: { name: string; notes?: string; externalUrl?: string } = {
    name: e.name,
  };
  if (e.notes !== undefined) args.notes = e.notes;
  if (e.externalUrl !== undefined) args.externalUrl = e.externalUrl;
  return loadOutdoorPlannedEvent(args);
}
