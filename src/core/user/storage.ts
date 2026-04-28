import { EMPTY_USER_INPUTS, type UserInputsRaw } from './userInputs';

const STORAGE_KEY = 'vatios:userInputs:v1';

/**
 * Wrapper de sessionStorage. Aislado aqui para que el resto del core no toque
 * APIs del DOM (cada acceso esta protegido con try/catch para sobrevivir a
 * restricciones de almacenamiento — modo privado, cuota llena, etc.).
 *
 * Por que sessionStorage (no localStorage):
 * Los datos fisiologicos del usuario solo viven mientras la pestana este
 * abierta. Es una decision de privacidad explicita en CLAUDE.md.
 */

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isSexOrNull(value: unknown): value is 'female' | 'male' | null {
  return value === null || value === 'female' || value === 'male';
}

function isUserInputsRaw(value: unknown): value is UserInputsRaw {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  // sex es opcional en el shape persistido (puede faltar en datos antiguos):
  // si esta lo validamos, si no, defaulteara a null al cargar.
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

export function loadUserInputsFromSession(): UserInputsRaw | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isUserInputsRaw(parsed)) return null;
    // Merge sobre EMPTY para garantizar que campos nuevos (p.ej. sex) caen en
    // null cuando el JSON viene de una version anterior del shape.
    return { ...EMPTY_USER_INPUTS, ...parsed };
  } catch {
    return null;
  }
}

export function saveUserInputsToSession(inputs: UserInputsRaw): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // sessionStorage puede fallar (modo privado, cuota, WebView restringida).
    // Silencioso a proposito: el usuario sigue trabajando en memoria.
  }
}

export function clearUserInputsFromSession(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { EMPTY_USER_INPUTS };
