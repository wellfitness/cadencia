import { MaterialIcon } from './MaterialIcon';

export interface BestEffortBannerProps {
  /** Numero de canciones en la playlist con matchQuality === 'best-effort'. */
  count: number;
}

/**
 * Banner dorado informativo que aparece cuando hay tracks marcados como
 * "encaje libre" (best-effort). Explica al usuario que el motor incluyó
 * esas canciones porque eran las más próximas al ideal de cadencia para su
 * zona, pero no son una coincidencia perfecta. Recomienda subir más listas.
 *
 * Se renderiza en MusicStep (preview) y en ResultStep (lista final), siempre
 * antes de la Card "Tu lista", para que el usuario vea el aviso antes de la
 * tabla de tracks.
 */
export function BestEffortBanner({ count }: BestEffortBannerProps): JSX.Element {
  const titulo =
    count === 1
      ? '1 canción de «encaje libre»'
      : `${count} canciones de «encaje libre»`;
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-tulipTree-300 bg-tulipTree-50 p-4 md:p-5 flex items-start gap-3"
    >
      <MaterialIcon
        name="info"
        size="medium"
        className="text-tulipTree-600 flex-shrink-0 mt-0.5"
      />
      <div className="min-w-0">
        <h2 className="text-base md:text-lg font-display font-semibold text-gris-900">
          {titulo}
        </h2>
        <p className="text-sm text-gris-700 mt-1">
          Tu catálogo no tiene canciones con la cadencia ideal para esas zonas,
          así que el motor incluyó las opciones más próximas al ideal. Suenan
          algo fuera de objetivo, pero cumplen su función. Si subes más listas
          en el paso «Música» encontraremos candidatos mejor adaptados.
        </p>
      </div>
    </div>
  );
}
