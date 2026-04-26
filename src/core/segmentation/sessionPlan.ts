import type { HeartRateZone } from '../physiology/karvonen';

/**
 * Modelo de datos del constructor de sesiones indoor cycling.
 *
 * Distingue dos representaciones del mismo plan:
 * - EditableSessionPlan: lo que el usuario edita en la UI, con grupos × N
 *   visibles para que la lista no crezca con cada repeticion.
 * - SessionPlan: el plan ya expandido (lineal), listo para alimentar la
 *   pipeline de segmentacion → matching.
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

export interface SessionBlock {
  /** Identificador estable usado como React key. Unico dentro del plan editable. */
  id: string;
  phase: Phase;
  zone: HeartRateZone;
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
  items: SessionItem[];
}

/**
 * Plan ya expandido. Cada repeticion de un grupo aparece como bloques
 * independientes con IDs unicos. Es la forma que consume la pipeline.
 */
export interface SessionPlan {
  name: string;
  blocks: SessionBlock[];
}

export type SessionTemplateId = 'sit' | 'hiit-10-20-30' | 'noruego-4x4' | 'zona2-continuo';

export interface SessionTemplate {
  id: SessionTemplateId;
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
  return { name: editable.name, blocks };
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
