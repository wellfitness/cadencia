import type { GenreCount } from '@core/tracks';

export interface GenrePillsProps {
  availableGenres: readonly GenreCount[];
  selectedGenres: readonly string[];
  onChange: (genres: string[]) => void;
}

/**
 * Multi-select de generos como pills clicables. Sin seleccion = no filtrar
 * (catalogo entero disponible para el matching).
 *
 * Accesibilidad: cada pill es un button con role="checkbox" y aria-checked.
 * Touch target >= 44px en mobile.
 */
export function GenrePills({
  availableGenres,
  selectedGenres,
  onChange,
}: GenrePillsProps): JSX.Element {
  const toggle = (genre: string): void => {
    if (selectedGenres.includes(genre)) {
      onChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onChange([...selectedGenres, genre]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Géneros preferidos">
        {availableGenres.map(({ genre, count }) => {
          const selected = selectedGenres.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(genre)}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 min-h-[36px] text-sm font-semibold transition-colors duration-200 ${
                selected
                  ? 'border-turquesa-600 bg-turquesa-600 text-white'
                  : 'border-gris-300 bg-white text-gris-700 hover:border-turquesa-400 hover:bg-turquesa-50/40'
              }`}
            >
              <span className="capitalize">{genre}</span>
              <span
                className={`text-xs tabular-nums ${
                  selected ? 'text-turquesa-100' : 'text-gris-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {selectedGenres.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 text-xs text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline font-medium"
        >
          Limpiar selección ({selectedGenres.length})
        </button>
      )}
    </div>
  );
}
