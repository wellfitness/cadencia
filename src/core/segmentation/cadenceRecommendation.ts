import type { HeartRateZone } from '../physiology/karvonen';
import { reconcileCadenceProfile, type CadenceProfile } from './sessionPlan';

/**
 * Cadencia (rpm) recomendada al ciclista para cada combinacion de zona y
 * cadenceProfile. Es una guia PEDAGOGICA: aparece en el SessionBuilder y
 * en el modo TV para indicar a que cadencia conviene pedalear durante el
 * bloque. NO afecta al matching musical.
 *
 * Distincion respecto a CADENCE_BY_PROFILE en matching/zoneCriteria:
 *
 * - CADENCE_BY_PROFILE (filtro musical): flat 70-90, climb 55-80, sprint
 *   90-115. Define que tracks son candidatos via 1:1 union 2:1 half-time.
 *   Es deliberadamente AMPLIO para captar suficiente catalogo musical.
 *
 * - RECOMMENDED_CADENCE (este modulo): rangos mas estrechos por (zona,
 *   profile), basados en evidencia fisiologica. Es lo que se le dice al
 *   ciclista: "pedalea a 85-95 rpm en este Z3 llano". El rango puede caer
 *   total o parcialmente fuera del filtro musical (ej. Z2 flat 80-95 vs
 *   filtro 70-90 rpm); es intencionado, son dos planos independientes.
 *
 * Refs PubMed y literatura:
 * - Dunst et al. 2024 (10.3389/fphys.2024.1343601): cadencia de minima
 *   eficiencia metabolica por umbral - LT1 66 rpm, MLSS 82 rpm, VO2max 84
 *   rpm, sprint sin fatiga 135 rpm.
 * - Hebisz & Hebisz 2024 (10.1371/journal.pone.0311833): HIIT a 50-70 rpm
 *   produce mayor mejora aerobica que a cadencia libre - apoya entrenar
 *   Z4-Z5 climb a baja cadencia.
 * - Allen & Coggan, Training and Racing with a Power Meter: rangos
 *   practicos por zona en bici - Endurance 80-90, Tempo 80-95, Threshold
 *   75-95, VO2max 90-105, Anaerobic Capacity 100-110, Neuromuscular >110.
 */
export interface CadenceRange {
  readonly min: number;
  readonly max: number;
}

const RECOMMENDED_CADENCE: Record<
  HeartRateZone,
  Partial<Record<CadenceProfile, CadenceRange>>
> = {
  // Z1 recuperacion completa. Cadencia alta y suave, sin carga, "limpia
  // piernas". Coggan endurance bajo-suave; Dunst no aplica directo (por
  // debajo de LT1).
  1: { flat: { min: 80, max: 95 } },

  // Z2 resistencia / LT1. Dunst LT1 = 66 rpm es minima eficiencia, pero en
  // entrenamiento aerobico base se sube a 80-95 para minimizar carga
  // muscular y favorecer el sistema cardiovascular (Coggan endurance).
  2: { flat: { min: 80, max: 95 } },

  // Z3 tempo / MLSS. Dunst MLSS = 82 rpm optimo metabolico. Llano: 85-95
  // ligeramente por encima para fluidez. Climb: 65-75 para sumar
  // componente de fuerza muscular sin entrar en fatiga local.
  3: {
    flat: { min: 85, max: 95 },
    climb: { min: 65, max: 75 },
  },

  // Z4 umbral / FTP (sweet spot). Llano: 80-90 centro Coggan threshold.
  // Climb: 65-75 (FTP en muros) - apoyado por Hebisz 2024.
  4: {
    flat: { min: 80, max: 90 },
    climb: { min: 65, max: 75 },
  },

  // Z5 muros / VO2max en escalada, fuerza pura. Hebisz 2024 valida 50-70
  // rpm para mejora VO2max; 55-70 es entrenable sin perder fluidez.
  5: { climb: { min: 55, max: 70 } },

  // Z6 sprint supramaximo. Dunst 135 rpm es la cadencia "sin fatiga
  // maxima", pero al tratarse de Z6 supramaximo de pocos segundos
  // limitamos a 100-120 alcanzable y reproducible.
  6: { sprint: { min: 100, max: 120 } },
};

/**
 * Devuelve el rango de cadencia (rpm) recomendado al ciclista para la
 * combinacion (zona, profile). Si el profile recibido no es valido para
 * la zona, se reconcilia al default antes de buscar el rango (mismo
 * comportamiento que getZoneCriteria en matching/zoneCriteria.ts).
 */
export function getRecommendedCadence(
  zone: HeartRateZone,
  profile: CadenceProfile,
): CadenceRange {
  const reconciled = reconcileCadenceProfile(zone, profile);
  const range = RECOMMENDED_CADENCE[zone][reconciled];
  if (range === undefined) {
    // Defensa ante un bug futuro de tabla: si alguien anyade un profile
    // valido a una zona en sessionPlan sin actualizar esta tabla,
    // queremos un fallo ruidoso en tests, no un undefined silencioso.
    throw new Error(
      `Falta rango de cadencia recomendado para zona ${zone} + profile ${reconciled}`,
    );
  }
  return range;
}
