import type { HeartRateZone } from '../physiology/karvonen';
import {
  defaultCadenceProfile,
  reconcileCadenceProfile,
  type CadenceProfile,
} from '../segmentation/sessionPlan';
import type { Sport } from '../user/userInputs';
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
 * Cadencia objetivo (spm — pasos por minuto) por zona en RUNNING.
 *
 * A diferencia del ciclismo (donde la cadencia depende del terreno y por eso
 * existe `cadenceProfile`), en carrera la cadencia esta acoplada a la zona:
 * un runner mantiene ~165 spm en recovery y ~180 spm en intervalos sin opcion
 * de "cambiar marcha". El filtro de cadencia ignora el `cadenceProfile` de los
 * bloques cuando sport === 'run'.
 *
 * Rangos sustentados por evidencia (PubMed):
 *   - Agresta et al. 2019 (10.1016/j.gaitpost.2019.02.034): rango operativo
 *     150-190 spm validado en 40 runners con perturbaciones a 150/160/170/180/190.
 *   - Musgjerd et al. 2021 (10.26603/001c.25166): subir cadencia 7-10% reduce
 *     impacto tibial 5-25%.
 *   - Van den Berghe et al. 2022 (10.1111/sms.14123): musica tempo-sincrona
 *     reduce impacto tibial 25.5% en RCT.
 *
 * Match alternativo en running: tempoBpm = cadencia/2 (2 pasos por beat). Z1
 * con cadencia 150-162 spm tambien matchea tracks en 75-81 BPM (baladas/R&B
 * lentos). Z4-Z6 carecen de half-time util porque el rango 85-100 BPM cae
 * fuera del catalogo de musica motivadora.
 */
const CADENCE_BY_RUN_ZONE: Record<HeartRateZone, { min: number; max: number }> = {
  1: { min: 150, max: 162 },
  2: { min: 155, max: 170 },
  3: { min: 165, max: 178 },
  4: { min: 170, max: 185 },
  5: { min: 175, max: 190 },
  6: { min: 180, max: 200 },
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
 * Compone los criterios musicales para una combinacion (zona, profile, sport).
 *
 * En sport 'bike': cadencia viene del profile (excluyente), energy/valence
 * ideales vienen de la zona (inclusivos, afectan al score solo). Si el profile
 * recibido no es valido para la zona (ej. Z1 + climb), cae al default via
 * reconcileCadenceProfile.
 *
 * En sport 'run': profile se ignora (la cadencia de carrera se acopla a la
 * zona, no al terreno). cadenceMin/max vienen de CADENCE_BY_RUN_ZONE. El
 * cadenceProfile devuelto es 'flat' (placeholder informativo, no usado por
 * el matcher).
 *
 * `sport` es OBLIGATORIO sin default. Antes existia un default 'bike' por
 * retrocompat que enmascaraba un bug critico: las sesiones de running se
 * matcheaban con rangos de bike. Para que TypeScript fuerce a propagar el
 * sport en cada call site, el parametro ahora es requerido.
 */
export function getZoneCriteria(
  zone: HeartRateZone,
  profile: CadenceProfile,
  sport: Sport,
): ZoneMusicCriteria {
  const ideal = PROFILE_IDEAL_BY_ZONE[zone];
  if (sport === 'run') {
    const cadence = CADENCE_BY_RUN_ZONE[zone];
    return {
      zone,
      sport: 'run',
      cadenceProfile: 'flat',
      cadenceMin: cadence.min,
      cadenceMax: cadence.max,
      energyIdeal: ideal.energyIdeal,
      valenceIdeal: ideal.valenceIdeal,
      description: ideal.description,
    };
  }
  const reconciledProfile = reconcileCadenceProfile(zone, profile);
  const cadence = CADENCE_BY_PROFILE[reconciledProfile];
  return {
    zone,
    sport: 'bike',
    cadenceProfile: reconciledProfile,
    cadenceMin: cadence.min,
    cadenceMax: cadence.max,
    energyIdeal: ideal.energyIdeal,
    valenceIdeal: ideal.valenceIdeal,
    description: ideal.description,
  };
}

/**
 * Devuelve el rango de BPM alternativo (no 1:1) para una criteria dada,
 * dependiendo del deporte:
 *   - bike: half-time 2:1 → tempoBpm en [2·cadenceMin, 2·cadenceMax]. Track de
 *     145 BPM se pedalea a 72.5 rpm con golpe fuerte cada 2 pedaladas.
 *   - run: half-cadence → tempoBpm en [cadenceMin/2, cadenceMax/2]. Track de
 *     80 BPM se corre a 160 spm con 2 pasos por beat. Util en Z1-Z2 (baladas
 *     lentas para rodajes largos); irrelevante en Z4-Z6 (rango fuera del
 *     catalogo motivacional).
 *
 * Helper unico para que `passesCadenceFilter` y `scoreTrack` no dupliquen la
 * direccion del multiplicador.
 */
export function getAlternativeBpmRange(
  criteria: ZoneMusicCriteria,
): { min: number; max: number } {
  if (criteria.sport === 'run') {
    return { min: criteria.cadenceMin / 2, max: criteria.cadenceMax / 2 };
  }
  return { min: 2 * criteria.cadenceMin, max: 2 * criteria.cadenceMax };
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
 * `ZONE_MUSIC_CRITERIA[zone]`. Devolvemos los criterios bike del profile
 * default de cada zona — equivalente al comportamiento previo cuando sport
 * tenia default 'bike'. Codigo nuevo debe llamar a `getZoneCriteria` con el
 * sport explicito.
 */
export const ZONE_MUSIC_CRITERIA: Record<HeartRateZone, ZoneMusicCriteria> = {
  1: getZoneCriteria(1, defaultCadenceProfile(1), 'bike'),
  2: getZoneCriteria(2, defaultCadenceProfile(2), 'bike'),
  3: getZoneCriteria(3, defaultCadenceProfile(3), 'bike'),
  4: getZoneCriteria(4, defaultCadenceProfile(4), 'bike'),
  5: getZoneCriteria(5, defaultCadenceProfile(5), 'bike'),
  6: getZoneCriteria(6, defaultCadenceProfile(6), 'bike'),
};
