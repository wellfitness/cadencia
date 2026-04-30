import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface ExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'> {
  href: string;
  children: ReactNode;
  /**
   * Override del rel por defecto. NO se recomienda quitar `noopener`.
   * Si necesitas anyadir tokens (`me`, `prefetch`...), pasa el set completo.
   */
  rel?: string;
}

/**
 * Enlace que abre en pestanya nueva con `rel="noopener noreferrer"` por
 * defecto. Centralizar el patron evita olvidos: sin `noopener`, la pagina
 * destino puede acceder a `window.opener` y redirigir o leer estado de
 * Cadencia (ataque tabnabbing). Sin `noreferrer`, exponemos el path actual
 * al sitio destino via Referer.
 *
 * Codigo nuevo: usar SIEMPRE este componente en lugar de escribir
 * `target="_blank"` a mano.
 */
export function ExternalLink({
  href,
  children,
  rel = 'noopener noreferrer',
  ...rest
}: ExternalLinkProps): JSX.Element {
  return (
    <a href={href} target="_blank" rel={rel} {...rest}>
      {children}
    </a>
  );
}
