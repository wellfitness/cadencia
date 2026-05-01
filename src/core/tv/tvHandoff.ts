import type { EditableSessionPlan } from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user';

/**
 * Payload que viaja del wizard a la pestaña /tv. Incluye el plan editable y
 * los inputs validados — son los unicos datos que SessionTVMode necesita para
 * arrancar (todo lo demas, como zonas Karvonen, se deriva de estos dos).
 *
 * `templateId` es opcional y solo se rellena cuando el usuario lanza la
 * sesion desde una plantilla de SESSION_TEMPLATES (no cuando el plan se
 * construye desde cero). SessionTVMode lo usa para detectar plantillas-test
 * y disparar el TestResultDialog al completar la sesion.
 */
export interface TVHandoffPayload {
  plan: EditableSessionPlan;
  validatedInputs: ValidatedUserInputs;
  templateId?: string;
}

/**
 * localStorage = bus one-shot entre pestañas. Al abrir una pestaña nueva con
 * window.open('/tv') no podemos pasarle datos por argumento ni por URL (el
 * payload es demasiado grande: plan completo + inputs). Escribimos en
 * localStorage en la pestaña origen, leemos en la pestaña destino y borramos.
 */
export const TV_HANDOFF_LOCALSTORAGE_KEY = 'cadencia:tv-handoff';

/**
 * sessionStorage = persistencia per-tab. Una vez consumido el handoff de
 * localStorage, lo copiamos aqui para que sobreviva a un F5 dentro de /tv
 * sin contaminar el bus de otras pestañas que se abran despues.
 */
export const TV_HANDOFF_SESSIONSTORAGE_KEY = 'cadencia:tv-session';

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
      ? window.sessionStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Escribe el payload en localStorage. La pestaña destino lo consumira con
 * `readAndConsumeHandoff`. Si localStorage no esta disponible (modo privado
 * estricto, cuota llena, etc.) la operacion se descarta silenciosamente — la
 * pestaña destino vera el placeholder "esta pestaña debe abrirse desde Cadencia".
 */
export function writeHandoff(payload: TVHandoffPayload): void {
  const ls = getLocalStorage();
  if (ls === null) return;
  try {
    ls.setItem(TV_HANDOFF_LOCALSTORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Cuota excedida o storage deshabilitado: silenciar.
  }
}

/**
 * Lee el handoff. Politica:
 * 1. Si hay payload en localStorage → lo copia a sessionStorage, lo borra de
 *    localStorage (one-shot) y lo devuelve. Esto desacopla las pestañas: una
 *    segunda pestaña /tv abierta despues no recibe el mismo payload.
 * 2. Si no hay en localStorage pero si en sessionStorage → lo devuelve. Esto
 *    permite que un F5 dentro de /tv siga funcionando.
 * 3. Si no hay en ninguno → null.
 *
 * JSON corrupto en cualquiera de los dos: limpia esa entrada y devuelve null.
 * No rompe la app.
 */
export function readAndConsumeHandoff(): TVHandoffPayload | null {
  const ls = getLocalStorage();
  const ss = getSessionStorage();

  // Paso 1: localStorage (bus one-shot).
  if (ls !== null) {
    const raw = safeGetItem(ls, TV_HANDOFF_LOCALSTORAGE_KEY);
    if (raw !== null) {
      const parsed = safeParse(raw);
      if (parsed !== null) {
        // Copiar a sessionStorage y borrar el bus.
        if (ss !== null) {
          try {
            ss.setItem(TV_HANDOFF_SESSIONSTORAGE_KEY, raw);
          } catch {
            // Silenciar: la sesion no sobrevivira a F5 pero el render actual si.
          }
        }
        try {
          ls.removeItem(TV_HANDOFF_LOCALSTORAGE_KEY);
        } catch {
          // Silenciar.
        }
        return parsed;
      }
      // Corrupto: limpiar y caer al siguiente paso.
      try {
        ls.removeItem(TV_HANDOFF_LOCALSTORAGE_KEY);
      } catch {
        // Silenciar.
      }
    }
  }

  // Paso 2: sessionStorage (persistencia per-tab).
  if (ss !== null) {
    const raw = safeGetItem(ss, TV_HANDOFF_SESSIONSTORAGE_KEY);
    if (raw !== null) {
      const parsed = safeParse(raw);
      if (parsed !== null) return parsed;
      try {
        ss.removeItem(TV_HANDOFF_SESSIONSTORAGE_KEY);
      } catch {
        // Silenciar.
      }
    }
  }

  return null;
}

/** Borra ambas claves. Util para tests y para un "salir limpio" desde /tv. */
export function clearTVSession(): void {
  const ls = getLocalStorage();
  const ss = getSessionStorage();
  if (ls !== null) {
    try {
      ls.removeItem(TV_HANDOFF_LOCALSTORAGE_KEY);
    } catch {
      // Silenciar.
    }
  }
  if (ss !== null) {
    try {
      ss.removeItem(TV_HANDOFF_SESSIONSTORAGE_KEY);
    } catch {
      // Silenciar.
    }
  }
}

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeParse(raw: string): TVHandoffPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isTVHandoffPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isTVHandoffPayload(value: unknown): value is TVHandoffPayload {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as { plan?: unknown; validatedInputs?: unknown };
  if (obj.plan === undefined || obj.plan === null || typeof obj.plan !== 'object') return false;
  if (
    obj.validatedInputs === undefined ||
    obj.validatedInputs === null ||
    typeof obj.validatedInputs !== 'object'
  )
    return false;
  // Narrowing minimo: comprobamos las propiedades obligatorias mas indicativas
  // sin exigir validacion exhaustiva (los tipos de ValidatedUserInputs y
  // EditableSessionPlan son grandes; si alguien manipula el storage a mano y
  // pasa un objeto medio invalido, fallaria al renderizar y eso es aceptable).
  const plan = obj.plan as { name?: unknown; items?: unknown };
  if (typeof plan.name !== 'string' || !Array.isArray(plan.items)) return false;
  return true;
}
