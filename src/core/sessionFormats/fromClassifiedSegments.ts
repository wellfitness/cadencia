import type { HeartRateZone } from '../physiology/karvonen';
import {
  reconcileCadenceProfile,
  type CadenceProfile,
  type EditableSessionPlan,
  type Phase,
  type SessionBlock,
  type SessionItem,
} from '../segmentation/sessionPlan';
import type { ClassifiedSegment } from '../segmentation/types';

/**
 * Heurística de fase para un bloque del plan generado a partir de un GPX.
 *
 * - Primer bloque: warmup si Z1-Z2; en otro caso work (la ruta empieza
 *   directamente en intensidad media-alta).
 * - Último bloque: cooldown si Z1-Z2; en otro caso work.
 * - Intermedios: recovery si Z1-Z2; work si Z3-Z6.
 *
 * No buscamos perfección: phase no afecta a la física del .zwo, solo a
 * iconos/labels. La heurística es robusta a órdenes raros (rutas que
 * empiezan en bajada, etc.).
 */
function inferPhaseForGpx(zone: HeartRateZone, indexInPlan: number, totalItems: number): Phase {
  const isFirst = indexInPlan === 0;
  const isLast = indexInPlan === totalItems - 1;
  const isRecoveryZone = zone <= 2;

  if (isFirst && isRecoveryZone) return 'warmup';
  if (isLast && isRecoveryZone) return 'cooldown';
  if (isRecoveryZone) return 'recovery';
  return 'work';
}

/**
 * Adapta una ruta GPX ya clasificada (`ClassifiedSegment[]`) a un
 * `EditableSessionPlan` listo para serializar como .zwo o cargar en el
 * SessionBuilder. Hace dos cosas clave:
 *
 * 1. **Merge de bloques contiguos**: agrupa segmentos consecutivos con
 *    igual `(zone, cadenceProfile)` en un único `SessionBlock` cuya
 *    duración es la suma. Sin esto, una ruta de 1h produciría 60 bloques
 *    de 60s en el .zwo, ilegible en Zwift y absurdo desde punto de vista
 *    de entrenamiento estructurado.
 *
 * 2. **Asignación de phase**: heurística por posición + zona (ver
 *    `inferPhaseForGpx`). En el .zwo final esto decide warmup/cooldown
 *    con rampa vs SteadyState plano.
 *
 * El adaptador NO requiere FTP en Cadencia: los porcentajes %FTP en el
 * .zwo se derivan de la zona Coggan a través del mapeo `ZONE_TO_POWER`
 * en `zwo.ts`, y el smart trainer del usuario aplicará su propio FTP
 * local al reproducir el workout.
 *
 * Determinista: misma entrada → misma salida. IDs estables por posición
 * (`gpx-{index}`) para que el plan se pueda re-renderizar sin colisiones
 * de React keys.
 */
export function gpxToEditableSessionPlan(
  segments: readonly ClassifiedSegment[],
  routeName: string,
): EditableSessionPlan {
  if (segments.length === 0) {
    return { name: routeName, items: [] };
  }

  // Paso 1: merge de contiguos.
  interface Merged {
    zone: HeartRateZone;
    cadenceProfile: CadenceProfile;
    durationSec: number;
  }
  const merged: Merged[] = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && last.zone === s.zone && last.cadenceProfile === s.cadenceProfile) {
      last.durationSec += s.durationSec;
    } else {
      merged.push({
        zone: s.zone,
        cadenceProfile: s.cadenceProfile,
        durationSec: s.durationSec,
      });
    }
  }

  // Paso 2: convertir a SessionItem[] con phase inferida.
  const items: SessionItem[] = merged.map((m, i) => {
    const phase = inferPhaseForGpx(m.zone, i, merged.length);
    const cadenceProfile = reconcileCadenceProfile(m.zone, m.cadenceProfile);
    const block: SessionBlock = {
      id: `gpx-${i}`,
      phase,
      zone: m.zone,
      cadenceProfile,
      durationSec: Math.max(1, Math.round(m.durationSec)),
    };
    return { type: 'block', block };
  });

  return { name: routeName, items };
}
