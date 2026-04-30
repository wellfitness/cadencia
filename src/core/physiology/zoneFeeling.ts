import type { HeartRateZone } from './karvonen';

/**
 * RPE (Rating of Perceived Exertion) en escala Borg CR10 + sensacion
 * cualitativa por zona. Es informacion universal de la zona — no depende del
 * deporte (cycling vs running) ni de los datos fisiologicos del usuario, asi
 * que vive en physiology como tabla pura derivada de la zona Z1-Z6.
 *
 * Se utiliza como anclaje pedagogico en:
 * - Modo TV: bajo la cadencia objetivo, en la cabecera del bloque activo.
 * - SessionBuilder: chip en BlockList y BlockEditor, junto a bpm/W/cadencia.
 * - Exportacion .zwo: textevent del bloque y descripcion global.
 *
 * Borg CR10 referencias:
 * - Borg & Kaijser 2006, Scand J Med Sci Sports: validacion de la escala
 *   CR10 (0-10) frente a respuesta de lactato y FC.
 * - ACSM Guidelines 11ª ed.: CR10 como herramienta clinica de prescripcion
 *   de intensidad cuando no hay pulsometro disponible.
 *
 * Las "sensaciones" son anclajes verbales clasicos del talk test: cuanto
 * mas alta la zona, menor capacidad de hablar fluido. Son agnosticas del
 * deporte: el talk test funciona igual en bici y en cinta.
 */
export interface ZoneFeeling {
  readonly rpeMin: number;
  readonly rpeMax: number;
  readonly sensation: string;
}

const ZONE_FEELING: Record<HeartRateZone, ZoneFeeling> = {
  1: { rpeMin: 2, rpeMax: 3, sensation: 'muy suave, charla fluida' },
  2: { rpeMin: 3, rpeMax: 4, sensation: 'cómodo, frases largas' },
  3: { rpeMin: 5, rpeMax: 6, sensation: 'moderado, frases cortas' },
  4: { rpeMin: 7, rpeMax: 7, sensation: 'duro, palabras sueltas' },
  5: { rpeMin: 8, rpeMax: 9, sensation: 'muy duro, monosílabos' },
  6: { rpeMin: 10, rpeMax: 10, sensation: 'máximo, no hablas' },
};

export function getZoneFeeling(zone: HeartRateZone): ZoneFeeling {
  return ZONE_FEELING[zone];
}

/**
 * Formatea el rango RPE como "RPE 7" si rpeMin === rpeMax, o "RPE 8-9" si
 * son distintos. Z4 y Z6 caen en el caso singular (un solo valor); Z1-Z3 y
 * Z5 caen en el caso rango.
 */
export function formatRpeRange(feeling: ZoneFeeling): string {
  if (feeling.rpeMin === feeling.rpeMax) return `RPE ${feeling.rpeMin}`;
  return `RPE ${feeling.rpeMin}-${feeling.rpeMax}`;
}
