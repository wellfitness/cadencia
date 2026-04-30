import { HelpCard } from '@ui/components/help/HelpCard';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { HELP_ARTICLES, type HelpArticleMeta } from '@ui/components/help/helpArticles';

/**
 * Landing del centro de ayuda. Muestra los articulos agrupados en tres
 * bloques visuales:
 *   1. Ciclismo
 *   2. Carrera
 *   3. Universales (música, Spotify, sincronizacion)
 *
 * El agrupamiento facilita que un usuario que solo entrena uno de los
 * deportes encuentre rapido lo suyo, sin tener que filtrar mentalmente
 * entre 10 cards mezcladas. Sin sidebar (la propia pagina hace de indice).
 */
export function HelpHome(): JSX.Element {
  const bikeArticles = HELP_ARTICLES.filter((a) => a.audience === 'bike');
  const runArticles = HELP_ARTICLES.filter((a) => a.audience === 'run');
  const sharedArticles = HELP_ARTICLES.filter((a) => a.audience === 'shared');

  return (
    <div>
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl md:text-5xl text-gris-900 leading-tight mb-3">
          Centro de ayuda
        </h1>
        <p className="text-base md:text-lg text-gris-600 leading-relaxed max-w-2xl">
          Aprende a construir sesiones de ciclismo o running adecuadas a tu objetivo,
          entiende cómo Cadencia empareja música e intensidad, y resuelve dudas frecuentes
          sobre Spotify, planificación y privacidad.
        </p>
      </header>

      <Section title="Ciclismo" icon="directions_bike" articles={bikeArticles} />
      <Section title="Carrera" icon="directions_run" articles={runArticles} />
      <Section title="Universal — música, integraciones y privacidad" icon="public" articles={sharedArticles} />
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: string;
  articles: readonly HelpArticleMeta[];
}

function Section({ title, icon, articles }: SectionProps): JSX.Element {
  if (articles.length === 0) return <></>;
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mb-4 flex items-center gap-2">
        <MaterialIcon name={icon} className="text-turquesa-600" decorative />
        {title}
      </h2>
      <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
        {articles.map((article) => (
          <HelpCard
            key={article.slug}
            href={article.path}
            icon={article.icon}
            title={article.title}
            description={article.description}
            readTime={article.readTime}
          />
        ))}
      </div>
    </section>
  );
}
