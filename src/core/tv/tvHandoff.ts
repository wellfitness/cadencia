import type { EditableSessionPlan } from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user';

/**
 * Datos minimos de Spotify que la pestaña /tv necesita para activar los
 * controles de musica integrados (Fase progressive enhancement).
 *
 * Por que va por handoff y no se lee directo del storage en la pestaña /tv:
 * los tokens viven en `sessionStorage` que es PER-PESTAÑA. La pestaña /tv
 * abierta con `window.open` arranca con sessionStorage vacio, asi que sin
 * este puente no veria los tokens del wizard. La pestaña /tv copia estos
 * tokens a SU sessionStorage en el primer render para que sobrevivan a F5.
 *
 * Si la usuaria no tiene Spotify conectado o no es Premium, este campo
 * va `undefined` y SessionTVMode degrada al comportamiento legacy (sin
 * controles integrados).
 */
export interface TVHandoffSpotify {
  /** Tokens completos del flow PKCE actual. La pestaña /tv los re-persiste. */
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAtMs: number;
    scope: string;
  };
  /**
   * Premium gating ya resuelto en la pestaña origen (tras llamar a /me). Si
   * `false`, los controles integrados se ocultan: los endpoints /me/player/*
   * devolverian 403 sistematicamente.
   */
  productPremium: boolean;
  /**
   * URIs de Spotify (`spotify:track:XXX`) en orden de bloque. `blockTrackUris[i]`
   * es el track que debe sonar durante `plan.blocks[i]`. La logica de cambio
   * de bloque en SessionTVMode dispara `play({uris: [blockTrackUris[i]]})` para
   * forzar la sincronizacion timer ↔ track.
   *
   * Cuando un mismo track cubre varios bloques consecutivos (modo `overlap`),
   * el array repite el URI: el motor de Spotify ignora el play() si la URI ya
   * esta sonando, asi que es seguro repetir.
   *
   * Longitud == numero de bloques expandidos del plan. Si esta vacio, no hay
   * playlist creada (no deberia pasar; SessionTVMode trata el caso defensive).
   */
  blockTrackUris: readonly string[];
}

/**
 * Payload que viaja del wizard a la pestaña /tv. Incluye el plan editable y
 * los inputs validados — son los unicos datos que SessionTVMode necesita para
 * arrancar (todo lo demas, como zonas Karvonen, se deriva de estos dos).
 *
 * `templateId` es opcional y solo se rellena cuando el usuario lanza la
 * sesion desde una plantilla de SESSION_TEMPLATES (no cuando el plan se
 * construye desde cero). SessionTVMode lo usa para detectar plantillas-test
 * y disparar el TestResultDialog al completar la sesion.
 *
 * `spotify` es opcional y solo se rellena si la usuaria tiene sesion Spotify
 * activa, es Premium y la playlist se ha creado con exito (URIs disponibles).
 */
export interface TVHandoffPayload {
  plan: EditableSessionPlan;
  validatedInputs: ValidatedUserInputs;
  templateId?: string;
  spotify?: TVHandoffSpotify;
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
