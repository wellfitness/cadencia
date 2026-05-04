import { loadUserInputsFromLocal, clearUserInputsFromLocal } from '@core/user/storage';
import { loadCadenciaData, updateSection } from './cadenciaStore';

/**
 * Migracion one-shot del storage legacy:
 *   - vatios:userInputs:persistent:v1  (opt-in localStorage previo)
 *     -> cadencia:data:v1.userInputs   (nuevo SoT)
 *
 * Se ejecuta al primer arranque tras el deploy con el cadenciaStore activo.
 * Idempotente: si cadencia:data:v1 ya tiene userInputs, no toca nada.
 *
 * Tras la migracion, el envelope legacy se borra para que las dos fuentes
 * de verdad no diverjan en el futuro (la app pasa a usar exclusivamente
 * cadenciaStore).
 */
export function migrateLegacyStorageOnce(): void {
  const cadencia = loadCadenciaData();
  if (cadencia.userInputs !== null) return;

  const legacy = loadUserInputsFromLocal();
  if (legacy === null) {
    // Puede ser que no hubiera datos legacy (nuevo usuario) o que el JSON
    // estuviera corrupto. En cualquier caso, limpiar la key para no dejar
    // almacenamiento zombie que se reintente en cada arranque sin éxito.
    clearUserInputsFromLocal();
    return;
  }

  updateSection('userInputs', legacy);
  clearUserInputsFromLocal();
}
