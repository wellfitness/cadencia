import type { GenreCount, GenreCoverage } from '@core/tracks';
import type { HeartRateZone } from '@core/physiology/karvonen';

export interface GenrePillsProps {
  availableGenres: readonly GenreCount[];
  selectedGenres: readonly string[];
  onChange: (genres: string[]) => void;
  /**
   * Cobertura por zona × profile. Si esta presente, cada pill muestra una
   * mini-rejilla Z1-Z6 con celdas coloreadas segun candidateCount agregado
   * por zona (suma de profiles).
   */
  coverage?: readonly GenreCoverage[];
  /**
   * Si false, las pills se renderizan como spans no clicables (informativo).
   * Default true. La opcion 'limpiar seleccion' tampoco aparece en read-only.
   */
  interactive?: boolean;
}

const ZONES: readonly HeartRateZone[] = [1, 2, 3, 4, 5, 6];

/**
 * Agrega los `cells` de una cobertura por zona, sumando candidateCount entre
 * profiles de la misma zona. La rejilla del UI muestra Z1-Z6, no profiles.
 */
function aggregateByZone(coverage: GenreCoverage): Record<HeartRateZone, number> {
  const acc: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const cell of coverage.cells) {
    acc[cell.zone] += cell.candidateCount;
  }
  return acc;
}

/**
 * Color de la celda segun el numero de candidatos. La gradacion es
 * deliberadamente discreta (no continua) para que el usuario perciba
 * "vacio / poco / suficiente" de un vistazo.
 */
function cellColor(count: number): string {
  if (count === 0) return 'bg-gris-200';
  if (count <= 2) return 'bg-tulipTree-300';
  return 'bg-turquesa-500';
}

interface ZoneCoverageGridProps {
  coverage: GenreCoverage;
}

function ZoneCoverageGrid({ coverage }: ZoneCoverageGridProps): JSX.Element {
  const byZone = aggregateByZone(coverage);
  return (
    <div
      className="flex items-center gap-[2px] mt-1"
      role="group"
      aria-label={`Cobertura del genero ${coverage.genre} por zona`}
    >
      {ZONES.map((z) => {
        const count = byZone[z];
        const label =
          count === 0
            ? `Z${z}: sin canciones`
            : `Z${z}: ${count} ${count === 1 ? 'canción' : 'canciones'}`;
        return (
          <span
            key={z}
            className={`inline-block w-3 h-2 rounded-sm ${cellColor(count)}`}
            aria-label={label}
            title={label}
          />
        );
      })}
    </div>
  );
}

/**
 * Multi-select de generos como pills clicables. Sin seleccion = no filtrar
 * (catalogo entero disponible para el matching).
 *
 * Accesibilidad: cada pill es un button con role="checkbox" y aria-checked.
 * Touch target >= 36px en mobile (cuando coverage esta presente la pill
 * crece a ~52px por la rejilla).
 *
 * Cuando se pasa `coverage`, dentro de cada pill aparece una mini-rejilla
 * Z1-Z6 que muestra cuantas canciones del genero hay por zona en el pool
 * activo. Las celdas se colorean discretas: gris (0), tulipTree (1-2),
 * turquesa (≥3).
 *
 * Cuando se pasa `interactive={false}`, las pills se renderizan como spans
 * informativos sin click — util para la card de "qué tiene tu fuente"
 * cuando la edicion vive en otra pagina.
 */
export function GenrePills({
  availableGenres,
  selectedGenres,
  onChange,
  coverage,
  interactive = true,
}: GenrePillsProps): JSX.Element {
  const toggle = (genre: string): void => {
    if (selectedGenres.includes(genre)) {
      onChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onChange([...selectedGenres, genre]);
    }
  };

  const coverageByGenre = new Map<string, GenreCoverage>();
  if (coverage !== undefined) {
    for (const c of coverage) coverageByGenre.set(c.genre, c);
  }
  const showCoverage = coverage !== undefined;

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role={interactive ? 'group' : 'list'}
        aria-label="Géneros disponibles"
      >
        {availableGenres.map(({ genre, count }) => {
          const selected = selectedGenres.includes(genre);
          const cov = coverageByGenre.get(genre);
          const baseClasses = `inline-flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-1.5 ${
            showCoverage ? 'min-h-[52px]' : 'min-h-[36px]'
          } text-sm font-semibold transition-colors duration-200`;
          const colorClasses = selected
            ? 'border-turquesa-600 bg-turquesa-600 text-white'
            : 'border-gris-300 bg-white text-gris-700 hover:border-turquesa-400 hover:bg-turquesa-50/40';
          const inactiveColorClasses =
            'border-gris-200 bg-gris-50 text-gris-700 cursor-default';
          const className = `${baseClasses} ${
            interactive ? colorClasses : inactiveColorClasses
          }`;
          const inner = (
            <>
              <div className="inline-flex items-center gap-1.5">
                <span className="capitalize">{genre}</span>
                <span
                  className={`text-xs tabular-nums ${
                    interactive && selected ? 'text-turquesa-100' : 'text-gris-400'
                  }`}
                >
                  {count}
                </span>
              </div>
              {cov !== undefined && <ZoneCoverageGrid coverage={cov} />}
            </>
          );
          if (!interactive) {
            return (
              <span key={genre} role="listitem" className={className}>
                {inner}
              </span>
            );
          }
          return (
            <button
              key={genre}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(genre)}
              className={className}
            >
              {inner}
            </button>
          );
        })}
      </div>
      {interactive && selectedGenres.length > 0 && (
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
