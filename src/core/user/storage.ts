import { EMPTY_USER_INPUTS, type UserInputsRaw } from './userInputs';

/**
 * Wrapper de almacenamiento del navegador para los datos fisiologicos del
 * usuario. Aislado aqui para que el resto del core no toque APIs del DOM
 * (cada acceso esta protegido con try/catch para sobrevivir a restricciones
 * de almacenamiento — modo privado, cuota llena, WebView restringida, etc.).
 *
 * Hay dos backends:
 *
 * - sessionStorage (siempre activo): los datos viven mientras la pestana
 *   este abierta. Es el comportamiento por defecto y el que sobrevive al
 *   redirect del OAuth de Spotify dentro de la misma pestana.
 *
 * - localStorage (opt-in explicito): el usuario marca "Recordar mis datos
 *   en este dispositivo" y los datos persisten entre sesiones. Sigue siendo
 *   100% cliente — los datos nunca salen del navegador del usuario. La key
 *   contiene un wrapper { version, inputs } para soportar migraciones
 *   futuras del shape de UserInputsRaw sin perder los datos persistidos.
 *
 * La flag de opt-in NO es una key separada: la presencia misma de la key en
 * localStorage senaliza que el opt-in esta activo. Esto evita estados
 * inconsistentes (flag=true sin datos o viceversa).
 */

const SESSION_KEY = 'vatios:userInputs:v1';
const LOCAL_KEY = 'vatios:userInputs:persistent:v1';

/** Version del wrapper persistido en localStorage. Bump si cambia el shape. */
const PERSISTED_VERSION = 1;

interface PersistedEnvelope {
  version: number;
  inputs: UserInputsRaw;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isSexOrNull(value: unknown): value is 'female' | 'male' | null {
  return value === null || value === 'female' || value === 'male';
}

function isUserInputsRaw(value: unknown): value is UserInputsRaw {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  // Campos opcionales en formatos antiguos: si no estan, defaultearan a null
  // al hacer merge sobre EMPTY_USER_INPUTS al cargar.
  const sexValue = 'sex' in v ? v['sex'] : null;
  return (
    isNumberOrNull(v['weightKg']) &&
    isNumberOrNull(v['ftpWatts']) &&
    isNumberOrNull(v['maxHeartRate']) &&
    isNumberOrNull(v['restingHeartRate']) &&
    isNumberOrNull(v['birthYear']) &&
    isSexOrNull(sexValue)
  );
}

function isPersistedEnvelope(value: unknown): value is PersistedEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['version'] === 'number' && isUserInputsRaw(v['inputs']);
}

// === sessionStorage (siempre activo, vida = pestana) ===

export function loadUserInputsFromSession(): UserInputsRaw | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isUserInputsRaw(parsed)) return null;
    // Merge sobre EMPTY garantiza que campos nuevos aparezcan en null si el
    // JSON viene de una version anterior del shape.
    return { ...EMPTY_USER_INPUTS, ...parsed };
  } catch {
    return null;
  }
}

export function saveUserInputsToSession(inputs: UserInputsRaw): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(inputs));
  } catch {
    // sessionStorage puede fallar (modo privado, cuota, WebView restringida).
    // Silencioso: el usuario sigue trabajando en memoria.
  }
}

export function clearUserInputsFromSession(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// === localStorage (opt-in, vida = hasta que el usuario lo borre) ===

/**
 * Carga los datos del usuario persistidos en localStorage. Devuelve null si
 * el opt-in no esta activo, si el JSON esta corrupto o si la version del
 * envelope es mayor que la conocida (datos guardados por una version futura
 * de la app que aun no se ha desplegado en este dispositivo).
 */
export function loadUserInputsFromLocal(): UserInputsRaw | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedEnvelope(parsed)) return null;
    if (parsed.version > PERSISTED_VERSION) return null;
    // Merge sobre EMPTY: campos nuevos respecto al envelope antiguo entran
    // en null. Esto resuelve migraciones forward-compatible sin necesidad
    // de migradores explicitos mientras el shape solo crezca.
    return { ...EMPTY_USER_INPUTS, ...parsed.inputs };
  } catch {
    return null;
  }
}

/**
 * Persiste los datos en localStorage. Llamar a esta funcion implicitamente
 * activa el opt-in (la presencia de la key es la senal). El envelope incluye
 * un campo `version` para que futuras migraciones puedan transformar el
 * shape sin perder los datos del usuario.
 */
export function saveUserInputsToLocal(inputs: UserInputsRaw): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const envelope: PersistedEnvelope = { version: PERSISTED_VERSION, inputs };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(envelope));
  } catch {
    // ignore (cuota, modo privado en algunos navegadores)
  }
}

/**
 * Borra los datos persistidos en localStorage y, en consecuencia, desactiva
 * el opt-in. No toca sessionStorage: la sesion en curso sigue activa hasta
 * que se cierre la pestana.
 */
export function clearUserInputsFromLocal(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
}

/**
 * Indica si el usuario ha activado la persistencia entre sesiones. La fuente
 * de verdad es la presencia de la key en localStorage; no hay flag separada.
 */
export function isPersistentStorageEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LOCAL_KEY) !== null;
  } catch {
    return false;
  }
}

// === API compuesta (load/save/clear con estrategia automatica) ===

/**
 * Carga los datos del usuario aplicando la estrategia "local primero,
 * session despues": si el opt-in esta activo, prevalece lo que haya en
 * localStorage; si no, cae a sessionStorage. Util como inicializador del
 * reducer de App.tsx en el primer render.
 */
export function loadUserInputs(): UserInputsRaw | null {
  const fromLocal = loadUserInputsFromLocal();
  if (fromLocal !== null) return fromLocal;
  return loadUserInputsFromSession();
}

/**
 * Persiste los datos. sessionStorage SIEMPRE se actualiza (necesario para
 * sobrevivir al OAuth redirect de Spotify dentro de la misma pestana).
 * localStorage solo se actualiza si `persistent === true`.
 */
export function saveUserInputs(inputs: UserInputsRaw, persistent: boolean): void {
  saveUserInputsToSession(inputs);
  if (persistent) {
    saveUserInputsToLocal(inputs);
  }
}

/**
 * Borra los datos del usuario en ambos storages. Util para la accion
 * "Olvidar mis datos guardados" o tras un reset completo del wizard.
 */
export function clearAllUserInputs(): void {
  clearUserInputsFromSession();
  clearUserInputsFromLocal();
}

export { EMPTY_USER_INPUTS };
