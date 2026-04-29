import type { ReactNode } from 'react';
import { HelpBreadcrumb } from './HelpBreadcrumb';
import { HelpCard } from './HelpCard';
import { findHelpArticle, findNextArticle } from './helpArticles';

export interface ArticleShellProps {
  /** Slug del articulo (ej. "zonas"). Usado para resolver el "Siguiente articulo". */
  slug: string;
  /** Titulo grande mostrado al inicio. Si se omite se toma del catalogo. */
  title?: string;
  /** Parrafo introductorio (lead). Si se omite se toma la descripcion del catalogo. */
  lead?: string;
  children: ReactNode;
}

/**
 * Marco comun a todos los articulos del centro de ayuda. Aporta breadcrumb,
 * H1 + lead, y un bloque "Siguiente articulo" al pie reusando HelpCard. Asi
 * cada articulo se ocupa solo de su contenido propio.
 */
export function ArticleShell({ slug, title, lead, children }: ArticleShellProps): JSX.Element {
  const meta = findHelpArticle(slug);
  const next = findNextArticle(slug);
  const finalTitle = title ?? meta?.title ?? '';
  const finalLead = lead ?? meta?.description;

  return (
    <article>
      <HelpBreadcrumb {...(meta?.title !== undefined ? { current: meta.title } : {})} />
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-2xl md:text-4xl text-gris-900 leading-tight mb-2">
          {finalTitle}
        </h1>
        {finalLead && (
          <p className="text-base md:text-lg text-gris-600 leading-relaxed">{finalLead}</p>
        )}
      </header>

      <div className="prose-help space-y-4 text-gris-800 leading-relaxed">
        {children}
      </div>

      {next && (
        <section className="mt-10 pt-6 border-t border-gris-200">
          <p className="text-xs uppercase tracking-wide font-semibold text-gris-500 mb-3">
            Siguiente artículo
          </p>
          <HelpCard
            href={next.path}
            icon={next.icon}
            title={next.title}
            description={next.description}
            readTime={next.readTime}
          />
        </section>
      )}
    </article>
  );
}
