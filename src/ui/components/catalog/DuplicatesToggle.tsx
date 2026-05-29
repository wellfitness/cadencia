import { MaterialIcon } from '@ui/components/MaterialIcon';

export interface DuplicatesToggleProps {
  /** Si el filtro «solo duplicados» está activo. */
  active: boolean;
  /** Nº de canciones que pertenecen a algún grupo de versiones. */
  count: number;
  onToggle: () => void;
}

/**
 * Pastilla-filtro «Solo duplicados (N)» compartida por las pestañas «Catálogo
 * nativo» y «Mis listas». Al activarse, deja en pantalla solo las canciones que
 * forman parte de un grupo de versiones (mismo título + artista, URI distinta).
 *
 * Presentacional puro: el estado y la lógica de filtrado viven en cada pestaña.
 * Quien lo renderiza decide cuándo mostrarlo (típicamente, solo si `count > 0`).
 */
export function DuplicatesToggle({
  active,
  count,
  onToggle,
}: DuplicatesToggleProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title="Mostrar solo las canciones con versiones duplicadas"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold min-h-[32px] tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 ${
        active
          ? 'bg-turquesa-600 border-turquesa-600 text-white'
          : 'bg-white border-gris-300 text-gris-700 hover:border-turquesa-400 hover:text-turquesa-700'
      }`}
    >
      <MaterialIcon name="content_copy" size="small" />
      Solo duplicados ({count})
    </button>
  );
}
