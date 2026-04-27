import type { HeartRateZone } from '../physiology/karvonen';
import {
  defaultCadenceProfile,
  type CadenceProfile,
  type Phase,
  type SessionBlock,
  type SessionItem,
  type SessionTemplate,
} from './sessionPlan';

/**
 * Plantillas predefinidas de sesiones indoor cycling. Estructuras validadas
 * por la literatura (SIT/Bangsbo/Helgerud) adaptadas a la clasificacion en
 * 6 zonas de la app:
 *   - SIT: sprints anaerobicos como Z6+sprint (no Z5).
 *   - HIIT 10-20-30: el ultimo intervalo (10s) es Z6+sprint.
 *   - Noruego 4x4: Z4+flat (umbral sostenible).
 *   - Z2 continuo: Z2+flat.
 *
 * Las plantillas son funciones puras (sin estado) y los IDs son estaticos
 * para que los tests sean deterministas y React reciba keys estables.
 */

function block(
  id: string,
  phase: Phase,
  zone: HeartRateZone,
  durationSec: number,
  description: string,
  cadenceProfile?: CadenceProfile,
): SessionBlock {
  return {
    id,
    phase,
    zone,
    cadenceProfile: cadenceProfile ?? defaultCadenceProfile(zone),
    durationSec,
    description,
  };
}

function group(id: string, repeat: number, blocks: SessionBlock[]): SessionItem {
  return { type: 'group', id, repeat, blocks };
}

function single(b: SessionBlock): SessionItem {
  return { type: 'block', block: b };
}

const SIT: SessionTemplate = {
  id: 'sit',
  name: 'SIT — Sprint Intervals',
  description:
    'Seis sprints de 30 segundos al máximo con 4 minutos de recuperación. Estímulo neuromuscular potente y corto, ideal cuando hay poco tiempo.',
  items: [
    single(block('sit-warmup', 'warmup', 2, 5 * 60, 'Calentamiento progresivo')),
    group('sit-sprints', 6, [
      block('sit-sprint', 'work', 6, 30, 'Sprint a tope'),
      block('sit-recovery', 'recovery', 1, 4 * 60, 'Pedaleo muy suave'),
    ]),
    single(block('sit-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * HIIT 10-20-30 (protocolo Bangsbo). El sub-ciclo de 1 minuto (30s suave +
 * 20s tempo + 10s sprint) se repite 5 veces dentro de cada bloque, y luego
 * el bloque de 5 minutos se repite 4 veces. Para evitar grupos anidados
 * pre-expandimos las 5 sub-rondas dentro del grupo principal × 4.
 */
const HIIT_10_20_30: SessionTemplate = {
  id: 'hiit-10-20-30',
  name: 'HIIT 10-20-30',
  description:
    'Protocolo Bangsbo: ciclos de 30 s suave, 20 s tempo y 10 s sprint, repetidos 5 veces por bloque, en 4 bloques. Mejora VO2max y umbral.',
  items: [
    single(block('hiit-warmup', 'warmup', 2, 10 * 60, 'Calentamiento')),
    group(
      'hiit-rounds',
      4,
      ['a', 'b', 'c', 'd', 'e'].flatMap((s) => [
        block(`hiit-easy-${s}`, 'recovery', 2, 30, '30 s suave'),
        block(`hiit-tempo-${s}`, 'work', 3, 20, '20 s tempo'),
        block(`hiit-sprint-${s}`, 'work', 6, 10, '10 s sprint'),
      ]),
    ),
    single(block('hiit-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
};

const NORUEGO_4X4: SessionTemplate = {
  id: 'noruego-4x4',
  name: 'Noruego 4×4',
  description:
    'Protocolo Helgerud: 4 intervalos de 4 minutos a umbral con 3 minutos de recuperación entre cada uno. El estándar oro para mejorar VO2max.',
  items: [
    single(block('nor-warmup', 'warmup', 2, 10 * 60, 'Calentamiento')),
    group('nor-intervals', 4, [
      block('nor-work', 'work', 4, 4 * 60, '4 minutos a umbral'),
      block('nor-recovery', 'recovery', 2, 3 * 60, '3 minutos suaves'),
    ]),
    single(block('nor-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

const ZONA2_CONTINUO: SessionTemplate = {
  id: 'zona2-continuo',
  name: 'Zona 2 continuo',
  description:
    'Sesenta minutos en Zona 2 sostenida tras un calentamiento. Base aeróbica, conversación posible. Excelente para días de volumen.',
  items: [
    single(block('z2-warmup', 'warmup', 1, 10 * 60, 'Calentamiento progresivo')),
    single(block('z2-main', 'main', 2, 60 * 60, '60 minutos en Zona 2 sostenida')),
    single(block('z2-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

export const SESSION_TEMPLATES: readonly SessionTemplate[] = [
  SIT,
  HIIT_10_20_30,
  NORUEGO_4X4,
  ZONA2_CONTINUO,
] as const;

export function findTemplate(id: string): SessionTemplate | undefined {
  return SESSION_TEMPLATES.find((t) => t.id === id);
}
