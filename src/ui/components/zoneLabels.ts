import type { HeartRateZone } from '@core/physiology/karvonen';

/**
 * Etiquetas canonicas de las zonas Z1-Z6. Fuente unica de verdad de los
 * nombres mostrados al usuario en TODA la app: badges, tablas, dropdowns
 * del editor de bloques, charts, modo TV y centro de ayuda.
 *
 * El nombre canonico ("FULL") es el que aparece en el centro de ayuda
 * (ZoneReferenceTable). Las versiones "SHORT" son una sola palabra derivada
 * del FULL, pensadas para badges y barras donde el espacio es limitado.
 *
 * Mantener ambos sets sincronizados: si el FULL cambia, el SHORT debe
 * derivarse del mismo concepto.
 */
export const ZONE_LABEL_FULL: Record<HeartRateZone, string> = {
  1: 'Recuperación completa',
  2: 'Recuperación activa',
  3: 'Tempo / MLSS',
  4: 'Potencia umbral / VT2',
  5: 'VO2max / PAM',
  6: 'Supramáxima (sprint)',
};

export const ZONE_LABEL_SHORT: Record<HeartRateZone, string> = {
  1: 'Recuperación',
  2: 'Aeróbico',
  3: 'Tempo',
  4: 'Umbral',
  5: 'VO2max',
  6: 'Sprint',
};

/**
 * Combinacion `Z{n} — {FULL}` usada en dropdowns largos (BlockEditor) donde
 * se necesita ver tanto el codigo de zona como el nombre completo.
 */
export const ZONE_LABEL_WITH_CODE: Record<HeartRateZone, string> = {
  1: `Z1 — ${ZONE_LABEL_FULL[1]}`,
  2: `Z2 — ${ZONE_LABEL_FULL[2]}`,
  3: `Z3 — ${ZONE_LABEL_FULL[3]}`,
  4: `Z4 — ${ZONE_LABEL_FULL[4]}`,
  5: `Z5 — ${ZONE_LABEL_FULL[5]}`,
  6: `Z6 — ${ZONE_LABEL_FULL[6]}`,
};
