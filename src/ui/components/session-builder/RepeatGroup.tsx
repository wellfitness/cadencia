import type { ReactNode } from 'react';
import { MaterialIcon } from '../MaterialIcon';

export interface RepeatGroupProps {
  repeat: number;
  onRepeatChange: (next: number) => void;
  onUngroup: () => void;
  onRemove: () => void;
  /** Duracion total del grupo expandido en segundos (para mostrar). */
  expandedDurationSec: number;
  children: ReactNode;
  className?: string;
}

const MIN_REPEAT = 1;
const MAX_REPEAT = 20;

/**
 * Contenedor visual de un grupo con repeticiones × N. Muestra un selector
 * inline para subir/bajar las repeticiones y botones para desagrupar (los
 * bloques pasan a sueltos) o eliminar el grupo entero.
 */
export function RepeatGroup({
  repeat,
  onRepeatChange,
  onUngroup,
  onRemove,
  expandedDurationSec,
  children,
  className = '',
}: RepeatGroupProps): JSX.Element {
  const minutes = Math.round(expandedDurationSec / 60);

  const decRepeat = (): void => {
    if (repeat > MIN_REPEAT) onRepeatChange(repeat - 1);
  };
  const incRepeat = (): void => {
    if (repeat < MAX_REPEAT) onRepeatChange(repeat + 1);
  };

  return (
    <section
      className={`relative rounded-xl border-2 border-dashed border-turquesa-300 bg-turquesa-50/40 p-3 md:p-4 ${className}`.trim()}
      aria-label={`Grupo de bloques que se repite ${repeat} veces`}
    >
      <header className="flex items-center justify-between mb-2 md:mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-turquesa-600 text-white font-bold text-xs md:text-sm px-2.5 py-1">
            <MaterialIcon name="repeat" size="small" decorative />
            <span className="tabular-nums">× {repeat}</span>
          </span>
          <span className="text-xs text-gris-500 tabular-nums">≈ {minutes} min</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={decRepeat}
            disabled={repeat <= MIN_REPEAT}
            aria-label="Disminuir repeticiones"
            className="w-8 h-8 rounded-md border border-gris-300 bg-white text-gris-700 hover:bg-gris-50 disabled:opacity-40 flex items-center justify-center"
          >
            <MaterialIcon name="remove" size="small" />
          </button>
          <button
            type="button"
            onClick={incRepeat}
            disabled={repeat >= MAX_REPEAT}
            aria-label="Aumentar repeticiones"
            className="w-8 h-8 rounded-md border border-gris-300 bg-white text-gris-700 hover:bg-gris-50 disabled:opacity-40 flex items-center justify-center"
          >
            <MaterialIcon name="add" size="small" />
          </button>
          <button
            type="button"
            onClick={onUngroup}
            aria-label="Desagrupar"
            title="Desagrupar (los bloques pasan a sueltos)"
            className="w-8 h-8 rounded-md border border-gris-300 bg-white text-gris-700 hover:bg-gris-50 flex items-center justify-center ml-1"
          >
            <MaterialIcon name="splitscreen" size="small" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Eliminar grupo"
            className="w-8 h-8 rounded-md border border-rosa-200 bg-white text-rosa-600 hover:bg-rosa-50 flex items-center justify-center"
          >
            <MaterialIcon name="delete" size="small" />
          </button>
        </div>
      </header>
      <div className="space-y-1.5 md:space-y-2">{children}</div>
    </section>
  );
}
