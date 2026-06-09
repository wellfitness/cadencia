import { loadUserInputsFromLocal, clearUserInputsFromLocal } from '@core/user/storage';
import { loadCadenciaData, saveCadenciaData } from './cadenciaStore';

/**
 * Migracion one-shot del storage legacy:
 *   - vatios:userInputs:persistent:v1  (opt-in localStorage previo)
 *     -> cadencia:data:v1.userInputs   (nuevo SoT)
 *
 * Se ejecuta al primer arranque tras el deploy con el cadenciaStore activo.
 * Idempotente: si cadencia:data:v1 ya tiene userInputs, no toca nada.
 * Desde que App.tsx dejo de escribir las keys `vatios:*`, la migracion es
 * one-shot de verdad: tras consumir el envelope legacy se borra y no vuelve
 * a regenerarse.
 *
 * IMPORTANTE — meta antigua, no `now()`: los datos migrados entran con
 * `_sectionMeta.userInputs.updatedAt = epoch`, no con el instante actual.
 * Las keys legacy no guardan fecha, asi que no sabemos cuan viejos son: con
 * meta fresca, un legacy stale ganaria el merge LWW y machacaria los datos
 * mas recientes guardados en Drive por otro dispositivo. Con epoch ocurre
 * lo correcto en ambos mundos: si no hay nada mejor (sin Drive, o Drive sin
 * userInputs), epoch > sin-meta y los datos migrados sobreviven; si Drive
 * tiene CUALQUIER version con meta real, esa gana.
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

  cadencia.userInputs = legacy;
  cadencia._sectionMeta.userInputs = { updatedAt: new Date(0).toISOString() };
  saveCadenciaData(cadencia);
  clearUserInputsFromLocal();
}
