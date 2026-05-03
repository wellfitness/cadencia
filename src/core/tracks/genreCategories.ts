/**
 * Macro-categorias de genero para el panel de preferencias.
 *
 * Spotify devuelve tags muy fragmentados ("slap house", "tropical house",
 * "funky house"...) que el usuario percibe como una sola cosa: house. Este
 * modulo agrupa los ~466 tags del catalogo nativo en 10 categorias macro
 * con etiquetas legibles en castellano (no acronimos), siguiendo la
 * preferencia editorial de Cadencia (audiencia generalista, mujeres 40+).
 *
 * El usuario marca macros en el panel; el matching expande internamente a
 * los tags concretos de cada macro y un track encaja si tiene AL MENOS UNO
 * de esos tags. Los tags no clasificados (raros) se ignoran en el panel
 * pero el matching los sigue usando: un track con tag desconocido seguira
 * recibiendo genreScore via cadencia/energy/valence.
 *
 * Reglas vinculantes:
 *  - Los `id` son estables (no cambian entre versiones) — se persisten en
 *    Drive y deben sobrevivir migraciones.
 *  - Los `label` son legibles, en castellano, sin acronimos.
 *  - Los `tags` deben ser exactamente los strings que devuelve la columna
 *    'Genres' del CSV de Spotify, en minusculas (igual que parser.ts).
 */

export type MacroGenreId =
  | 'house'
  | 'electronic'
  | 'trance'
  | 'eurodance'
  | 'disco'
  | 'pop'
  | 'rock'
  | 'metal'
  | 'spanish'
  | 'soul_funk';

export interface MacroGenre {
  id: MacroGenreId;
  /** Etiqueta legible en castellano para mostrar al usuario. */
  label: string;
  /** Descripcion breve que aparece en tooltip o sub-titulo. */
  description: string;
  /** Tags exactos del CSV de Spotify que pertenecen a este macro. */
  tags: readonly string[];
}

/**
 * Definicion de los 10 macros. El orden aqui es el orden de presentacion
 * por defecto cuando dos macros empatan en numero de tracks (estable).
 * En la practica el panel ordena por count desc.
 */
export const MACRO_GENRES: readonly MacroGenre[] = [
  {
    id: 'house',
    label: 'House',
    description: 'Música electrónica con base de bombo en cada tiempo',
    tags: [
      'house',
      'disco house',
      'slap house',
      'tropical house',
      'funky house',
      'tech house',
      'future house',
      'acid house',
      'deep house',
      'electro house',
      'house de chicago',
      'house progresivo',
      'tribal house',
      'big room',
      'melbourne bounce',
      'nu disco',
      'afro house',
      'afro tech',
      'house latino',
      'house francés',
      'hard house',
      'house melódico',
      'house orgánico',
      'hip house',
      'bass house',
      'stutter house',
      'jazz house',
      'g-house',
      'uk garage',
    ],
  },
  {
    id: 'electronic',
    label: 'Música electrónica',
    description: 'Estilos bailables sin etiqueta house concreta',
    tags: [
      'edm',
      'hi-nrg',
      'electrónica',
      'electro',
      'electroclash',
      'hyperpop',
      'happy hardcore',
      'big beat',
      'breakbeat',
      'bassline',
      'bass melódico',
      'dubstep',
      'drum and bass',
      'jungle',
      'hardcore',
      'hardstyle',
      'hard techno',
      'gabber',
      'frenchcore',
      'techengue',
      'techno',
      'hipertechno',
      'techno melódico',
      'techno hardcore',
      'acid techno',
      'minimal techno',
      'electro swing',
      'future bass',
      'downtempo',
      'trip hop',
      'idm',
      'dance',
      'dance alternativo',
      'indie dance',
      'voguing',
      'miami bass',
      'freestyle',
      'bounce',
      'new rave',
      'nightcore',
      'synthwave',
      'chillstep',
      'liquid funk',
      'rally house',
    ],
  },
  {
    id: 'trance',
    label: 'Trance',
    description: 'Trance progresivo y psicodélico',
    tags: ['trance', 'trance progresivo', 'trance psicodélico'],
  },
  {
    id: 'eurodance',
    label: 'Eurodance',
    description: 'Dance europeo de los 90 e italo dance',
    tags: ['eurodance', 'italo dance', 'disco italiana'],
  },
  {
    id: 'disco',
    label: 'Disco',
    description: 'Disco clásico de los 70 y post-disco',
    tags: ['disco', 'post-disco', 'sonido filadelfia'],
  },
  {
    id: 'pop',
    label: 'Pop',
    description: 'Pop comercial, synthpop, new wave y variantes regionales',
    tags: [
      'pop',
      'europop',
      'dance pop',
      'pop suave',
      'synthpop',
      'new wave',
      'dark wave',
      'post-punk',
      'madchester',
      'art pop',
      'jangle pop',
      'power pop',
      'pop barroco',
      'britpop',
      'pop punk',
      'pop country',
      'pop sueco',
      'pop noruego',
      'pop danés',
      'pop alemán',
      'pop brasileño',
      'pop taiwanés',
      'k-pop',
      'mandopop',
      'c-pop',
      'p-pop',
      'tropipop',
      'pop latino',
      'latina',
      'bedroom pop',
      'funk pop',
      'rap melódico',
      'lounge',
      'adult standards',
      'doo-wop',
      'navidad',
      'banda sonora',
      'música incidental',
      'musicales',
      'variété francesa',
      'chanson',
      'chanson québécois',
      'neue deutsche welle',
      'nederpop',
      'schlager',
      'partyschlager',
      'mizrahi',
      'laïkó',
      'holandesa',
      'malasio',
      'vocaloid',
      'anime',
    ],
  },
  {
    id: 'rock',
    label: 'Rock',
    description: 'Rock clásico, alternativo, blues, country rock y folk',
    tags: [
      'rock',
      'rock clásico',
      'hard rock',
      'glam rock',
      'rock alternativo',
      'rock suave',
      'rock sureño',
      'rock psicodélico',
      'rock and roll',
      'rock ácido',
      'rock progresivo',
      'art rock',
      'garage rock',
      'funk rock',
      'yacht rock',
      'post-grunge',
      'grunge',
      'blues rock',
      'blues',
      'blues modern',
      'rockabilly',
      'punk',
      'protopunk',
      'rock celta',
      'celta',
      'stoner rock',
      'rock cristiano',
      'rock alternativo cristiano',
      'rock gótico',
      'country',
      'country clásico',
      'country rock',
      'folk',
      'folk rock',
      'indie folk',
      'aor',
    ],
  },
  {
    id: 'metal',
    label: 'Metal',
    description: 'Heavy, glam, thrash y derivados',
    tags: [
      'metal',
      'heavy metal',
      'glam metal',
      'folk metal',
      'nu metal',
      'thrash metal',
      'rap metal',
      'metal alternativo',
    ],
  },
  {
    id: 'spanish',
    label: 'Música en español',
    description: 'Rock y pop en español, cantautores y trova',
    tags: [
      'rock en español',
      'rock latino',
      'rock mexicano',
      'rock argentino',
      'cantautores',
      'trova',
      'nueva trova',
      'flamenco',
      'flamenco pop',
      'música alternativa latina',
    ],
  },
  {
    id: 'soul_funk',
    label: 'Soul y funk',
    description: 'Motown, neo soul, R&B clásico, jazz funk',
    tags: [
      'soul',
      'funk',
      'motown',
      'neo soul',
      'soul clásico',
      'northern soul',
      'new jack swing',
      'funk melody',
      'funk brasileño',
      'g-funk',
      'jazz funk',
      'trap soul',
      'r&b',
      'r&b británico',
      'r&b alternativo',
      'afro soul',
      'r&b afro',
      'acid jazz',
      'smooth jazz',
      'boogie',
      'quiet storm',
    ],
  },
];

/**
 * Indice tag → macroId precomputado para lookup O(1) en
 * `categorizeTag` y `expandMacroToTags`. Construido a partir de
 * MACRO_GENRES en module load.
 */
const TAG_TO_MACRO = new Map<string, MacroGenreId>();
for (const macro of MACRO_GENRES) {
  for (const tag of macro.tags) {
    TAG_TO_MACRO.set(tag, macro.id);
  }
}

const MACRO_BY_ID = new Map<MacroGenreId, MacroGenre>(
  MACRO_GENRES.map((m) => [m.id, m]),
);

/**
 * Devuelve el macro al que pertenece un tag de Spotify, o null si el tag
 * no esta categorizado. Se usa en getTopMacroGenres y en el matching.
 */
export function categorizeTag(tag: string): MacroGenreId | null {
  return TAG_TO_MACRO.get(tag) ?? null;
}

/**
 * Devuelve los tags de Spotify que pertenecen a un macro. Util para que
 * el motor de matching expanda preferredGenres (macros) a los tags
 * concretos antes de comparar contra track.genres.
 */
export function expandMacroToTags(id: MacroGenreId): readonly string[] {
  return MACRO_BY_ID.get(id)?.tags ?? [];
}

/**
 * Devuelve un macro por id, o null si el id es desconocido (defensivo
 * contra ids antiguos que pudieran venir de Drive sync).
 */
export function getMacroById(id: string): MacroGenre | null {
  return MACRO_BY_ID.get(id as MacroGenreId) ?? null;
}

/**
 * Comprueba si un id arbitrario es un macro valido. Lo usa la migracion
 * de preferencias y los guards de cadenciaStore.
 */
export function isValidMacroId(id: string): id is MacroGenreId {
  return MACRO_BY_ID.has(id as MacroGenreId);
}

/**
 * Convierte una lista de preferencias heredadas (mezcla de tags Spotify
 * antiguos como 'edm' o 'rock clásico' con macro-IDs nuevos) a una lista
 * limpia de macro-IDs unicos. Tags no clasificables se descartan.
 *
 * Util para hidratar preferencias guardadas en versiones previas — el UI
 * pinta los macros marcados sin que el usuario perciba que sus elecciones
 * "se han perdido". El motor de matching tambien acepta tags literales
 * (fallback en scoreTrack), asi que no es estrictamente necesario aplicar
 * esta migracion en runtime; se ofrece como ayuda al UI.
 */
export function migrateLegacyGenres(prefs: readonly string[]): MacroGenreId[] {
  const out = new Set<MacroGenreId>();
  for (const p of prefs) {
    if (isValidMacroId(p)) {
      out.add(p);
      continue;
    }
    const macro = categorizeTag(p);
    if (macro !== null) out.add(macro);
  }
  return Array.from(out);
}
