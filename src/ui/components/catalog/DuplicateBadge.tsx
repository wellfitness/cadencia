import { MaterialIcon } from '@ui/components/MaterialIcon';

export interface DuplicateBadgeProps {
  /** Tamaño del grupo de versiones del mismo tema. Si es < 2, no se muestra. */
  count: number;
  className?: string;
}

/**
 * Chip sobrio que marca una canción como parte de un grupo de versiones (mismo
 * título + artista, URI distinta). Se autogestiona: si `count < 2` devuelve
 * `null`, así quien lo usa puede renderizarlo sin condicionar.
 *
 * Usa el color «info» (tulipTree) de la paleta: avisa sin alarmar (rosa) ni
 * competir con los CTA (turquesa). Compartido entre las filas del catálogo
 * nativo y de «Mis listas».
 */
export function DuplicateBadge({
  count,
  className = '',
}: DuplicateBadgeProps): JSX.Element | null {
  if (count < 2) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-tulipTree-100 text-tulipTree-800 whitespace-nowrap ${className}`}
      title={`${count} versiones del mismo tema`}
    >
      <MaterialIcon name="content_copy" size="small" className="text-tulipTree-600" />
      {count} versiones
    </span>
  );
}
