/**
 * Accion que el efecto de matching de App debe tomar en un render dado:
 *   - 'skip'     no tocar la lista (preservar lo que haya, incluidas ediciones)
 *   - 'generate' (re)calcular la lista base desde los inputs actuales
 *   - 'clear'    vaciar la lista (la ruta dejo de existir)
 */
export type MatchListAction = 'skip' | 'generate' | 'clear';

export interface MatchListDecisionInput {
  /** True en el primer render tras montar/recargar (no hay firma previa). */
  isInitialRun: boolean;
  /** True si la firma de contenido de los inputs cambio respecto a la previa. */
  signatureChanged: boolean;
  /** True si ya existe una lista (rehidratada o generada). */
  hasMatchedList: boolean;
  /** True si hay una ruta segmentada (routeSegments !== null). */
  hasRoute: boolean;
}

/**
 * Decide si el efecto de matching debe regenerar la lista, preservarla o
 * vaciarla. Aislada como funcion pura para poder testear la regla sin montar
 * React.
 *
 * Dos objetivos que coexisten:
 *
 *  1. PRESERVAR las ediciones manuales tras un full-reload (OAuth de Spotify):
 *     la lista se rehidrata de sessionStorage y NO debe regenerarse aunque el
 *     `livePool` memoizado cambie de referencia con el mismo contenido. De ahi
 *     que en renders posteriores solo se regenere si la FIRMA (valor) cambia.
 *
 *  2. GARANTIZAR la invariante «hay ruta ⟹ hay lista»: si en el primer render
 *     existe ruta pero la lista no vino rehidratada, hay que generarla. Sin
 *     esto, Resultado se quedaria en «Genera la lista antes» indefinidamente
 *     (regresion que aparecio al dejar de regenerar por cambio de referencia).
 */
export function decideMatchListAction({
  isInitialRun,
  signatureChanged,
  hasMatchedList,
  hasRoute,
}: MatchListDecisionInput): MatchListAction {
  if (isInitialRun) {
    // Hay lista rehidratada: preservarla (y con ella las ediciones del usuario).
    if (hasMatchedList) return 'skip';
    // No hay lista: generarla si hay ruta; si no, no hay nada que hacer.
    return hasRoute ? 'generate' : 'skip';
  }
  // Renders posteriores: solo reaccionamos a cambios reales de contenido.
  if (!signatureChanged) return 'skip';
  return hasRoute ? 'generate' : 'clear';
}
