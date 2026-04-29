import { MaterialIcon } from '../MaterialIcon';
import { navigateInApp } from '@ui/utils/navigation';

export interface HelpBreadcrumbProps {
  /** Titulo del articulo actual; si se omite renderiza solo "Centro de ayuda". */
  current?: string;
}

/**
 * Breadcrumb para articulos del centro de ayuda. Aparece debajo del header y
 * sirve como ancla rapida al indice. Usa navigateInApp en lugar de un <a>
 * con onClick para que el back-button del navegador funcione coherentemente.
 */
export function HelpBreadcrumb({ current }: HelpBreadcrumbProps): JSX.Element {
  const handleHome = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    navigateInApp('/ayuda');
  };

  return (
    <nav aria-label="Migas de pan" className="text-sm text-gris-500 mb-4 flex items-center gap-1.5">
      <a
        href="/ayuda"
        onClick={handleHome}
        className="hover:text-turquesa-600 transition-colors flex items-center gap-1"
      >
        <MaterialIcon name="help_outline" size="small" decorative />
        Centro de ayuda
      </a>
      {current && (
        <>
          <MaterialIcon name="chevron_right" size="small" className="text-gris-400" decorative />
          <span className="text-gris-700 font-medium">{current}</span>
        </>
      )}
    </nav>
  );
}
