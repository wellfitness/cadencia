import { HelpCard } from '@ui/components/help/HelpCard';
import { HELP_ARTICLES } from '@ui/components/help/helpArticles';

/**
 * Landing del centro de ayuda. Grid con los 6 articulos disponibles. Sin
 * sidebar (la propia pagina hace de indice). Mantiene la cabecera y el
 * SiteFooter via HelpLayout.
 */
export function HelpHome(): JSX.Element {
  return (
    <div>
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl md:text-5xl text-gris-900 leading-tight mb-3">
          Centro de ayuda
        </h1>
        <p className="text-base md:text-lg text-gris-600 leading-relaxed max-w-2xl">
          Aprende a construir sesiones indoor adecuadas a tu objetivo, entiende cómo
          Cadencia empareja música e intensidad, y resuelve dudas frecuentes sobre Spotify
          y privacidad.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
        {HELP_ARTICLES.map((article) => (
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
    </div>
  );
}
