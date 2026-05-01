import type { HeartRateZone } from '../physiology/karvonen';
import {
  cpFrom3MT,
  ftpFromRampMap,
  lthrFrom5MinMeanHr,
  maxHrFromPeak,
  vMasFromBuchheitStage,
  vo2maxFromMap5,
} from '../physiology/tests';
import {
  defaultCadenceProfile,
  type CadenceProfile,
  type Phase,
  type SessionBlock,
  type SessionItem,
  type SessionTemplate,
  type TestProtocol,
} from './sessionPlan';

/**
 * Lee un input numerico del Record que recibe `compute()`. Lanza si falta;
 * el modal valida los rangos antes de llamar pero esto cubre regresiones
 * (e.g., una plantilla con id de input desincronizado de su `inputs[]`).
 */
function getInput(inputs: Record<string, number>, key: string): number {
  const v = inputs[key];
  if (v === undefined) {
    throw new Error(`Missing required test input: ${key}`);
  }
  return v;
}

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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
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
  sport: 'bike',
  name: 'Recuperación activa',
  description:
    'Treinta y cinco minutos suaves en Zonas 1-2 sin intervalos. Para días entre sesiones duras o regreso tras descanso. La intensidad permite mantener una conversación.',
  items: [
    single(block('recup-warmup', 'warmup', 1, 5 * 60, 'Activación muy suave')),
    single(block('recup-main', 'main', 2, 25 * 60, 'Z2 sostenida — conversación posible')),
    single(block('recup-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
};

// =====================================================================
// PLANTILLAS DE RUNNING (sport: 'run')
// =====================================================================
// El campo `cadenceProfile` de cada bloque es informativo (default por zona
// via defaultCadenceProfile) y NO afecta al matching musical en running: el
// motor de run ignora profile y deriva la cadencia objetivo (spm) directamente
// de la zona. La cadencia de zancada en carrera se acopla a la zona/velocidad,
// no al terreno como en bici.
//
// Las distancias clasicas (800 m, 1000 m, 1500 m) se han traducido a duraciones
// estimadas para un runner intermedio: 800 m a ritmo Z5 ≈ 3:30; 1000 m Z5 ≈
// 4:00; 1500 m Z4 ≈ 6:30. Son aproximaciones — el usuario edita libremente
// los tiempos si su nivel es distinto.

/**
 * Easy Long Run (rodaje largo). 60 minutos continuos en Z2 (base aerobica),
 * test del habla "comoda conversacion". La sesion mas frecuente en cualquier
 * plan de fondo (5K -> marathon -> ultra). Daniels denomina E (easy).
 */
const RUN_EASY_LONG: SessionTemplate = {
  id: 'run-easy-long',
  sport: 'run',
  name: 'Easy Long Run',
  description:
    'Sesenta minutos continuos en Zona 2 tras un calentamiento corto. Base aeróbica, conversación posible. La sesión más frecuente en cualquier plan de fondo, ideal para días de volumen.',
  items: [
    single(block('run-easy-warmup', 'warmup', 1, 5 * 60, 'Trote suave de activación')),
    single(block('run-easy-main', 'main', 2, 60 * 60, 'Z2 sostenida — conversación posible')),
    single(block('run-easy-cooldown', 'cooldown', 1, 5 * 60, 'Trote muy suave + estiramientos')),
  ],
};

/**
 * Tempo Run. Veinte minutos continuos en Z3-Z4 (umbral lactico, MLSS). Test
 * del habla: "comodamente duro", solo frases cortas. Mejora la capacidad de
 * sostener intensidad alta sin acumular lactato.
 */
const RUN_TEMPO: SessionTemplate = {
  id: 'run-tempo',
  sport: 'run',
  name: 'Tempo Run',
  description:
    'Veinte minutos continuos a ritmo de umbral (Zona 3-4) entre calentamiento y vuelta a la calma. La sensación es "cómodamente duro" — solo respondes con frases cortas. Mejora el umbral láctico (MLSS).',
  items: [
    single(block('run-tempo-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    single(block('run-tempo-main', 'work', 4, 20 * 60, 'Tempo sostenido — comodamente duro')),
    single(block('run-tempo-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * Yasso 800s (Bart Yasso). 10 × 800 m en Z5 con 400 m de recovery suave Z2.
 * Predictor popular de tiempo objetivo en marathon: el tiempo medio de los
 * 800 m en min:seg ≈ tiempo objetivo del marathon en horas:min.
 *
 * Tiempos estimados para runner intermedio: 800 m Z5 ≈ 3:30, 400 m Z2 ≈ 3:00.
 */
const RUN_YASSO_800: SessionTemplate = {
  id: 'run-yasso-800',
  sport: 'run',
  name: 'Yasso 800s',
  description:
    'Diez intervalos de 800 m a ritmo Zona 5 con 400 m suaves de recuperación entre cada uno. Predictor clásico de tiempo de marathon (Bart Yasso): el tiempo medio de los 800 m en min:seg ≈ tiempo objetivo en h:min.',
  items: [
    single(block('run-yasso-warmup', 'warmup', 2, 12 * 60, 'Calentamiento progresivo')),
    group('run-yasso-set', 10, [
      block('run-yasso-work', 'work', 5, 3 * 60 + 30, '800 m fuerte (Z5)'),
      block('run-yasso-recovery', 'recovery', 2, 3 * 60, '400 m trote suave (Z2)'),
    ]),
    single(block('run-yasso-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * Daniels Intervals (vVO2max). 5 × 1000 m en Z5 con 2-3 min de recovery Z1.
 * Sesion clasica de Jack Daniels para mejorar VO2max — la velocidad a la que
 * se alcanza el consumo maximo de oxigeno.
 *
 * Tiempos estimados para runner intermedio: 1000 m Z5 ≈ 4:00.
 */
const RUN_DANIELS_INTERVALS: SessionTemplate = {
  id: 'run-daniels-intervals',
  sport: 'run',
  name: 'Daniels Intervals',
  description:
    'Cinco intervalos de 1000 m a ritmo de VO2max (Zona 5) con 2 minutos y medio de recuperación trotando muy suave entre cada uno. Sesión clásica de Jack Daniels — mejora el techo cardiovascular.',
  items: [
    single(block('run-daniels-warmup', 'warmup', 2, 12 * 60, 'Calentamiento')),
    group('run-daniels-set', 5, [
      block('run-daniels-work', 'work', 5, 4 * 60, '1000 m al ritmo de VO2max'),
      block('run-daniels-recovery', 'recovery', 1, 2 * 60 + 30, 'Trote muy suave (Z1)'),
    ]),
    single(block('run-daniels-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * HIIT 30-30 (Veronique Billat). 20 × (30 s Z6 + 30 s Z2). Sesion intermitente
 * a la velocidad maxima aerobica. Permite acumular mucho tiempo a alta
 * intensidad sin quemar tanto como un sprint puro.
 */
const RUN_HIIT_30_30: SessionTemplate = {
  id: 'run-hiit-30-30',
  sport: 'run',
  name: 'HIIT 30-30',
  description:
    'Veinte ciclos de 30 segundos rápidos (Zona 6) más 30 segundos suaves (Zona 2). Protocolo Billat para acumular tiempo a velocidad máxima aeróbica con menos desgaste neuromuscular que un sprint puro.',
  items: [
    single(block('run-hiit-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    group('run-hiit-set', 20, [
      block('run-hiit-fast', 'work', 6, 30, '30 s rápidos'),
      block('run-hiit-easy', 'recovery', 2, 30, '30 s suaves'),
    ]),
    single(block('run-hiit-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

/**
 * Threshold Cruise (Daniels). 3 × 1500 m en Z4 con 90 s de recovery Z1. Bloque
 * de umbral troceado para acumular volumen a intensidad alta sin colapsar.
 *
 * Tiempos estimados para runner intermedio: 1500 m Z4 ≈ 6:30.
 */
const RUN_THRESHOLD_CRUISE: SessionTemplate = {
  id: 'run-threshold-cruise',
  sport: 'run',
  name: 'Threshold Cruise',
  description:
    'Tres intervalos de 1500 m a ritmo de umbral (Zona 4) con 90 segundos suaves entre cada uno. Daniels lo llama "T-pace" — el ritmo más rápido que puedes sostener una hora. Mejora la capacidad de tolerar lactato.',
  items: [
    single(block('run-thr-warmup', 'warmup', 2, 12 * 60, 'Calentamiento progresivo')),
    group('run-thr-set', 3, [
      block('run-thr-work', 'work', 4, 6 * 60 + 30, '1500 m a umbral (T-pace)'),
      block('run-thr-recovery', 'recovery', 1, 90, '90 s trote muy suave'),
    ]),
    single(block('run-thr-cooldown', 'cooldown', 1, 10 * 60, 'Vuelta a la calma')),
  ],
};

// =====================================================================
// PLANTILLAS DE TESTS FISIOLOGICOS GUIADOS (kind: 'test')
// =====================================================================
// Cada plantilla-test combina (a) la estructura de bloques que se ejecuta
// en SessionTVMode, (b) un `testProtocol` con los inputs a pedir al usuario
// al final y la formula pura que los convierte en delta de UserInputsRaw.
// Las formulas viven en `src/core/physiology/tests.ts` y estan respaldadas
// por papers de PubMed (DOIs en cada `citationDois`).
//
// Las sesiones-test son intencionalmente cortas (10-25 min total) y casi
// todas tienen un esfuerzo maximo ≤ 5 min; la unica excepcion legitima es
// el 30-15 IFT cuyos esfuerzos individuales son de 30 s.

/* ---------- BIKE: Test de rampa (FTP) ---------- */
const BIKE_TEST_RAMP_PROTOCOL: TestProtocol = {
  id: 'bike-ramp',
  inputs: [
    {
      id: 'mapWatts',
      label: 'Potencia del último minuto completo (W)',
      unit: 'W',
      min: 50,
      max: 600,
      helperText:
        'El último escalón de 1 min que completaste antes de no poder mantener la cadencia.',
    },
  ],
  compute: (inputs) => {
    const map = getInput(inputs, 'mapWatts');
    const ftp = ftpFromRampMap(map);
    return {
      delta: { ftpWatts: ftp },
      derived: [{ label: 'FTP estimada', value: ftp, unit: 'W' }],
    };
  },
  citationDois: ['10.23736/S0022-4707.19.09126-6', '10.1123/ijspp.2018-0008'],
  hardwareDisclaimer:
    'Pon tu rodillo en modo NIVEL/SLOPE (no ERG) para poder subir 25 W cada minuto manualmente. Si no puedes cambiar el modo, usa el test de 5 min PAM en su lugar.',
  postTestNote:
    'En ciclistas recreativos esta estimación tiende a quedar un 5-7 % por debajo del LT real (Valenzuela 2018). Si ves que aguantas más, súbelo manualmente desde Mis Preferencias.',
};

const BIKE_TEST_RAMP: SessionTemplate = {
  id: 'bike-test-ramp',
  sport: 'bike',
  kind: 'test',
  name: 'Test de rampa (FTP)',
  description:
    'Estima tu FTP con una rampa lineal: subes 25 W cada minuto hasta que no puedas mantener la cadencia. Al terminar, anota la potencia del último minuto completo.',
  items: [
    single(block('ramp-warmup', 'warmup', 1, 5 * 60, 'Calentamiento muy suave (Z1)')),
    single(block('ramp-z2', 'work', 2, 90, 'Z2 — añade 25 W cada minuto')),
    single(block('ramp-z3', 'work', 3, 90, 'Z3 — sigue subiendo 25 W/min')),
    single(block('ramp-z4', 'work', 4, 90, 'Z4 — empieza a doler')),
    single(block('ramp-z5', 'work', 5, 90, 'Z5 — apreta los dientes')),
    single(block('ramp-z6', 'work', 6, 90, 'Z6 — hasta fallo')),
    single(block('ramp-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma muy suave')),
  ],
  testProtocol: BIKE_TEST_RAMP_PROTOCOL,
};

/* ---------- BIKE: Test 5-min PAM (VO2max + FCmax) ---------- */
const BIKE_TEST_MAP5_PROTOCOL: TestProtocol = {
  id: 'bike-map5',
  inputs: [
    {
      id: 'meanPowerWatts',
      label: 'Potencia media de los 5 minutos (W)',
      unit: 'W',
      min: 50,
      max: 600,
      helperText:
        'El valor medio que mostró tu medidor de potencia durante el bloque de 5 min.',
    },
    {
      id: 'peakHrBpm',
      label: 'FC máxima registrada (bpm)',
      unit: 'bpm',
      min: 100,
      max: 230,
      helperText: 'El valor más alto que viste en tu pulsómetro al final del esfuerzo.',
    },
  ],
  compute: (inputs, user) => {
    const meanPower = getInput(inputs, 'meanPowerWatts');
    const peakHr = getInput(inputs, 'peakHrBpm');
    const weight = user.weightKg ?? 70;
    const vo2 = vo2maxFromMap5(meanPower, weight);
    const hrMax = maxHrFromPeak(peakHr);
    return {
      delta: { maxHeartRate: hrMax },
      derived: [
        { label: 'VO2max estimado', value: vo2, unit: 'mL/kg/min', precision: 1 },
        { label: 'FCmáx', value: hrMax, unit: 'bpm' },
      ],
    };
  },
  citationDois: ['10.1123/ijspp.2020-0923'],
  postTestNote:
    'Has actualizado tu FCmáx. Las zonas de FC se recalcularán automáticamente. El VO2max es informativo (no se persiste).',
};

const BIKE_TEST_MAP5: SessionTemplate = {
  id: 'bike-test-map5',
  sport: 'bike',
  kind: 'test',
  name: 'Test 5 min (PAM)',
  description:
    '5 minutos all-out tras un calentamiento progresivo. Estima tu VO2max desde la potencia media y captura tu FCmáx real. Esfuerzo intenso pero corto.',
  items: [
    single(block('map5-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    single(block('map5-allout', 'work', 6, 5 * 60, '5 minutos all-out — todo lo que tengas')),
    single(block('map5-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
  testProtocol: BIKE_TEST_MAP5_PROTOCOL,
};

/* ---------- BIKE: Test 3MT (CP + W') ---------- */
const BIKE_TEST_3MT_PROTOCOL: TestProtocol = {
  id: 'bike-3mt',
  inputs: [
    {
      id: 'meanPowerLast30sWatts',
      label: 'Potencia media de los últimos 30 s (W)',
      unit: 'W',
      min: 50,
      max: 600,
      helperText:
        'Casi todos los head-units (Garmin, Wahoo) y plataformas (Zwift) muestran la potencia media de un intervalo. Selecciona los últimos 30 s del esfuerzo.',
    },
    {
      id: 'totalWorkKj',
      label: 'Trabajo total realizado (kJ)',
      unit: 'kJ',
      min: 10,
      max: 200,
      helperText:
        'El trabajo total de los 3 minutos completos. Lo muestra Zwift al pausar el bloque.',
    },
  ],
  compute: (inputs) => {
    const meanLast30 = getInput(inputs, 'meanPowerLast30sWatts');
    const totalKj = getInput(inputs, 'totalWorkKj');
    const result = cpFrom3MT(meanLast30, totalKj * 1000);
    return {
      delta: { ftpWatts: Math.round(result.cp) },
      derived: [
        { label: 'Critical Power (CP)', value: result.cp, unit: 'W' },
        {
          label: "W' (capacidad anaeróbica)",
          value: result.wPrime / 1000,
          unit: 'kJ',
          precision: 1,
        },
      ],
    };
  },
  citationDois: ['10.1249/mss.0b013e31802dd3e6', '10.1080/17461391.2013.810306'],
  hardwareDisclaimer:
    'IMPORTANTE: pon tu rodillo en modo NIVEL/SLOPE, NO en modo ERG. En ERG el rodillo se autoajusta a una potencia objetivo y el test es inválido sin aviso. Si tu rodillo no permite cambiar el modo, usa el test de 5 min PAM en su lugar.',
  postTestNote:
    'CP y FTP son métricas hermanas pero no idénticas: CP es la asíntota teórica, FTP es lo sostenible 1 hora. Cadencia guarda CP como tu FTP de referencia (suelen coincidir en ±5 W).',
};

const BIKE_TEST_3MT: SessionTemplate = {
  id: 'bike-test-3mt',
  sport: 'bike',
  kind: 'test',
  name: 'Test 3MT (CP + W′)',
  description:
    '3 minutos all-out contra resistencia fija (Vanhatalo 2007). Calcula tu Critical Power y tu W′. Solo válido en modo NIVEL/SLOPE — no funciona en modo ERG.',
  items: [
    single(block('3mt-warmup', 'warmup', 1, 5 * 60, 'Calentamiento Z1-Z2')),
    single(block('3mt-priming', 'work', 4, 60, 'Aceleración corta para activar (1 min Z4)')),
    single(block('3mt-rest', 'recovery', 2, 5 * 60, 'Recuperación 5 min Z2')),
    single(block('3mt-allout', 'work', 6, 3 * 60, '3 min ALL-OUT desde el primer segundo')),
    single(block('3mt-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma muy suave')),
  ],
  testProtocol: BIKE_TEST_3MT_PROTOCOL,
};

/* ---------- RUN: Test FCmáx (Daniels 4'+1'+3') ---------- */
const RUN_TEST_HRMAX_PROTOCOL: TestProtocol = {
  id: 'run-hrmax-daniels',
  inputs: [
    {
      id: 'peakHrBpm',
      label: 'FC máxima registrada en el test (bpm)',
      unit: 'bpm',
      min: 100,
      max: 230,
      helperText:
        'El valor más alto que mostró tu pulsómetro durante el último minuto del esfuerzo final.',
    },
  ],
  compute: (inputs) => {
    const hrMax = maxHrFromPeak(getInput(inputs, 'peakHrBpm'));
    return {
      delta: { maxHeartRate: hrMax },
      derived: [{ label: 'FCmáx', value: hrMax, unit: 'bpm' }],
    };
  },
  citationDois: ['10.1097/00005768-200111000-00008'],
  postTestNote:
    'Tu FCmáx medida es más fiable que cualquier fórmula por edad (Gulati/Tanaka tienen ±10 bpm de error). Las zonas Karvonen se recalculan automáticamente.',
};

const RUN_TEST_HRMAX_DANIELS: SessionTemplate = {
  id: 'run-test-hrmax-daniels',
  sport: 'run',
  kind: 'test',
  name: 'Test FCmáx (Daniels)',
  description:
    'Protocolo Daniels: 4 min duro + 1 min trote + 3 min all-out. Diseñado para tocar techo cardiovascular en menos de 10 minutos de esfuerzo total.',
  items: [
    single(block('hrmax-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    single(block('hrmax-hard4', 'work', 5, 4 * 60, '4 min al ~95 % de tu esfuerzo máximo')),
    single(block('hrmax-recovery', 'recovery', 2, 60, '1 min trote suave para recuperar')),
    single(block('hrmax-allout3', 'work', 6, 3 * 60, '3 min ALL-OUT — vacíate del todo')),
    single(block('hrmax-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma + estiramientos')),
  ],
  testProtocol: RUN_TEST_HRMAX_PROTOCOL,
};

/* ---------- RUN: Test 5-min all-out ---------- */
const RUN_TEST_5MIN_PROTOCOL: TestProtocol = {
  id: 'run-5min',
  inputs: [
    {
      id: 'meanHrBpm',
      label: 'FC media durante los 5 minutos (bpm)',
      unit: 'bpm',
      min: 100,
      max: 230,
      helperText:
        'Media del bloque all-out, no de toda la sesión. La mayoría de pulsómetros la calculan al pausar.',
    },
    {
      id: 'peakHrBpm',
      label: 'FC máxima registrada (bpm)',
      unit: 'bpm',
      min: 100,
      max: 230,
      helperText: 'El pico que mostró tu pulsómetro al final del esfuerzo.',
    },
  ],
  compute: (inputs) => {
    const meanHr = getInput(inputs, 'meanHrBpm');
    const peakHr = getInput(inputs, 'peakHrBpm');
    const lthr = lthrFrom5MinMeanHr(meanHr);
    const hrMax = maxHrFromPeak(peakHr);
    return {
      delta: { maxHeartRate: hrMax },
      derived: [
        { label: 'FCmáx', value: hrMax, unit: 'bpm' },
        { label: 'FC umbral (LTHR) estimada', value: lthr, unit: 'bpm' },
      ],
    };
  },
  citationDois: ['10.1097/00005768-200111000-00008'],
  postTestNote:
    'La FC umbral estimada es informativa: en un esfuerzo all-out de 5 min la FC media tiende al 92-95 % de FCmáx, próxima al umbral láctico clásico de Joe Friel.',
};

const RUN_TEST_5MIN: SessionTemplate = {
  id: 'run-test-5min',
  sport: 'run',
  kind: 'test',
  name: 'Test 5 min (FCmáx + LTHR)',
  description:
    '5 minutos all-out en pista o tapiz. Toca techo cardiovascular y la FC media estima tu FC umbral (LTHR). Dos datos de un solo esfuerzo.',
  items: [
    single(block('run-5min-warmup', 'warmup', 2, 10 * 60, 'Calentamiento progresivo')),
    single(block('run-5min-allout', 'work', 6, 5 * 60, '5 minutos all-out — vacíate')),
    single(block('run-5min-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
  testProtocol: RUN_TEST_5MIN_PROTOCOL,
};

/* ---------- RUN: Test 30-15 IFT (Buchheit) ---------- */
const RUN_TEST_30_15_PROTOCOL: TestProtocol = {
  id: 'run-30-15-ift',
  inputs: [
    {
      id: 'lastStage',
      label: 'Último estadio completado',
      unit: 'stage',
      min: 1,
      max: 50,
      helperText:
        'Stage 1 = 8 km/h. Cada stage suma 0,5 km/h. La app de audio oficial te canta el número del stage al cambiar de velocidad.',
    },
    {
      id: 'peakHrBpm',
      label: 'FC máxima registrada (bpm)',
      unit: 'bpm',
      min: 100,
      max: 230,
      helperText: 'El pico que mostró tu pulsómetro durante el último estadio.',
    },
  ],
  compute: (inputs) => {
    const stage = getInput(inputs, 'lastStage');
    const peakHr = getInput(inputs, 'peakHrBpm');
    const vMas = vMasFromBuchheitStage(stage);
    const hrMax = maxHrFromPeak(peakHr);
    return {
      delta: { maxHeartRate: hrMax },
      derived: [
        { label: 'vMAS (velocidad aeróbica máx.)', value: vMas, unit: 'km/h', precision: 1 },
        { label: 'FCmáx', value: hrMax, unit: 'bpm' },
      ],
    };
  },
  citationDois: ['10.1519/JSC.0b013e3181d686b7'],
  hardwareDisclaimer:
    'Necesitas conos a 40 m de distancia y la app de audio oficial del 30-15 IFT en tu móvil (búscala como "30-15 IFT audio" en App Store / Google Play). Recomendable hacerlo en pista de atletismo.',
  postTestNote:
    'vMAS es informativa: útil para diseñar HIIT a velocidad correcta. Cadencia V1 no la usa en el matching musical, pero queda registrada para tu referencia.',
};

const RUN_TEST_30_15_IFT: SessionTemplate = {
  id: 'run-test-30-15-ift',
  sport: 'run',
  kind: 'test',
  name: 'Test 30-15 IFT (Buchheit)',
  description:
    '30 segundos corriendo + 15 segundos descanso, con velocidad creciente cada estadio. Test intermitente que captura FCmáx + vMAS sin sostener nunca más de 30 s.',
  items: [
    single(block('30-15-warmup', 'warmup', 2, 10 * 60, 'Calentamiento + ejercicios técnicos')),
    group('30-15-stages', 25, [
      block('30-15-fast', 'work', 6, 30, 'Stage actual — corre los 40 m en 30 s'),
      block('30-15-rest', 'recovery', 2, 15, '15 s descanso — camina o trota muy suave'),
    ]),
    single(block('30-15-cooldown', 'cooldown', 1, 5 * 60, 'Vuelta a la calma')),
  ],
  testProtocol: RUN_TEST_30_15_PROTOCOL,
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
//
// Las plantillas de running siguen un orden similar: largas/aerobicas primero,
// intervalicas despues. La UI las filtra por sport antes de renderizar.
export const SESSION_TEMPLATES: readonly SessionTemplate[] = [
  // Cycling — entrenos (sport: 'bike', kind: 'workout')
  RECUPERACION_ACTIVA,
  ZONA2_CONTINUO,
  TEMPO_MLSS,
  UMBRAL_PROGRESIVO,
  SIT,
  HIIT_10_20_30,
  VO2MAX_CORTOS,
  NORUEGO_4X4,
  // Cycling — tests (sport: 'bike', kind: 'test')
  BIKE_TEST_RAMP,
  BIKE_TEST_MAP5,
  BIKE_TEST_3MT,
  // Running — entrenos (sport: 'run', kind: 'workout')
  RUN_EASY_LONG,
  RUN_TEMPO,
  RUN_THRESHOLD_CRUISE,
  RUN_DANIELS_INTERVALS,
  RUN_YASSO_800,
  RUN_HIIT_30_30,
  // Running — tests (sport: 'run', kind: 'test')
  RUN_TEST_HRMAX_DANIELS,
  RUN_TEST_5MIN,
  RUN_TEST_30_15_IFT,
] as const;

export function findTemplate(id: string): SessionTemplate | undefined {
  return SESSION_TEMPLATES.find((t) => t.id === id);
}

/** Devuelve solo las plantillas asociadas al sport indicado. */
export function templatesForSport(
  sport: SessionTemplate['sport'],
): readonly SessionTemplate[] {
  return SESSION_TEMPLATES.filter((t) => t.sport === sport);
}

/**
 * Filtra plantillas por deporte y por `kind`. Default `kind: 'workout'` para
 * que las llamadas legacy (TemplateGallery con la pesta~na "Entrenos") sigan
 * devolviendo solo entrenamientos. Para mostrar la galeria de tests pasar
 * `kind: 'test'` explicitamente.
 */
export function templatesBy(
  sport: SessionTemplate['sport'],
  kind: 'workout' | 'test' = 'workout',
): readonly SessionTemplate[] {
  return SESSION_TEMPLATES.filter((t) => {
    const tKind = t.kind ?? 'workout';
    return t.sport === sport && tKind === kind;
  });
}
