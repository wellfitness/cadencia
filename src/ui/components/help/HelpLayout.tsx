import type { ReactNode } from 'react';
import { Logo } from '../Logo';
import { MaterialIcon } from '../MaterialIcon';
import { SiteFooter } from '../SiteFooter';
import { navigateInApp } from '@ui/utils/navigation';
import { HELP_ARTICLES } from './helpArticles';

export interface HelpLayoutProps {
  /** Slug del articulo activo (sin prefijo "/ayuda/"). null en el HelpHome. */
  activeSlug: string | null;
  children: ReactNode;
}

/**
 * Layout comun a todas las paginas del centro de ayuda. Header con logo +
 * back-link a la app, aside con indice solo en desktop (md:+), area de
 * contenido y SiteFooter al final.
 */
export function HelpLayout({ activeSlug, children }: HelpLayoutProps): JSX.Element {
  const handleHome = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    navigateInApp('/');
  };

  return (
    <div className="min-h-screen bg-gris-50 flex flex-col">
      <header className="bg-white border-b border-gris-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a
            href="/"
            onClick={handleHome}
            aria-label="Volver al inicio de Cadencia"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Logo variant="brand" size="sm" />
          </a>
          <a
            href="/"
            onClick={handleHome}
            className="inline-flex items-center gap-1.5 text-sm text-turquesa-600 hover:text-turquesa-700 transition-colors min-h-[44px] px-2"
          >
            <MaterialIcon name="arrow_back" size="small" decorative />
            Volver a la app
          </a>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:py-10 grid md:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden md:block sticky top-20 self-start">
          <h2 className="text-xs uppercase tracking-wide font-semibold text-gris-500 mb-3 px-2">
            Centro de ayuda
          </h2>
          <nav aria-label="Indice del centro de ayuda">
            <ul className="space-y-0.5">
              {HELP_ARTICLES.map((article) => {
                const isActive = article.slug === activeSlug;
                const handleNav = (e: React.MouseEvent<HTMLAnchorElement>): void => {
                  e.preventDefault();
                  navigateInApp(article.path);
                };
                return (
                  <li key={article.slug}>
                    <a
                      href={article.path}
                      onClick={handleNav}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-turquesa-50 text-turquesa-700 font-semibold'
                          : 'text-gris-700 hover:bg-gris-100'
                      }`}
                    >
                      <MaterialIcon
                        name={article.icon}
                        size="small"
                        className={isActive ? 'text-turquesa-600' : 'text-gris-500'}
                        decorative
                      />
                      {article.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      <SiteFooter />
    </div>
  );
}
