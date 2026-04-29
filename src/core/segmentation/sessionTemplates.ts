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
 * HIIT 10-20-30 (protocolo Bangsbo original). El sub-ciclo de 1 minuto
 * (30s suave + 20s tempo + 10s sprint) se repite 5 veces dentro de cada
 * bloque, y luego el bloque de 5 minutos se repite 4 veces con 2 minutos
 * de recuperacion Z2 entre cada uno (frontera fisiologica para que el set
 * se "rompa" — sin esa pausa la sesion es muy dura de llevar). Para evitar
 * grupos anidados pre-expandimos las 5 sub-rondas dentro del grupo principal
 * × 4 y a~nadimos el descanso al final del bloque.
 */
const HIIT_10_20_30: SessionTemplate = {
  id: 'hiit-10-20-30',
  name: 'HIIT 10-20-30',
  description:
    'Protocolo Bangsbo: 4 bloques de 5 sub-ciclos (30 s suave, 20 s tempo, 10 s sprint) separados por 2 minutos de recuperación Z2. Mejora VO2max y umbral con menos desgaste neuromuscular que un sprint puro.',
  items: [
    single(block('hiit-warmup', 'warmup', 2, 10 * 60, 'Calentamiento')),
    group('hiit-rounds', 4, [
      ...['a', 'b', 'c', 'd', 'e'].flatMap((s) => [
        block(`hiit-easy-${s}`, 'recovery', 2, 30, '30 s suave'),
        block(`hiit-tempo-${s}`, 'work', 3, 20, '20 s tempo'),
        block(`hiit-sprint-${s}`, 'work', 6, 10, '10 s sprint'),
      ]),
      block('hiit-rest', 'rest', 2, 2 * 60, 'Descanso entre bloques', 'flat'),
    ]),
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

/**
 * Tempo MLSS: capacidad aerobica de base. Tres bloques de 12 min en Z3 con
 * recuperacion activa Z2 entre cada uno. Coherente con la prescripcion del
 * XLSX: TMM 8-15 min, recuperacion 3-5 min Z2, TTA novato >=30 min (aqui
 * 36 min de trabajo neto).
 */
const TEMPO_MLSS: SessionTemplate = {
  id: 'tempo-mlss',
  name: 'Tempo MLSS',
  description:
    'Tres bloques de 12 minutos en Zona 3 (MLSS) con 4 minutos de recuperación activa entre cada uno. Mejora la capacidad aeróbica de base — el motor que sostiene cualquier intensidad.',
  items: [
    single(block('tempo-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    group('tempo-blocks', 3, [
      block('tempo-work', 'work', 3, 12 * 60, 'Tempo sostenido (MLSS)'),
      block('tempo-recovery', 'recovery', 2, 4 * 60, 'Pedaleo activo'),
    ]),
    single(block('tempo-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * Umbral progresivo: potencia umbral / VT2. Cinco intervalos de 5 min en Z4
 * con micropausas Z2 de 2 min. Coherente con la prescripcion del XLSX para
 * Z4 alta: TMM 3-8 min, recuperacion 1.5-2 min Z2, TTA avanzado 20 min
 * (aqui 25 min de trabajo neto).
 */
const UMBRAL_PROGRESIVO: SessionTemplate = {
  id: 'umbral-progresivo',
  name: 'Umbral progresivo',
  description:
    'Cinco intervalos de 5 minutos en Zona 4 (umbral / VT2) con micropausas de 2 minutos en Zona 2. Mejora la potencia umbral — la intensidad que puedes sostener sin acumular lactato.',
  items: [
    single(block('umbral-warmup', 'warmup', 2, 10 * 60, 'Calentamiento')),
    group('umbral-intervals', 5, [
      block('umbral-work', 'work', 4, 5 * 60, 'Umbral sostenido (VT2)'),
      block('umbral-recovery', 'recovery', 2, 2 * 60, 'Micropausa Z2'),
    ]),
    single(block('umbral-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * VO2max cortos: potencia aerobica maxima (PAM). Seis intervalos de 2 min
 * en Z5 (climb) con recuperacion casi total a Z1 de 1.5 min. Coherente con
 * la prescripcion del XLSX para Z5 alta: TMM 1-3 min, recuperacion 1-1.5
 * min Z1, TTA avanzado 10 min (aqui 12 min de trabajo neto). Z5 va fija a
 * 'climb' por VALID_PROFILES_BY_ZONE.
 */
const VO2MAX_CORTOS: SessionTemplate = {
  id: 'vo2max-cortos',
  name: 'VO2max cortos',
  description:
    'Seis intervalos de 2 minutos en Zona 5 (PAM) con 1,5 minutos de recuperación a Zona 1. Mejora la potencia aeróbica máxima — el techo cardiovascular del que cuelga todo lo demás.',
  items: [
    single(block('vo2-warmup', 'warmup', 2, 10 * 60, 'Calentamiento')),
    group('vo2-intervals', 6, [
      block('vo2-work', 'work', 5, 2 * 60, 'VO2max — empuja', 'climb'),
      block('vo2-recovery', 'recovery', 1, 90, 'Recupera del todo'),
    ]),
    single(block('vo2-cooldown', 'cooldown', 1, 8 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * Recuperacion activa: sesion suave sin intervalos para dias entre cargas
 * duras o regreso post-lesion. Coherente con la zona Z2 del XLSX
 * (RPE 3-4, ~70% FCmax, conversacion posible).
 */
const RECUPERACION_ACTIVA: SessionTemplate = {
  id: 'recuperacion-activa',
  name: 'Recuperación activa',
  description:
    'Treinta y cinco minutos suaves en Zonas 1-2 sin intervalos. Para días entre sesiones duras o regreso tras descanso. La intensidad permite mantener una conversación.',
  items: [
    single(block('recup-warmup', 'warmup', 1, 5 * 60, 'Activación muy suave')),
    single(block('recup-main', 'main', 2, 25 * 60, 'Z2 sostenida — conversación posible')),
    single(block('recup-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
};

// Orden curado para grid de 4 columnas (2 filas en desktop):
//   Fila 1 (sesiones largas, sostenidas, RPE bajo-moderado):
//     Recup. activa -> Z2 continuo -> Tempo MLSS -> Umbral progresivo
//   Fila 2 (sesiones intensas por intervalos, de mas anaerobico/explosivo
//     a mas aerobico sostenido):
//     SIT (sprint Z6) -> HIIT 10-20-30 -> VO2max cortos -> Noruego 4x4
//
// La fila 1 acumula las opciones mas accesibles para empezar y trabajar la
// base; la fila 2 son las sesiones de calidad/alta intensidad ordenadas
// como las prescribiria una entrenadora dentro de un microciclo.
export const SESSION_TEMPLATES: readonly SessionTemplate[] = [
  RECUPERACION_ACTIVA,
  ZONA2_CONTINUO,
  TEMPO_MLSS,
  UMBRAL_PROGRESIVO,
  SIT,
  HIIT_10_20_30,
  VO2MAX_CORTOS,
  NORUEGO_4X4,
] as const;

export function findTemplate(id: string): SessionTemplate | undefined {
  return SESSION_TEMPLATES.find((t) => t.id === id);
}
