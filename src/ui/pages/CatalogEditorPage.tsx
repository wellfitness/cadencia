import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { loadNativeTracks, serializeTracksToCsv, type Track } from '@core/tracks';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { FileDropzone } from '@ui/components/FileDropzone';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackPreviewButton } from '@ui/components/TrackPreviewButton';
import { SyncStatusBadge } from '@ui/components/sync/SyncStatusBadge';
import { downloadTextFile } from '@ui/utils/downloadFile';
import {
  getNativeCatalogPrefs,
  setNativeCatalogPrefs,
} from '@core/csvs/nativeCatalogPrefs';
import {
  createUploadedCsv,
  deleteUploadedCsv,
} from '@core/csvs/uploadedCsvs';
import { useCadenciaData } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';

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
type Tab = 'native' | 'mine';

function readInitialTab(): Tab {
  if (typeof window === 'undefined') return 'native';
  const params = new URLSearchParams(window.location.search);
  return params.get('tab') === 'mine' ? 'mine' : 'native';
}

export function CatalogEditorPage({ onClose }: CatalogEditorPageProps): JSX.Element {
  const allTracks = useMemo(() => loadNativeTracks(), []);
  const totalCount = allTracks.length;

  const [activeTab, setActiveTab] = useState<Tab>(() => readInitialTab());

  // Hidratar `included` desde la denylist persistida: incluido = NO esta
  // en excludedUris. Modelo runtime sigue siendo allowlist (mas ergonomico
  // para la UI: "marcada = me la quedo"), pero la fuente de verdad
  // persistente es denylist (mas compacta).
  const [included, setIncluded] = useState<ReadonlySet<string>>(() => {
    const persistedExcluded = new Set(getNativeCatalogPrefs()?.excludedUris ?? []);
    return new Set(
      allTracks.filter((t) => !persistedExcluded.has(t.uri)).map((t) => t.uri),
    );
  });
  // Estado UI del save: 'idle' por defecto, 'saving' durante el debounce,
  // 'saved' tras escribir al store. Auto-vuelve a 'idle' tras 1.5s.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Auto-save debounceado del estado included -> denylist persistente.
  // 300ms de espera para agrupar toggles rapidos en un solo push a Drive.
  // En el primer mount NO disparamos save (initialMount.current bloquea):
  // hidratar desde el store ya nos da el estado correcto, escribir igual
  // al store seria un no-op que ademas dispararia un push innecesario.
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    setSaveStatus('saving');
    const id = setTimeout(() => {
      const excludedUris = allTracks
        .filter((t) => !included.has(t.uri))
        .map((t) => t.uri);
      setNativeCatalogPrefs({ excludedUris });
      setSaveStatus('saved');
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
    }, 300);
    return () => clearTimeout(id);
  }, [included, allTracks]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
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
  const excludedCount = totalCount - includedCount;

  // Cuantos de los visibles estan marcados / desmarcados — alimenta
  // tanto el resumen del panel de acciones como la deteccion de "todo
  // desmarcado en la vista actual".
  const visibleIncludedCount = useMemo(() => {
    let n = 0;
    for (const t of filteredTracks) if (included.has(t.uri)) n += 1;
    return n;
  }, [filteredTracks, included]);
  const allVisibleUnchecked = visibleCount > 0 && visibleIncludedCount === 0;

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

  // Porcentaje incluido (0..100, redondeado) — alimenta la barrita
  // visual del header. Sin tracks, mostramos 0% en lugar de NaN.
  const includedPct =
    totalCount === 0 ? 0 : Math.round((includedCount / totalCount) * 100);

  return (
    <div className="min-h-full flex flex-col bg-gris-50">
      <header className="sticky top-0 z-30 border-b border-gris-200 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 md:py-4 space-y-3">
          {/* Fila 1: navegación + título + descarga. En móvil se pliega
              en tres líneas (volver, título, botón descargar full-width)
              para que ningún elemento se apriete. */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-center justify-between gap-3 md:flex-1 md:min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-sm text-turquesa-700 font-semibold rounded-md px-2 py-1 -mx-2 hover:text-turquesa-800 hover:bg-turquesa-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 min-h-[36px]"
              >
                <MaterialIcon name="arrow_back" size="small" />
                <span className="truncate">Volver a la música</span>
              </button>
              <span
                className="md:hidden inline-flex items-center gap-1 text-xs text-gris-500 tabular-nums shrink-0"
                aria-hidden="true"
              >
                <MaterialIcon name="library_music" size="small" className="text-gris-400" />
                {totalCount}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-display font-bold text-gris-900 truncate">
                Personalizar catálogo
              </h1>
              <p className="text-xs text-gris-500 truncate flex items-center gap-1.5">
                <SaveStatusIndicator status={saveStatus} />
              </p>
            </div>
            {activeTab === 'native' && (
              <Button
                variant="secondary"
                iconLeft="download"
                onClick={handleDownload}
                disabled={includedCount === 0}
                fullWidth
                className="md:w-auto"
              >
                Exportar CSV ({includedCount})
              </Button>
            )}
          </div>

          {/* Tabs: cataogo nativo (denylist persistente con autoguardado) */}
          {/* vs mis listas (uploadedCsvs persistentes). */}
          <div className="flex gap-1 border-b border-gris-200" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'native'}
              onClick={() => setActiveTab('native')}
              className={`px-4 py-2 text-sm min-h-[44px] transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'native'
                  ? 'border-b-2 border-turquesa-600 text-turquesa-700 font-semibold'
                  : 'text-gris-600 hover:text-gris-800'
              }`}
            >
              <MaterialIcon name="library_music" size="small" />
              Catálogo nativo · {includedCount}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mine'}
              onClick={() => setActiveTab('mine')}
              className={`px-4 py-2 text-sm min-h-[44px] transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'mine'
                  ? 'border-b-2 border-turquesa-600 text-turquesa-700 font-semibold'
                  : 'text-gris-600 hover:text-gris-800'
              }`}
            >
              <MaterialIcon name="upload_file" size="small" />
              Mis listas
            </button>
          </div>

          {/* Filas siguientes solo aplican al tab nativo (progreso y filtros) */}
          {activeTab === 'native' && (
            <>
              <AllowlistProgress
                includedCount={includedCount}
                excludedCount={excludedCount}
                totalCount={totalCount}
                includedPct={includedPct}
                visibleCount={visibleCount}
                filtersActive={filtersActive}
              />
              <FiltersPanel
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
                visibleCount={visibleCount}
                visibleIncludedCount={visibleIncludedCount}
                onMarkAllVisible={markAllVisible}
                onUnmarkAllVisible={unmarkAllVisible}
              />
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:py-6">
          {activeTab === 'native' ? (
            visibleCount === 0 ? (
              <EmptyState
                filtersActive={filtersActive}
                onClearFilters={clearFilters}
              />
            ) : (
              <>
                {allVisibleUnchecked && (
                  <AllVisibleUncheckedBanner onMarkAllVisible={markAllVisible} />
                )}
                <ul
                  className="space-y-1.5 md:space-y-1"
                  role="list"
                  aria-label={`${visibleCount} canciones`}
                >
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
              </>
            )
          ) : (
            <MyListsTab />
          )}
        </div>
      </main>
    </div>
  );
}

interface SaveStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
}

function SaveStatusIndicator({ status }: SaveStatusIndicatorProps): JSX.Element {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-tulipTree-700">
        <MaterialIcon name="sync" size="small" />
        <span>Guardando…</span>
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-turquesa-700">
        <MaterialIcon name="check_circle" size="small" />
        <span>Guardado</span>
        <SyncStatusBadge className="ml-1" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gris-500">
      <MaterialIcon name="cloud_done" size="small" />
      <span>Tus cambios se guardan automáticamente</span>
    </span>
  );
}

/**
 * Tab "Mis listas": gestion de uploadedCsvs persistentes en cadenciaStore.
 * Subir nuevo, ver listado, borrar (con confirm).
 */
function MyListsTab(): JSX.Element {
  const cadenciaData = useCadenciaData();
  const lists = useMemo(
    () => hydrateUploadedCsvs(cadenciaData.uploadedCsvs),
    [cadenciaData.uploadedCsvs],
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
    null,
  );

  const handleFile = async (file: File): Promise<void> => {
    setUploadError(null);
    try {
      const text = await file.text();
      // createUploadedCsv hace su propio parse para trackCount; aqui no
      // duplicamos validacion — si el csv es invalido, trackCount sera 0
      // y la card del listado lo mostrara.
      createUploadedCsv({ name: file.name, csvText: text });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  };

  const handleConfirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteUploadedCsv(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-gris-300 bg-white p-4">
        <h3 className="text-sm font-semibold text-gris-800 mb-2 flex items-center gap-1.5">
          <MaterialIcon name="upload_file" size="small" className="text-turquesa-600" />
          Subir nueva lista
        </h3>
        <FileDropzone
          accept=".csv,text/csv"
          acceptedLabel="CSV"
          onFile={(f) => void handleFile(f)}
          idlePrompt="Arrastra tu CSV de Spotify (Exportify) o pulsa para elegir"
        />
        {uploadError && (
          <p className="mt-2 text-xs text-rosa-700" role="alert">
            {uploadError}
          </p>
        )}
        <p className="mt-2 text-xs text-gris-500">
          ¿Cómo exportar tu lista?{' '}
          <a
            href="/ayuda/musica"
            className="text-turquesa-700 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/ayuda/musica';
            }}
          >
            Consulta la guía
          </a>
          .
        </p>
      </div>

      {lists.length === 0 ? (
        <div className="text-center text-gris-600 py-8 px-4 rounded-lg border border-dashed border-gris-300 bg-gris-50">
          <MaterialIcon name="library_music" size="large" className="text-gris-400 mb-2" />
          <p className="text-sm">No has subido ninguna lista todavía.</p>
          <p className="text-xs mt-2 text-gris-500">
            Sube un CSV de Spotify para tener canciones tuyas en futuras listas.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3" role="list">
          {lists.map((l) => (
            <li
              key={l.id}
              className="rounded-lg border-2 border-gris-200 bg-white p-3 hover:border-turquesa-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-display text-sm md:text-base text-gris-800 leading-tight truncate">
                  {l.name}
                </h4>
                <span className="text-[11px] text-gris-500 tabular-nums whitespace-nowrap">
                  {l.trackCount} {l.trackCount === 1 ? 'canción' : 'canciones'}
                </span>
              </div>
              {l.error !== undefined && (
                <p className="text-xs text-rosa-700 mb-1" role="alert">
                  {l.error}
                </p>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: l.id, name: l.name })}
                  aria-label={`Borrar lista ${l.name}`}
                  className="px-3 py-1.5 rounded-md border border-gris-300 text-gris-600 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 text-xs min-h-[36px] inline-flex items-center gap-1.5"
                >
                  <MaterialIcon name="delete_outline" size="small" />
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Borrar lista de música"
        icon="delete_outline"
        confirmLabel="Borrar"
        confirmVariant="critical"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        message={
          <>
            <p>
              <strong>"{pendingDelete?.name ?? ''}"</strong> se eliminará de tus
              listas y dejará de estar disponible en futuras sesiones.
            </p>
            <p className="mt-2 text-gris-600">
              Si tienes Drive conectado, el cambio se sincronizará a tus otros dispositivos.
            </p>
          </>
        }
      />
    </div>
  );
}

interface AllowlistProgressProps {
  includedCount: number;
  excludedCount: number;
  totalCount: number;
  includedPct: number;
  visibleCount: number;
  filtersActive: boolean;
}

/**
 * Barra horizontal compacta que reemplaza al contador-en-texto.
 * Comunica simultaneamente: total marcadas, % del catalogo, descartadas,
 * y (si hay filtros) cuantas estan visibles ahora mismo. El `aria-live`
 * "polite" se preserva para lectores de pantalla.
 */
function AllowlistProgress({
  includedCount,
  excludedCount,
  totalCount,
  includedPct,
  visibleCount,
  filtersActive,
}: AllowlistProgressProps): JSX.Element {
  return (
    <div
      className="flex flex-col gap-1.5"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="text-gris-700">
          <strong className="text-gris-900 text-sm">{includedCount}</strong>
          <span className="text-gris-500"> de {totalCount} marcadas</span>
          {excludedCount > 0 && (
            <span className="text-gris-500">
              {' · '}
              <span className="text-rosa-600">{excludedCount} descartadas</span>
            </span>
          )}
        </span>
        {filtersActive && (
          <span className="text-turquesa-700">
            <MaterialIcon
              name="filter_alt"
              size="small"
              className="align-text-bottom"
            />{' '}
            {visibleCount} visibles
          </span>
        )}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gris-100"
        role="progressbar"
        aria-valuenow={includedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${includedPct}% del catálogo marcado`}
      >
        <div
          className="h-full bg-turquesa-600 transition-[width] duration-200 ease-out"
          style={{ width: `${includedPct}%` }}
        />
      </div>
    </div>
  );
}

interface FiltersPanelProps {
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
  visibleCount: number;
  visibleIncludedCount: number;
  onMarkAllVisible: () => void;
  onUnmarkAllVisible: () => void;
}

/**
 * Panel plegable con el campo de busqueda siempre visible (el primer
 * filtro mas usado), y el resto (BPM, source, acciones masivas) detras
 * de un toggle EN MOVIL. En desktop (md+) el panel completo se muestra
 * siempre, sin toggle.
 *
 * Justificacion: en movil el header sticky se sentia pesado al acumular
 * busqueda + BPM + source + 2 botones masivos. Con la busqueda fuera,
 * el resto plegado, y el contador convertido en barra de progreso, el
 * header pasa de ~5 filas a 3 en movil sin perder potencia en desktop.
 *
 * Implementacion: state local controlado, no `<details>`, porque la
 * semantica responsive (cerrado en movil / abierto en desktop) no se
 * expresa bien con el atributo `open`. Render dual con clases Tailwind
 * `md:block` / `hidden`.
 */
function FiltersPanel({
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
  visibleCount,
  visibleIncludedCount,
  onMarkAllVisible,
  onUnmarkAllVisible,
}: FiltersPanelProps): JSX.Element {
  const [advancedOpenMobile, setAdvancedOpenMobile] = useState<boolean>(false);
  const advancedActive =
    selectedSources.size > 0 || bpmMin.trim() !== '' || bpmMax.trim() !== '';
  const advancedCount =
    (advancedActive ? 1 : 0) + (searchText.trim() !== '' ? 1 : 0);
  return (
    <div className="space-y-2">
      {/* Buscador siempre visible — es el filtro de mayor uso. */}
      <label className="flex flex-col gap-1">
        <span className="sr-only">Buscar canción, artista, álbum o género</span>
        <div className="relative">
          <MaterialIcon
            name="search"
            size="small"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gris-400 pointer-events-none"
          />
          <input
            type="search"
            value={searchText}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onSearchTextChange(e.target.value)
            }
            placeholder="Buscar canción, artista, álbum o género…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[40px]"
          />
          {searchText !== '' && (
            <button
              type="button"
              onClick={() => onSearchTextChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 text-gris-400 hover:text-rosa-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
            >
              <MaterialIcon name="close" size="small" />
            </button>
          )}
        </div>
      </label>

      {/* Toggle del panel avanzado: solo visible en móvil. En md+ el
          contenido se muestra siempre. */}
      <button
        type="button"
        onClick={() => setAdvancedOpenMobile((v) => !v)}
        aria-expanded={advancedOpenMobile}
        aria-controls="catalog-advanced-filters"
        className="md:hidden w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gris-200 bg-gris-50 text-sm font-semibold text-gris-700 min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
      >
        <span className="inline-flex items-center gap-1.5">
          <MaterialIcon name="tune" size="small" className="text-gris-500" />
          Más filtros y acciones
          {advancedCount > 0 && (
            <span className="ml-1 text-[10px] bg-turquesa-100 text-turquesa-800 rounded-full px-1.5 py-0.5 tabular-nums font-semibold">
              {advancedCount}
            </span>
          )}
        </span>
        <MaterialIcon
          name={advancedOpenMobile ? 'expand_less' : 'expand_more'}
          size="small"
          className="text-gris-500"
        />
      </button>

      <div
        id="catalog-advanced-filters"
        className={`${advancedOpenMobile ? 'block' : 'hidden'} md:block space-y-3`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="bpm-min"
              className="text-xs font-semibold text-gris-600"
            >
              BPM
            </label>
            <input
              id="bpm-min"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={bpmMin}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onBpmMinChange(e.target.value)
              }
              placeholder="min"
              aria-label="BPM mínimo"
              className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px] tabular-nums"
            />
            <span aria-hidden className="text-gris-400">
              –
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={bpmMax}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onBpmMaxChange(e.target.value)
              }
              placeholder="max"
              aria-label="BPM máximo"
              className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px] tabular-nums"
            />
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gris-600 rounded hover:text-rosa-600 hover:bg-rosa-100/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 min-h-[36px]"
            >
              <MaterialIcon name="filter_alt_off" size="small" />
              Limpiar filtros
            </button>
          )}
        </div>

        {allSources.length > 1 && (
          <SourceFilter
            allSources={allSources}
            selectedSources={selectedSources}
            onToggleSource={onToggleSource}
          />
        )}

        {/* Acciones masivas — viven AQUI dentro del panel para no
            competir con el botón principal "Descargar CSV". Mostrar
            cuántas se afectarán (de las visibles) elimina ambigüedad. */}
        {visibleCount > 0 && (
          <BulkActions
            visibleCount={visibleCount}
            visibleIncludedCount={visibleIncludedCount}
            onMarkAllVisible={onMarkAllVisible}
            onUnmarkAllVisible={onUnmarkAllVisible}
          />
        )}
      </div>
    </div>
  );
}

interface SourceFilterProps {
  allSources: readonly string[];
  selectedSources: ReadonlySet<string>;
  onToggleSource: (source: string) => void;
}

function SourceFilter({
  allSources,
  selectedSources,
  onToggleSource,
}: SourceFilterProps): JSX.Element {
  return (
    <details className="group/source">
      <summary className="cursor-pointer text-xs font-semibold text-gris-600 hover:text-turquesa-700 inline-flex items-center gap-1 select-none min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 rounded">
        <MaterialIcon
          name="filter_list"
          size="small"
          className="transition-transform group-open/source:rotate-180"
        />
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
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 ${
                active
                  ? 'bg-turquesa-600 border-turquesa-600 text-white'
                  : 'bg-white border-gris-300 text-gris-700 hover:border-turquesa-400 hover:text-turquesa-700'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </details>
  );
}

interface BulkActionsProps {
  visibleCount: number;
  visibleIncludedCount: number;
  onMarkAllVisible: () => void;
  onUnmarkAllVisible: () => void;
}

function BulkActions({
  visibleCount,
  visibleIncludedCount,
  onMarkAllVisible,
  onUnmarkAllVisible,
}: BulkActionsProps): JSX.Element {
  const visibleExcludedCount = visibleCount - visibleIncludedCount;
  const allMarked = visibleExcludedCount === 0;
  const allUnmarked = visibleIncludedCount === 0;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gris-200 md:border-t-0 md:pt-0">
      <span className="text-xs text-gris-500 mr-1">Sobre las visibles:</span>
      <button
        type="button"
        onClick={onMarkAllVisible}
        disabled={allMarked}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gris-300 bg-white text-xs font-semibold text-gris-700 hover:border-turquesa-400 hover:text-turquesa-700 hover:bg-turquesa-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gris-300 disabled:hover:text-gris-700 disabled:hover:bg-white min-h-[32px] tabular-nums"
      >
        <MaterialIcon name="done_all" size="small" />
        Marcar {visibleExcludedCount > 0 ? `+${visibleExcludedCount}` : 'todas'}
      </button>
      <button
        type="button"
        onClick={onUnmarkAllVisible}
        disabled={allUnmarked}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gris-300 bg-white text-xs font-semibold text-gris-700 hover:border-rosa-400 hover:text-rosa-600 hover:bg-rosa-100/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gris-300 disabled:hover:text-gris-700 disabled:hover:bg-white min-h-[32px] tabular-nums"
      >
        <MaterialIcon name="remove_done" size="small" />
        Desmarcar {visibleIncludedCount > 0 ? `−${visibleIncludedCount}` : 'todas'}
      </button>
    </div>
  );
}

interface EmptyStateProps {
  filtersActive: boolean;
  onClearFilters: () => void;
}

/**
 * Estado vacio expresivo: distingue "ningun filtro coincide" (caso
 * comun, accionable: limpiar filtros) de "catalogo vacio" (extremo,
 * solo si el bundle se rompe).
 */
function EmptyState({ filtersActive, onClearFilters }: EmptyStateProps): JSX.Element {
  if (filtersActive) {
    return (
      <div className="rounded-xl border border-gris-200 bg-white p-8 text-center">
        <MaterialIcon
          name="search_off"
          size="xlarge"
          className="text-gris-300"
        />
        <p className="mt-3 text-base font-semibold text-gris-800">
          Ningún tema cumple los filtros actuales
        </p>
        <p className="mt-1 text-sm text-gris-500">
          Ajusta los criterios o vuelve a empezar.
        </p>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            iconLeft="filter_alt_off"
            onClick={onClearFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gris-200 bg-white p-8 text-center">
      <MaterialIcon
        name="library_music"
        size="xlarge"
        className="text-gris-300"
      />
      <p className="mt-3 text-base font-semibold text-gris-800">
        El catálogo está vacío
      </p>
      <p className="mt-1 text-sm text-gris-500">
        No hay canciones embebidas que mostrar.
      </p>
    </div>
  );
}

interface AllVisibleUncheckedBannerProps {
  onMarkAllVisible: () => void;
}

/**
 * Aviso amable cuando el usuario ha desmarcado TODAS las filas visibles.
 * Caso confuso: la lista sigue ahi pero "no se descarga ninguna de
 * estas". Le damos un atajo para revertir.
 */
function AllVisibleUncheckedBanner({
  onMarkAllVisible,
}: AllVisibleUncheckedBannerProps): JSX.Element {
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-3 rounded-lg border border-tulipTree-300 bg-tulipTree-50 px-3 py-2.5"
    >
      <MaterialIcon
        name="info"
        size="small"
        className="text-tulipTree-600 flex-shrink-0"
      />
      <p className="flex-1 text-xs text-gris-700">
        Has desmarcado todas las visibles. No se descargarán en el CSV.
      </p>
      <button
        type="button"
        onClick={onMarkAllVisible}
        className="text-xs font-semibold text-turquesa-700 hover:text-turquesa-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 rounded px-1 min-h-[32px]"
      >
        Revertir
      </button>
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  checked: boolean;
  onToggle: () => void;
}

/**
 * Fila de track más densa y escaneable que la versión anterior:
 * - El checkbox a la izquierda con área tap clara y borde visible
 *   refuerza la affordance del modelo allowlist.
 * - Filas desmarcadas: tachado en nombre + opacidad + pastilla "fuera"
 *   junto al BPM. Triple señal visual (no solo color) para WCAG.
 * - Géneros se truncan con overflow-hidden + flex-nowrap para que no
 *   rompan layout en móvil; en hover la fila se eleva sutilmente.
 */
function TrackRow({ track, checked, onToggle }: TrackRowProps): JSX.Element {
  const checkboxId = useId();
  const visibleGenres = track.genres.slice(0, 3);
  const extraGenres = track.genres.length - visibleGenres.length;

  const containerClasses = checked
    ? 'bg-white border-gris-200 hover:border-turquesa-300 hover:shadow-sm'
    : 'bg-gris-50 border-gris-200 opacity-75 hover:opacity-100 hover:border-gris-300';

  const titleClasses = checked
    ? 'text-gris-800'
    : 'text-gris-500 line-through decoration-rosa-400 decoration-1';

  return (
    <div
      className={`flex items-center gap-3 p-2.5 md:p-3 rounded-lg border transition-all duration-200 ease-out ${containerClasses}`}
    >
      <label
        htmlFor={checkboxId}
        className="inline-flex items-center justify-center w-11 h-11 -m-1 cursor-pointer flex-shrink-0 rounded-md hover:bg-turquesa-50 transition-colors"
        title={checked ? 'Excluir del CSV' : 'Incluir en el CSV'}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-5 h-5 accent-turquesa-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 rounded"
          aria-label={`${checked ? 'Excluir' : 'Incluir'} ${track.name}`}
        />
      </label>

      <TrackPreviewButton uri={track.uri} />

      <label
        htmlFor={checkboxId}
        className="flex-1 min-w-0 cursor-pointer py-0.5"
      >
        <p
          className={`text-sm font-semibold truncate transition-colors ${titleClasses}`}
        >
          {track.name}
        </p>
        <p className="text-xs text-gris-600 truncate">
          {track.artists.join(', ')}
          {track.album !== '' && (
            <span className="text-gris-400"> · {track.album}</span>
          )}
        </p>
        {visibleGenres.length > 0 && (
          <div className="flex flex-nowrap gap-1 mt-1 overflow-hidden">
            {visibleGenres.map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gris-100 text-gris-600 truncate max-w-[100px]"
                title={g}
              >
                {g}
              </span>
            ))}
            {extraGenres > 0 && (
              <span className="text-[10px] text-gris-500 self-center whitespace-nowrap">
                +{extraGenres}
              </span>
            )}
          </div>
        )}
      </label>

      <label
        htmlFor={checkboxId}
        className="text-xs tabular-nums flex flex-col items-end flex-shrink-0 cursor-pointer gap-0.5"
      >
        <span
          className={`px-2 py-0.5 rounded-md font-semibold ${
            checked
              ? 'bg-turquesa-50 text-turquesa-800'
              : 'bg-gris-100 text-gris-500'
          }`}
        >
          {Math.round(track.tempoBpm)}
          <span className="text-[10px] font-normal opacity-70"> BPM</span>
        </span>
        {!checked && (
          <span className="text-[10px] text-rosa-600 font-semibold inline-flex items-center gap-0.5">
            <MaterialIcon name="block" size="small" className="text-rosa-500" />
            fuera
          </span>
        )}
        {checked && track.source !== '' && (
          <span
            className="text-[10px] text-gris-400 max-w-[140px] truncate"
            title={track.source}
          >
            {track.source}
          </span>
        )}
      </label>
    </div>
  );
}
