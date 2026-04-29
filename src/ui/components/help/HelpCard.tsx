import { MaterialIcon } from '../MaterialIcon';
import { navigateInApp } from '@ui/utils/navigation';

export interface HelpCardProps {
  /** Path absoluto al que navegar (ej. "/ayuda/zonas"). */
  href: string;
  /** Icono Material Icons mostrado a la izquierda. */
  icon: string;
  title: string;
  description: string;
  /** Tiempo de lectura aproximado (ej. "3 min"). */
  readTime?: string;
}

/**
 * Card de articulo del centro de ayuda. Se usa tanto en HelpHome (grid de 6)
 * como en el aside lateral o en bloques "Siguiente articulo" al final de cada
 * articulo. Layout consistente: icono, titulo, descripcion corta, tiempo de
 * lectura opcional, flecha de avance.
 */
export function HelpCard({ href, icon, title, description, readTime }: HelpCardProps): JSX.Element {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    navigateInApp(href);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="group flex items-start gap-3 p-4 bg-white border border-gris-200 rounded-xl hover:border-turquesa-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500 focus-visible:ring-offset-2 no-underline"
    >
      <span className="shrink-0 w-10 h-10 rounded-lg bg-turquesa-50 text-turquesa-600 flex items-center justify-center group-hover:bg-turquesa-100 transition-colors">
        <MaterialIcon name={icon} size="medium" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base md:text-lg font-semibold text-gris-800 group-hover:text-turquesa-700 transition-colors">
          {title}
        </span>
        <span className="block text-sm text-gris-600 leading-snug mt-1">{description}</span>
        {readTime && (
          <span className="inline-flex items-center gap-1 mt-2 text-xs text-gris-500">
            <MaterialIcon name="schedule" size="small" decorative />
            {readTime} de lectura
          </span>
        )}
      </span>
      <MaterialIcon
        name="arrow_forward"
        size="small"
        className="shrink-0 text-gris-400 group-hover:text-turquesa-600 transition-colors mt-1"
        decorative
      />
    </a>
  );
}
