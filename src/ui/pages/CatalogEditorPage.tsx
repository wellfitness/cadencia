import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import { loadNativeTracks, serializeTracksToCsv, type Track } from '@core/tracks';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackPreviewButton } from '@ui/components/TrackPreviewButton';
import { downloadTextFile } from '@ui/utils/downloadFile';

export interface CatalogEditorPageProps {
  /** Callback que vuelve al wizard. Lo inyecta App tras detectar la ruta. */
  onClose: () => void;
}

/**
 * Pantalla independiente accesible via URL `/catalogo`. Muestra el catalogo
 * nativo (`src/data/tracks/all.csv`), permite filtrar y desmarcar las
 * canciones que el usuario no quiere, y descarga el resultado como un CSV
 * compatible con `parseTrackCsv` para que el usuario pueda subirlo despues
 * en `MusicStep` como fuente propia.
 *
 * Modelo mental: **allowlist** — todas las filas marcadas por defecto, el
 * usuario desmarca. El contador del header refleja exactamente lo que se
 * descargara.
 *
 * Sin persistencia entre sesiones: la descarga ES la persistencia. Si el
 * usuario cierra sin descargar, las marcas se pierden. Coherente con que
 * los CSVs subidos tampoco se persisten en `App` (solo viven en memoria).
 */
export function CatalogEditorPage({ onClose }: CatalogEditorPageProps): JSX.Element {
  const allTracks = useMemo(() => loadNativeTracks(), []);
  const totalCount = allTracks.length;

  const [included, setIncluded] = useState<ReadonlySet<string>>(
    () => new Set(allTracks.map((t) => t.uri)),
  );
  const [searchText, setSearchText] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bpmMin, setBpmMin] = useState<string>('');
  const [bpmMax, setBpmMax] = useState<string>('');

  // Pintamos el title de la pestaña para que el usuario distinga visualmente
  // entre la pestaña del wizard y esta — patron consistente con TVModeRoute.
  useEffect(() => {
    const previous = document.title;
    document.title = 'Personalizar catálogo · Cadencia';
    return () => {
      document.title = previous;
    };
  }, []);

  // Lista de Sources distintos (para el filtro de listas origen). El
  // catalogo nativo trae cada track anotado con el CSV de procedencia
  // gracias a `scripts/build-tracks.mjs`.
  const allSources = useMemo<readonly string[]>(() => {
    const set = new Set<string>();
    for (const t of allTracks) {
      if (t.source !== '') set.add(t.source);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allTracks]);

  // Lista filtrada visible. Los filtros NO mutan el catalogo: se aplican
  // sobre el render. Mantener el state separado de la lista visible permite
  // que las acciones masivas operen sobre el subconjunto en pantalla.
  const filteredTracks = useMemo<readonly Track[]>(() => {
    const q = searchText.trim().toLowerCase();
    const minN = bpmMin.trim() === '' ? null : Number(bpmMin);
    const maxN = bpmMax.trim() === '' ? null : Number(bpmMax);
    return allTracks.filter((t) => {
      if (q !== '') {
        const haystack =
          `${t.name} ${t.artists.join(' ')} ${t.album} ${t.genres.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (selectedSources.size > 0 && !selectedSources.has(t.source)) return false;
      if (minN !== null && Number.isFinite(minN) && t.tempoBpm < minN) return false;
      if (maxN !== null && Number.isFinite(maxN) && t.tempoBpm > maxN) return false;
      return true;
    });
  }, [allTracks, searchText, selectedSources, bpmMin, bpmMax]);

  const visibleCount = filteredTracks.length;
  const includedCount = included.size;

  const toggleIncluded = (uri: string): void => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const markAllVisible = (): void => {
    setIncluded((prev) => {
      const next = new Set(prev);
      for (const t of filteredTracks) next.add(t.uri);
      return next;
    });
  };

  const unmarkAllVisible = (): void => {
    setIncluded((prev) => {
      const next = new Set(prev);
      for (const t of filteredTracks) next.delete(t.uri);
      return next;
    });
  };

  const toggleSource = (source: string): void => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const clearFilters = (): void => {
    setSearchText('');
    setSelectedSources(new Set());
    setBpmMin('');
    setBpmMax('');
  };

  const handleDownload = (): void => {
    if (includedCount === 0) return;
    const toDownload = allTracks.filter((t) => included.has(t.uri));
    const csv = serializeTracksToCsv(toDownload);
    downloadTextFile('cadencia-mi-catalogo.csv', 'text/csv;charset=utf-8', csv);
  };

  const filtersActive =
    searchText.trim() !== '' ||
    selectedSources.size > 0 ||
    bpmMin.trim() !== '' ||
    bpmMax.trim() !== '';

  return (
    <div className="min-h-full flex flex-col bg-gris-50">
      <header className="sticky top-0 z-30 border-b border-gris-200 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 md:py-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="self-start inline-flex items-center gap-1.5 text-sm text-turquesa-700 font-semibold hover:text-turquesa-800 hover:underline min-h-[36px]"
            >
              <MaterialIcon name="arrow_back" size="small" />
              Volver a la música
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-display font-bold text-gris-900 truncate">
                Personalizar catálogo nativo
              </h1>
              <p
                className="text-xs text-gris-600 tabular-nums"
                aria-live="polite"
                aria-atomic="true"
              >
                <strong className="text-gris-800">{includedCount}</strong> de{' '}
                <strong className="text-gris-800">{totalCount}</strong> canciones marcadas
                {filtersActive && (
                  <>
                    {' · '}
                    <span className="text-turquesa-700">{visibleCount} visibles</span>
                  </>
                )}
              </p>
            </div>
            <Button
              variant="primary"
              iconLeft="download"
              onClick={handleDownload}
              disabled={includedCount === 0}
            >
              Descargar CSV ({includedCount})
            </Button>
          </div>

          <FiltersBar
            searchText={searchText}
            onSearchTextChange={setSearchText}
            allSources={allSources}
            selectedSources={selectedSources}
            onToggleSource={toggleSource}
            bpmMin={bpmMin}
            bpmMax={bpmMax}
            onBpmMinChange={setBpmMin}
            onBpmMaxChange={setBpmMax}
            filtersActive={filtersActive}
            onClearFilters={clearFilters}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={markAllVisible}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gris-300 bg-white text-gris-700 hover:border-turquesa-400 hover:text-turquesa-700 min-h-[32px]"
            >
              <MaterialIcon name="done_all" size="small" />
              Marcar todas las visibles
            </button>
            <button
              type="button"
              onClick={unmarkAllVisible}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gris-300 bg-white text-gris-700 hover:border-rosa-400 hover:text-rosa-600 min-h-[32px]"
            >
              <MaterialIcon name="remove_done" size="small" />
              Desmarcar todas las visibles
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          {visibleCount === 0 ? (
            <div className="rounded-lg border border-gris-200 bg-white p-6 text-center text-sm text-gris-500">
              Ningún tema cumple los filtros actuales.{' '}
              <button
                type="button"
                onClick={clearFilters}
                className="text-turquesa-700 font-semibold underline-offset-2 hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <ul className="space-y-1" role="list">
              {filteredTracks.map((t) => (
                <li key={t.uri}>
                  <TrackRow
                    track={t}
                    checked={included.has(t.uri)}
                    onToggle={() => toggleIncluded(t.uri)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

interface FiltersBarProps {
  searchText: string;
  onSearchTextChange: (next: string) => void;
  allSources: readonly string[];
  selectedSources: ReadonlySet<string>;
  onToggleSource: (source: string) => void;
  bpmMin: string;
  bpmMax: string;
  onBpmMinChange: (next: string) => void;
  onBpmMaxChange: (next: string) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
}

function FiltersBar({
  searchText,
  onSearchTextChange,
  allSources,
  selectedSources,
  onToggleSource,
  bpmMin,
  bpmMax,
  onBpmMinChange,
  onBpmMaxChange,
  filtersActive,
  onClearFilters,
}: FiltersBarProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 md:gap-3 items-start md:items-center">
      <label className="flex flex-col gap-1">
        <span className="sr-only">Buscar canción, artista, álbum o género</span>
        <div className="relative">
          <MaterialIcon
            name="search"
            size="small"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-400 pointer-events-none"
          />
          <input
            type="search"
            value={searchText}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchTextChange(e.target.value)}
            placeholder="Buscar por canción, artista, álbum o género…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[40px]"
          />
        </div>
      </label>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gris-600">BPM</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={bpmMin}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onBpmMinChange(e.target.value)}
          placeholder="min"
          aria-label="BPM mínimo"
          className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px] tabular-nums"
        />
        <span aria-hidden className="text-gris-400">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={bpmMax}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onBpmMaxChange(e.target.value)}
          placeholder="max"
          aria-label="BPM máximo"
          className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px] tabular-nums"
        />
      </div>

      {filtersActive && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gris-600 hover:text-rosa-600 min-h-[36px]"
        >
          <MaterialIcon name="filter_alt_off" size="small" />
          Limpiar filtros
        </button>
      )}

      {allSources.length > 1 && (
        <details className="md:col-span-3 group">
          <summary className="cursor-pointer text-xs text-gris-700 hover:text-turquesa-700 inline-flex items-center gap-1 select-none min-h-[32px]">
            <MaterialIcon name="filter_list" size="small" />
            Filtrar por lista origen
            {selectedSources.size > 0 && (
              <span className="ml-1 text-[10px] bg-turquesa-100 text-turquesa-800 rounded-full px-1.5 py-0.5 tabular-nums">
                {selectedSources.size}
              </span>
            )}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allSources.map((s) => {
              const active = selectedSources.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggleSource(s)}
                  aria-pressed={active}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors min-h-[32px] ${
                    active
                      ? 'bg-turquesa-600 border-turquesa-600 text-white'
                      : 'bg-white border-gris-300 text-gris-700 hover:border-turquesa-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  checked: boolean;
  onToggle: () => void;
}

function TrackRow({ track, checked, onToggle }: TrackRowProps): JSX.Element {
  const checkboxId = useId();
  const visibleGenres = track.genres.slice(0, 3);
  const extraGenres = track.genres.length - visibleGenres.length;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors border ${
        checked
          ? 'bg-white border-gris-200 hover:border-turquesa-300'
          : 'bg-gris-50 border-gris-200 opacity-70 hover:opacity-100'
      }`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-2 w-5 h-5 accent-turquesa-600 cursor-pointer flex-shrink-0"
        aria-label={`${checked ? 'Excluir' : 'Incluir'} ${track.name}`}
      />
      <TrackPreviewButton uri={track.uri} />
      <label
        htmlFor={checkboxId}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <p className="text-sm font-semibold text-gris-800 truncate">{track.name}</p>
        <p className="text-xs text-gris-600 truncate">{track.artists.join(', ')}</p>
        <p className="text-xs text-gris-500 truncate">{track.album}</p>
        {visibleGenres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {visibleGenres.map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gris-100 text-gris-600"
              >
                {g}
              </span>
            ))}
            {extraGenres > 0 && (
              <span className="text-[10px] text-gris-500 self-center">+{extraGenres}</span>
            )}
          </div>
        )}
      </label>
      <label
        htmlFor={checkboxId}
        className="text-xs text-gris-600 tabular-nums flex flex-col items-end flex-shrink-0 cursor-pointer"
      >
        <span>
          <strong className="text-gris-800">{Math.round(track.tempoBpm)}</strong> BPM
        </span>
        {track.source !== '' && (
          <span className="text-gris-400 max-w-[140px] truncate" title={track.source}>
            {track.source}
          </span>
        )}
      </label>
    </div>
  );
}
