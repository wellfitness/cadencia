/**
 * Catalogo de articulos del centro de ayuda. Fuente unica para el indice
 * (HelpHome), el aside lateral en desktop (HelpLayout) y los breadcrumbs.
 *
 * Mantener el orden = orden de presentacion en el indice y orden de "Siguiente
 * articulo" al final de cada uno. El orden agrupa por audiencia: primero
 * ciclismo, despues carrera, despues universales (musica, Spotify, Drive).
 */
export type HelpArticleAudience = 'bike' | 'run' | 'shared';

export interface HelpArticleMeta {
  slug: string;
  /** Path completo (ej. "/ayuda/zonas"). */
  path: string;
  icon: string;
  title: string;
  description: string;
  readTime: string;
  /**
   * A qué deporte aplica el articulo. `'shared'` = vale para ambos (zonas,
   * intervalos, musica, Spotify, sincronizacion). Se usa en HelpHome para
   * agrupar visualmente las cards.
   */
  audience: HelpArticleAudience;
}

export const HELP_ARTICLES: readonly HelpArticleMeta[] = [
  // — Ciclismo —
  {
    slug: 'sesion-indoor',
    path: '/ayuda/sesion-indoor',
    icon: 'directions_bike',
    title: 'Cómo construir una sesión indoor (ciclismo)',
    description: 'Estructura típica de una sesión de rodillo o spinning, fases y cómo usar el constructor de bloques.',
    readTime: '3 min',
    audience: 'bike',
  },
  {
    slug: 'plantillas',
    path: '/ayuda/plantillas',
    icon: 'auto_awesome',
    title: 'Plantillas de ciclismo y cuándo usarlas',
    description: 'Las 8 plantillas de ciclo indoor, qué objetivo trabaja cada una y cuándo elegirla.',
    readTime: '6 min',
    audience: 'bike',
  },
  // — Carrera —
  {
    slug: 'sesion-running',
    path: '/ayuda/sesion-running',
    icon: 'directions_run',
    title: 'Cómo construir una sesión de running',
    description: 'Estructura de una sesión en pista o tapiz, fases y cómo usar el constructor de bloques en running.',
    readTime: '3 min',
    audience: 'run',
  },
  {
    slug: 'plantillas-running',
    path: '/ayuda/plantillas-running',
    icon: 'auto_awesome',
    title: 'Plantillas de running y cuándo usarlas',
    description: 'Las 6 plantillas de running (Yasso 800s, Daniels, Threshold Cruise, HIIT 30-30…), qué trabaja cada una y cuándo elegirla.',
    readTime: '6 min',
    audience: 'run',
  },
  {
    slug: 'gpx-running',
    path: '/ayuda/gpx-running',
    icon: 'terrain',
    title: 'Cómo trabaja Cadencia tu GPX de carrera',
    description: 'Cómo deriva la app la zona de cada tramo desde la pendiente del terreno (polinomio metabólico de Minetti).',
    readTime: '4 min',
    audience: 'run',
  },
  // — Universales (ambos deportes) —
  {
    slug: 'tests-fisiologicos',
    path: '/ayuda/tests-fisiologicos',
    icon: 'monitor_heart',
    title: 'Tests fisiológicos guiados',
    description: 'Los 6 tests de campo de Cadencia (rampa, MAP-5min, 3MT en bici; Daniels, 5min, 30-15 IFT en run): protocolo, fórmulas y cuándo elegir cada uno.',
    readTime: '6 min',
    audience: 'shared',
  },
  {
    slug: 'zonas',
    path: '/ayuda/zonas',
    icon: 'speed',
    title: 'Zonas de entrenamiento (Z1-Z6)',
    description: 'Tabla maestra de zonas con %FTP (ciclismo), %FCmáx (universal), RPE y el color asociado en la app.',
    readTime: '4 min',
    audience: 'shared',
  },
  {
    slug: 'intervalos',
    path: '/ayuda/intervalos',
    icon: 'show_chart',
    title: 'Prescripción de intervalos',
    description: 'TMM, TTA, recuperación y objetivo fisiológico por zona. Aplicable a ciclismo y running.',
    readTime: '5 min',
    audience: 'shared',
  },
  {
    slug: 'musica',
    path: '/ayuda/musica',
    icon: 'music_note',
    title: 'Cómo se elige la música de cada bloque',
    description: 'Coincidencia de cadencia 1:1 y 2:1, energía y valencia ideales, y qué cambia entre ciclismo y running.',
    readTime: '4 min',
    audience: 'shared',
  },
  {
    slug: 'spotify',
    path: '/ayuda/spotify',
    icon: 'help_outline',
    title: 'Spotify y preguntas frecuentes',
    description: 'OAuth PKCE, errores comunes y tracks no encontrados.',
    readTime: '4 min',
    audience: 'shared',
  },
  {
    slug: 'sincronizar-drive',
    path: '/ayuda/sincronizar-drive',
    icon: 'manage_accounts',
    title: 'Mis preferencias, calendario y sincronización',
    description:
      'Qué guarda Cadencia de ti, dónde lo edita, cómo planificar tus entrenamientos y cómo llevar todo entre dispositivos con Google Drive.',
    readTime: '6 min',
    audience: 'shared',
  },
];

export function findHelpArticle(slug: string): HelpArticleMeta | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

/**
 * Devuelve el siguiente articulo despues de `slug` en el orden del catalogo,
 * o undefined si es el ultimo. Para el bloque "Siguiente articulo" al final
 * de cada pagina.
 */
export function findNextArticle(slug: string): HelpArticleMeta | undefined {
  const idx = HELP_ARTICLES.findIndex((a) => a.slug === slug);
  if (idx === -1 || idx === HELP_ARTICLES.length - 1) return undefined;
  return HELP_ARTICLES[idx + 1];
}
