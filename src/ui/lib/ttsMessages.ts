import type { Sport } from '@core/user/userInputs';
import type { HeartRateZone, ZoneFeeling } from '@core/physiology';
import type { CadenceProfile, SessionBlock } from '@core/segmentation';
import { getZoneFeeling } from '@core/physiology';
import { getRecommendedCadence } from '@core/segmentation';
import { getZoneCriteria } from '@core/matching';

/**
 * Builder PURO de los mensajes que el modo TV anuncia por voz al iniciar
 * cada bloque. Vive en `ui/lib` porque su formato es de presentacion, pero
 * no toca DOM ni speechSynthesis: es testeable sin mocks.
 *
 * Politica de diseño:
 *  - Una unica frase por bloque, leida AL EMPEZAR la fase (sin anticipo
 *    ni cuenta atras vocal — los beeps existentes ya cuentan).
 *  - Plantillas especiales para fases no-trabajo (warmup, cooldown, rest,
 *    recovery) que sustituyen al genérico para evitar formulas mecanicas.
 *  - Sensacion simplificada para TTS (sin la coma interna que tiene
 *    `getZoneFeeling().sensation`, que el motor TTS interpretaria como
 *    pausa larga rara: «duro... palabras sueltas»).
 *  - Duracion humanizada en castellano natural: «4 minutos» / «90 segundos» /
 *    «3 minutos y 30 segundos», nunca «210 segundos».
 *  - RPE reformateado: «8 a 9» en vez de «8-9» para evitar que el motor
 *    pronuncie «ocho guion nueve».
 */

/**
 * Sensacion simplificada por zona, optimizada para que el motor TTS lea
 * fluido sin pausas raras. El campo `getZoneFeeling().sensation` lleva una
 * coma interna ("muy suave, charla fluida") que el sintetizador interpreta
 * como pausa larga: queda raro pegado al resto de la frase. Aqui usamos
 * solo el adjetivo principal.
 */
const ZONE_TTS_SENSATION: Record<HeartRateZone, string> = {
  1: 'muy suave',
  2: 'cómodo',
  3: 'moderado',
  4: 'umbral',
  5: 'muy duro',
  6: 'máximo',
};

/**
 * Humaniza una duracion en segundos a una expresion castellana natural
 * pensada para sintesis de voz.
 *
 *   30  -> "30 segundos"
 *   60  -> "1 minuto"
 *   90  -> "1 minuto y 30 segundos"
 *   120 -> "2 minutos"
 *   210 -> "3 minutos y 30 segundos"
 *   240 -> "4 minutos"
 */
export function humanizeDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} segundos`;
  const minutes = Math.floor(total / 60);
  const remainder = total - minutes * 60;
  const minLabel = `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  if (remainder === 0) return minLabel;
  return `${minLabel} y ${remainder} segundos`;
}

/**
 * Reformatea el rango RPE para TTS: "8-9" -> "8 a 9", "7" -> "7". Los
 * motores TTS suelen leer el guion como "guion" literal en numeros.
 */
export function formatRpeForTTS(feeling: ZoneFeeling): string {
  if (feeling.rpeMin === feeling.rpeMax) return `RPE ${feeling.rpeMin}`;
  return `RPE ${feeling.rpeMin} a ${feeling.rpeMax}`;
}

/**
 * Devuelve el rango de cadencia sugerido para el bloque, replicando la
 * misma logica que SessionTVMode usa en pantalla:
 *  - Bike: getRecommendedCadence(zona, profile) — Coggan/Dunst
 *  - Run: getZoneCriteria(zona, 'flat', 'run') — alineado con el filtro
 *    musical de running, para que la voz coincida con lo que ve el usuario.
 */
function cadenceMidForBlock(
  zone: HeartRateZone,
  profile: CadenceProfile,
  sport: Sport,
): { min: number; max: number; unit: 'rpm' | 'spm' } {
  if (sport === 'run') {
    const c = getZoneCriteria(zone, 'flat', 'run');
    return { min: c.cadenceMin, max: c.cadenceMax, unit: 'spm' };
  }
  const r = getRecommendedCadence(zone, profile);
  return { min: r.min, max: r.max, unit: 'rpm' };
}

/**
 * Punto medio del rango — la cadencia que se anuncia. Mejor que leer
 * "80 a 90 rpm" cada bloque (verboso): la voz da la objetivo central y
 * el usuario tiene los rangos en pantalla.
 */
function cadenceTargetForTTS(
  zone: HeartRateZone,
  profile: CadenceProfile,
  sport: Sport,
): string {
  const { min, max, unit } = cadenceMidForBlock(zone, profile, sport);
  const mid = Math.round((min + max) / 2);
  return `${mid} ${unit}`;
}

/**
 * Construye el anuncio completo del bloque. Ramifica por `phase`:
 *  - warmup / cooldown / rest / recovery: plantilla especifica con el
 *    nombre de la fase como gancho narrativo.
 *  - main / work / default: plantilla estandar (zona + sensacion +
 *    cadencia + duracion + RPE).
 *
 * En todos los casos termina con la duracion humanizada y el RPE.
 */
export function buildPhaseAnnouncement(block: SessionBlock, sport: Sport): string {
  const feeling = getZoneFeeling(block.zone);
  const sensation = ZONE_TTS_SENSATION[block.zone];
  const duration = humanizeDuration(block.durationSec);
  const rpe = formatRpeForTTS(feeling);
  const cadence = cadenceTargetForTTS(block.zone, block.cadenceProfile, sport);

  switch (block.phase) {
    case 'rest':
      return `Descanso. ${duration}.`;
    case 'recovery':
      return `Recuperación. Zona ${block.zone}, ${cadence}, ${duration}.`;
    case 'warmup':
      return `Calentamiento. Zona ${block.zone}, ${sensation}, ${cadence}, ${duration}.`;
    case 'cooldown':
      return `Vuelta a la calma. Zona ${block.zone}, ${sensation}, ${cadence}, ${duration}.`;
    default:
      // 'work', 'main' y cualquier phase futura: plantilla estandar.
      return `Zona ${block.zone}, ${sensation}, ${cadence}, ${duration}. ${rpe}.`;
  }
}

/**
 * Mensaje al completar la sesion. Corto: la fanfarria sonora ya hace de
 * climax, la voz solo confirma.
 */
export const COMPLETION_ANNOUNCEMENT = 'Sesión completada.';
