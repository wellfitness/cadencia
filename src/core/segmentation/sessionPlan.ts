import type { HeartRateZone } from '../physiology/karvonen';
import type { Sport } from '../user/userInputs';

/**
 * Modelo de datos del constructor de sesiones (indoor cycling y running).
 *
 * Distingue dos representaciones del mismo plan:
 * - EditableSessionPlan: lo que el usuario edita en la UI, con grupos × N
 *   visibles para que la lista no crezca con cada repeticion.
 * - SessionPlan: el plan ya expandido (lineal), listo para alimentar la
 *   pipeline de segmentacion → matching.
 *
 * Multisport: cada plan lleva un campo `sport: 'bike' | 'run'` que ramifica
 * el motor de matching (rangos de cadencia musical distintos por deporte). En
 * sesiones de running el campo `cadenceProfile` de cada bloque es informativo
 * pero NO afecta al matching (la cadencia de running se acopla a la zona, no
 * al terreno como en bici); por convencion se rellena con 'flat'.
 */

export type Phase = 'warmup' | 'work' | 'recovery' | 'rest' | 'cooldown' | 'main';

export const PHASES: readonly Phase[] = [
  'warmup',
  'work',
  'recovery',
  'rest',
  'cooldown',
  'main',
] as const;

/**
 * Perfil de cadencia del bloque. Determina, junto con la zona, el rango de
 * cadencia objetivo (rpm) y por tanto los tracks elegibles.
 *
 * - flat: pedalada continua sostenible.
 * - climb: cadencia baja, alta resistencia. Muros y escaladas.
 * - sprint: cadencia alta, pico neuromuscular. Anaerobico.
 */
export type CadenceProfile = 'flat' | 'climb' | 'sprint';

export const CADENCE_PROFILES: readonly CadenceProfile[] = ['flat', 'climb', 'sprint'] as const;

/**
 * Profiles disponibles por zona. Z1-Z2 solo flat (recuperacion). Z3-Z4
 * permiten flat o climb (tempo sostenido vs escalada moderada). Z5 es muro
 * (climb fijo). Z6 es sprint puro.
 */
const VALID_PROFILES_BY_ZONE: Record<HeartRateZone, readonly CadenceProfile[]> = {
  1: ['flat'],
  2: ['flat'],
  3: ['flat', 'climb'],
  4: ['flat', 'climb'],
  5: ['climb'],
  6: ['sprint'],
};

export function getValidProfiles(zone: HeartRateZone): readonly CadenceProfile[] {
  return VALID_PROFILES_BY_ZONE[zone];
}

/** Profile por defecto cuando no se especifica explicitamente. */
export function defaultCadenceProfile(zone: HeartRateZone): CadenceProfile {
  return VALID_PROFILES_BY_ZONE[zone][0]!;
}

/**
 * Si el profile recibido es valido para la zona lo devuelve; si no, vuelve
 * al default. Util al cargar planes guardados antes de la migracion (cuando
 * el campo cadenceProfile no existia o esta desincronizado con la zona).
 */
export function reconcileCadenceProfile(
  zone: HeartRateZone,
  profile: CadenceProfile | undefined,
): CadenceProfile {
  if (profile === undefined) return defaultCadenceProfile(zone);
  const valid = VALID_PROFILES_BY_ZONE[zone];
  return valid.includes(profile) ? profile : defaultCadenceProfile(zone);
}

export interface SessionBlock {
  /** Identificador estable usado como React key. Unico dentro del plan editable. */
  id: string;
  phase: Phase;
  zone: HeartRateZone;
  /** Cadencia objetivo del bloque (rpm). Determina los tracks elegibles via 1:1 o half-time. */
  cadenceProfile: CadenceProfile;
  durationSec: number;
  /** Texto opcional que se muestra en el modo TV durante la fase. */
  description?: string;
}

/**
 * Item del constructor: un bloque suelto, o un grupo con repeticiones que
 * encapsula varios bloques que deben ejecutarse en secuencia × N veces.
 */
export type SessionItem =
  | { type: 'block'; block: SessionBlock }
  | { type: 'group'; id: string; repeat: number; blocks: SessionBlock[] };

/** Lo que el usuario manipula en la UI. Persistido en sessionStorage. */
export interface EditableSessionPlan {
  name: string;
  /**
   * Deporte del plan. Opcional en el tipo por retrocompat con planes
   * persistidos antes de la extension a running; los lugares que ramifican
   * tratan undefined como 'bike'. Codigo nuevo (templates, wizard) lo set
   * explicitamente.
   */
  sport?: Sport;
  items: SessionItem[];
}

/**
 * Plan ya expandido. Cada repeticion de un grupo aparece como bloques
 * independientes con IDs unicos. Es la forma que consume la pipeline.
 */
export interface SessionPlan {
  name: string;
  sport?: Sport;
  blocks: SessionBlock[];
}

export type SessionTemplateId =
  // Ciclismo (sport: 'bike')
  | 'sit'
  | 'hiit-10-20-30'
  | 'noruego-4x4'
  | 'zona2-continuo'
  | 'tempo-mlss'
  | 'umbral-progresivo'
  | 'vo2max-cortos'
  | 'recuperacion-activa'
  // Running (sport: 'run')
  | 'run-easy-long'
  | 'run-tempo'
  | 'run-yasso-800'
  | 'run-daniels-intervals'
  | 'run-hiit-30-30'
  | 'run-threshold-cruise';

export interface SessionTemplate {
  id: SessionTemplateId;
  /** Deporte para el que esta disenada la plantilla. Opcional por retrocompat; las plantillas integradas lo setean explicitamente. */
  sport?: Sport;
  name: string;
  description: string;
  items: SessionItem[];
}

/**
 * Expande un plan editable a su forma lineal. Los grupos se repiten `repeat`
 * veces y cada copia recibe un sufijo `-r{i}` en el id de cada bloque para
 * evitar colisiones de React keys al renderizar el plan expandido.
 *
 * Determinista: misma entrada → misma salida.
 */
export function expandSessionPlan(editable: EditableSessionPlan): SessionPlan {
  const blocks: SessionBlock[] = [];
  for (const item of editable.items) {
    if (item.type === 'block') {
      blocks.push(item.block);
      continue;
    }
    const repeat = Math.max(1, Math.floor(item.repeat));
    for (let i = 0; i < repeat; i++) {
      for (const block of item.blocks) {
        blocks.push({
          ...block,
          id: `${block.id}-r${i}`,
        });
      }
    }
  }
  return { name: editable.name, sport: editable.sport ?? 'bike', blocks };
}

/**
 * Suma la duracion total de un plan editable resolviendo las repeticiones de
 * cada grupo. Util para mostrar el tiempo estimado en la cabecera del
 * constructor sin tener que expandir el plan completo.
 */
export function calculateTotalDurationSec(editable: EditableSessionPlan): number {
  let total = 0;
  for (const item of editable.items) {
    if (item.type === 'block') {
      total += item.block.durationSec;
      continue;
    }
    const repeat = Math.max(1, Math.floor(item.repeat));
    const groupDuration = item.blocks.reduce((acc, b) => acc + b.durationSec, 0);
    total += groupDuration * repeat;
  }
  return total;
}

export type SessionPlanValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Valida que un plan editable sea ejecutable: al menos un bloque, todas las
 * duraciones positivas, ningun grupo vacio o con repeticiones invalidas.
 */
export function validateSessionPlan(editable: EditableSessionPlan): SessionPlanValidation {
  if (editable.items.length === 0) {
    return { ok: false, reason: 'La sesión necesita al menos un bloque.' };
  }
  for (const item of editable.items) {
    if (item.type === 'block') {
      if (item.block.durationSec <= 0) {
        return { ok: false, reason: 'Hay un bloque con duración 0 o negativa.' };
      }
      continue;
    }
    if (item.blocks.length === 0) {
      return { ok: false, reason: 'Hay un grupo sin bloques dentro.' };
    }
    if (!Number.isFinite(item.repeat) || item.repeat < 1) {
      return { ok: false, reason: 'Hay un grupo con un número de repeticiones inválido.' };
    }
    for (const b of item.blocks) {
      if (b.durationSec <= 0) {
        return { ok: false, reason: 'Hay un bloque dentro de un grupo con duración 0 o negativa.' };
      }
    }
  }
  return { ok: true };
}
