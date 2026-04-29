/**
 * Catalogo de articulos del centro de ayuda. Fuente unica para el indice
 * (HelpHome), el aside lateral en desktop (HelpLayout) y los breadcrumbs.
 *
 * Mantener el orden = orden de presentacion en el indice y orden de "Siguiente
 * articulo" al final de cada uno.
 */
export interface HelpArticleMeta {
  slug: string;
  /** Path completo (ej. "/ayuda/zonas"). */
  path: string;
  icon: string;
  title: string;
  description: string;
  readTime: string;
}

export const HELP_ARTICLES: readonly HelpArticleMeta[] = [
  {
    slug: 'sesion-indoor',
    path: '/ayuda/sesion-indoor',
    icon: 'directions_bike',
    title: 'Cómo construir una sesión indoor',
    description: 'Estructura típica, fases y cómo usar el constructor de bloques.',
    readTime: '3 min',
  },
  {
    slug: 'zonas',
    path: '/ayuda/zonas',
    icon: 'speed',
    title: 'Zonas de entrenamiento',
    description: 'Tabla maestra Z1-Z6 con %FTP, %FCmáx, RPE y el color asociado en la app.',
    readTime: '4 min',
  },
  {
    slug: 'intervalos',
    path: '/ayuda/intervalos',
    icon: 'show_chart',
    title: 'Prescripción de intervalos',
    description: 'TMM, TTA, recuperación y objetivo fisiológico por zona.',
    readTime: '5 min',
  },
  {
    slug: 'plantillas',
    path: '/ayuda/plantillas',
    icon: 'auto_awesome',
    title: 'Plantillas y cuándo usarlas',
    description: 'Las 8 plantillas, qué objetivo trabaja cada una y cuándo elegirla.',
    readTime: '6 min',
  },
  {
    slug: 'musica',
    path: '/ayuda/musica',
    icon: 'music_note',
    title: 'Cómo se elige la música de cada bloque',
    description: 'Coincidencia de cadencia 1:1 y 2:1, energía y valencia ideales, y la puntuación determinista.',
    readTime: '4 min',
  },
  {
    slug: 'spotify',
    path: '/ayuda/spotify',
    icon: 'help_outline',
    title: 'Spotify y preguntas frecuentes',
    description: 'OAuth PKCE, errores comunes y tracks no encontrados.',
    readTime: '4 min',
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
