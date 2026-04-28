import type { HeartRateZone } from '../physiology/karvonen';
import {
  defaultCadenceProfile,
  reconcileCadenceProfile,
  type CadenceProfile,
} from '../segmentation/sessionPlan';
import type { ZoneMusicCriteria } from './types';

/**
 * Cadencia objetivo por TIPO DE PEDALEO (cadenceProfile). Es el UNICO
 * criterio EXCLUYENTE: un track encaja con una zona/profile si su tempoBpm
 * cae en cadenceMin..cadenceMax (1:1) o en 2*cadenceMin..2*cadenceMax (2:1
 * half-time). Si no, no es candidato.
 *
 * El resto de dimensiones (energy, valence, genero) son INCLUYENTES: afectan
 * al score (probabilidad de elegir el track) pero no descartan.
 *
 * Rangos definidos por el curso de ciclo indoor del usuario:
 *   - flat:   70-90 rpm (1:1) o 140-180 BPM (2:1)
 *   - climb:  55-80 rpm (1:1) o 110-160 BPM (2:1)
 *   - sprint: 90-115 rpm (1:1) o 180-230 BPM (2:1)
 *
 * Los rangos de climb (extendido a 55) y sprint (extendido a 115) cubren la
 * "zona muerta" pop 110-120 BPM donde se concentra mucho rock y dance clasico
 * (Bowie, Zeppelin, Hendrix, Queen, MJ...). 55 rpm en climb es valido para
 * fuerza pura en muros (Z5), y 115 rpm en sprint sigue siendo cadencia muy
 * alta pero alcanzable en Z6 supramaximo de pocos segundos.
 *
 * Refs PubMed:
 *   - Dunst et al. 2024 (10.3389/fphys.2024.1343601): cadencia optima por
 *     umbral metabolico (LT1 66, MLSS 82, VO2max 84 rpm).
 *   - Hebisz & Hebisz 2024 (10.1371/journal.pone.0311833): HIIT a baja
 *     cadencia 50-70 rpm produce mayor mejora aerobica.
 */
const CADENCE_BY_PROFILE: Record<CadenceProfile, { min: number; max: number }> = {
  flat: { min: 70, max: 90 },
  climb: { min: 55, max: 80 },
  sprint: { min: 90, max: 115 },
};

/**
 * Perfil sonoro IDEAL por zona. Energy y valence son INCLUYENTES — el motor
 * acepta cualquier valor, pero los tracks cercanos al ideal puntuan mas alto
 * en scoreTrack. Esto permite que el catalogo entero sea candidato y se
 * rankee por proximidad, evitando descartar canciones validas por umbrales.
 *
 * Energy: intensidad sonora (0-1). Z1 recovery prefiere bajo, Z6 sprint alto.
 * Valence: positividad emocional (0-1). Z1 cualquiera, Z6 alegre/eufórica.
 */
const PROFILE_IDEAL_BY_ZONE: Record<
  HeartRateZone,
  { energyIdeal: number; valenceIdeal: number; description: string }
> = {
  1: { energyIdeal: 0.3, valenceIdeal: 0.4, description: 'Z1 — Recuperación completa' },
  2: { energyIdeal: 0.55, valenceIdeal: 0.5, description: 'Z2 — Recuperación activa' },
  3: { energyIdeal: 0.7, valenceIdeal: 0.55, description: 'Z3 — Tempo / MLSS' },
  4: { energyIdeal: 0.8, valenceIdeal: 0.6, description: 'Z4 — Umbral / VT2' },
  5: { energyIdeal: 0.9, valenceIdeal: 0.65, description: 'Z5 — Muros / escalada intensa' },
  6: { energyIdeal: 0.95, valenceIdeal: 0.7, description: 'Z6 — Sprint supramáximo' },
};

/**
 * Compone los criterios musicales para una combinacion (zona, profile).
 * Cadencia viene del profile (excluyente), energy/valence ideales vienen de
 * la zona (inclusivos, afectan al score solo).
 *
 * Si el profile recibido no es valido para la zona (ej. Z1 + climb), cae al
 * default de esa zona via reconcileCadenceProfile.
 */
export function getZoneCriteria(
  zone: HeartRateZone,
  profile: CadenceProfile,
): ZoneMusicCriteria {
  const reconciledProfile = reconcileCadenceProfile(zone, profile);
  const cadence = CADENCE_BY_PROFILE[reconciledProfile];
  const ideal = PROFILE_IDEAL_BY_ZONE[zone];
  return {
    zone,
    cadenceProfile: reconciledProfile,
    cadenceMin: cadence.min,
    cadenceMax: cadence.max,
    energyIdeal: ideal.energyIdeal,
    valenceIdeal: ideal.valenceIdeal,
    description: ideal.description,
  };
}

const ALL_ENERGETIC_FLOOR = 0.7;

/**
 * Toggle "todo con energia": sube el energy IDEAL de Z1-Z2 al piso 0.70 para
 * que el score prefiera tracks energéticos en zonas suaves. NO excluye
 * tracks bajos — el filtro sigue siendo solo cadencia. Funcion pura.
 */
export function applyAllEnergetic(
  criteria: ZoneMusicCriteria,
  allEnergetic: boolean,
): ZoneMusicCriteria {
  if (!allEnergetic) return criteria;
  return {
    ...criteria,
    energyIdeal: Math.max(criteria.energyIdeal, ALL_ENERGETIC_FLOOR),
  };
}

/**
 * Compatibilidad: sitios del codigo que aun referencian
 * `ZONE_MUSIC_CRITERIA[zone]`. Devolvemos los criterios del profile default
 * de cada zona.
 */
export const ZONE_MUSIC_CRITERIA: Record<HeartRateZone, ZoneMusicCriteria> = {
  1: getZoneCriteria(1, defaultCadenceProfile(1)),
  2: getZoneCriteria(2, defaultCadenceProfile(2)),
  3: getZoneCriteria(3, defaultCadenceProfile(3)),
  4: getZoneCriteria(4, defaultCadenceProfile(4)),
  5: getZoneCriteria(5, defaultCadenceProfile(5)),
  6: getZoneCriteria(6, defaultCadenceProfile(6)),
};
