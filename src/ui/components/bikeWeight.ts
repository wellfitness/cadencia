import { DEFAULTS, type BikeType } from '@core/user';

/**
 * Calcula el siguiente peso de bici al cambiar el tipo (decision 4 de la
 * auditoria del paso 1):
 *
 * - Si el usuario aun no ha tocado el campo (`currentWeight === null`), el
 *   form usa el placeholder del tipo nuevo. Devolvemos el default para
 *   reflejarlo como valor concreto.
 * - Si el peso actual coincide exactamente con el default del tipo previo,
 *   asumimos que el valor era una pre-carga y lo actualizamos al default
 *   del nuevo tipo.
 * - En cualquier otro caso (el usuario tecleo un valor distinto), respetamos
 *   su input devolviendo `null` para no disparar el dispatch.
 *
 * Funcion pura para que sea trivialmente testeable sin React.
 */
export function computeNextBikeWeight(args: {
  prevType: BikeType | null;
  nextType: BikeType;
  currentWeight: number | null;
}): number | null {
  const { prevType, nextType, currentWeight } = args;
  const newDefault = DEFAULTS.bikeWeightByType[nextType];
  if (currentWeight === null) {
    return newDefault;
  }
  const effectivePrev = prevType ?? DEFAULTS.bikeType;
  const prevDefault = DEFAULTS.bikeWeightByType[effectivePrev];
  if (currentWeight === prevDefault) {
    return newDefault;
  }
  return null;
}
