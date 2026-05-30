import { useMemo, useState, type ChangeEvent } from 'react';
import { useCadenciaData } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';
import {
  createUploadedCsv,
  deleteUploadedCsv,
  removeTrackFromUploadedCsv,
  updateUploadedCsv,
} from '@core/csvs/uploadedCsvs';
import { annotateDuplicates, sortByTitleThenArtist, type Track } from '@core/tracks';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { FileDropzone } from '@ui/components/FileDropzone';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { UploadedTrackRow } from './UploadedTrackRow';
import { DuplicatesToggle } from './DuplicatesToggle';

/** Valor centinela del selector para la vista combinada de todas las listas. */
const ALL_LISTS = '__all__';

/** Una fila de la vista: un track con su lista y posición de origen. `rowId` es
 *  estable (incluye el índice dentro de su lista) para servir de `key` aunque
 *  la misma URI aparezca en varias listas. `indexInList` permite quitar esa
 *  copia concreta del CSV de su lista. */
interface ViewItem {
  rowId: string;
  track: Track;
  listId: string;
  listName: string;
  indexInList: number;
}

interface LastRemoval {
  listId: string;
  listName: string;
  name: string;
  /** csvText previo de la lista, para deshacer restaurándolo. */
  prevCsvText: string;
}

// Normaliza para búsqueda diacritic-insensitive ("Café" matchea "cafe").
// Mismo criterio que el buscador de alternativas en `PlaylistTrackRow`.
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Pestaña «Mis listas»: editor de las listas CSV propias del usuario.
 *
 * Selector arriba para elegir lista, o «Todas las listas» para ver todas
 * fusionadas (con su lista de origen) y localizar duplicados entre ellas.
 * Buscador, filtro de BPM, toggle «solo duplicados» y orden por título+artista
 * dejan contiguas las versiones de un mismo tema.
 *
 * La acción por canción es **quitar esa copia de su lista** (reescribe el CSV
 * de esa lista concreta), no un descarte global por URI: así, si la canción
 * está repetida o en varias listas, las demás copias se conservan y se puede
 * deduplicar dejando al menos una. Cada quitado es reversible al instante con
 * «Deshacer». El descarte global («no la quiero en ninguna lista») vive en el
 * paso «A pedalear» y en el catálogo nativo, no aquí.
 */
export function MyListsTab(): JSX.Element {
  const cadenciaData = useCadenciaData();
  const lists = useMemo(
    () => hydrateUploadedCsvs(cadenciaData.uploadedCsvs),
    [cadenciaData.uploadedCsvs],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [bpmMin, setBpmMin] = useState<string>('');
  const [bpmMax, setBpmMax] = useState<string>('');
  const [onlyDuplicates, setOnlyDuplicates] = useState<boolean>(false);
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [lastRemoval, setLastRemoval] = useState<LastRemoval | null>(null);

  const isAllMode = selectedId === ALL_LISTS;

  // Lista activa (modo «una lista»): la seleccionada o, si esa ya no existe
  // (p. ej. tras borrar), la primera disponible. Null en modo «todas» o si no
  // hay ninguna lista.
  const activeList = useMemo(
    () => (isAllMode ? null : lists.find((l) => l.id === selectedId) ?? lists[0] ?? null),
    [isAllMode, lists, selectedId],
  );

  // Conjunto de la vista actual: todas las listas fusionadas (con su origen y
  // posición) o solo la lista activa.
  const viewItems = useMemo<ViewItem[]>(() => {
    const source = isAllMode ? lists : activeList ? [activeList] : [];
    const items: ViewItem[] = [];
    for (const list of source) {
      list.tracks.forEach((track, i) => {
        items.push({
          rowId: `${list.id}#${track.uri}#${i}`,
          track,
          listId: list.id,
          listName: list.name,
          indexInList: i,
        });
      });
    }
    return items;
  }, [isAllMode, lists, activeList]);

  // Anotación de duplicados sobre el conjunto de la vista (todas o una lista).
  const annotated = useMemo(
    () => annotateDuplicates(viewItems, (w) => w.track),
    [viewItems],
  );
  const duplicatesCount = useMemo(
    () => annotated.reduce((n, a) => (a.groupSize >= 2 ? n + 1 : n), 0),
    [annotated],
  );

  // Filas visibles tras buscador + BPM + «solo duplicados», ordenadas por
  // título → artista (siempre): deja contiguas las versiones de un mismo tema.
  const filteredAnnotated = useMemo(() => {
    const q = normalizeForSearch(searchText.trim());
    const minN = bpmMin.trim() === '' ? null : Number(bpmMin);
    const maxN = bpmMax.trim() === '' ? null : Number(bpmMax);
    const passed = annotated.filter((a) => {
      const t = a.item.track;
      if (q !== '') {
        const haystack = normalizeForSearch(
          `${t.name} ${t.artists.join(' ')} ${t.album} ${t.genres.join(' ')}`,
        );
        if (!haystack.includes(q)) return false;
      }
      if (minN !== null && Number.isFinite(minN) && t.tempoBpm < minN) return false;
      if (maxN !== null && Number.isFinite(maxN) && t.tempoBpm > maxN) return false;
      if (onlyDuplicates && a.groupSize < 2) return false;
      return true;
    });
    return sortByTitleThenArtist(
      passed,
      (a) => a.item.track.name,
      (a) => a.item.track.artists,
    );
  }, [annotated, searchText, bpmMin, bpmMax, onlyDuplicates]);

  const handleFile = async (file: File): Promise<void> => {
    setUploadError(null);
    try {
      const text = await file.text();
      const record = createUploadedCsv({ name: file.name, csvText: text });
      setSelectedId(record.id); // saltar a la lista recién subida
      setShowUpload(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  };

  const handleConfirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteUploadedCsv(pendingDelete.id);
    setPendingDelete(null);
  };

  // Quita ESA copia de SU lista (reescribe su CSV). Conserva las demás copias.
  const handleRemoveFromList = (item: ViewItem): void => {
    const res = removeTrackFromUploadedCsv(item.listId, item.indexInList);
    if (res !== null) {
      setLastRemoval({
        listId: item.listId,
        listName: item.listName,
        name: res.removedName,
        prevCsvText: res.prevCsvText,
      });
    }
  };

  const handleUndoRemoval = (): void => {
    if (lastRemoval === null) return;
    updateUploadedCsv(lastRemoval.listId, { csvText: lastRemoval.prevCsvText });
    setLastRemoval(null);
  };

  const clearFilters = (): void => {
    setSearchText('');
    setBpmMin('');
    setBpmMax('');
    setOnlyDuplicates(false);
  };

  const filtersActive =
    searchText.trim() !== '' ||
    bpmMin.trim() !== '' ||
    bpmMax.trim() !== '' ||
    onlyDuplicates;

  // ── Estado vacío: sin ninguna lista ──────────────────────────────────────
  if (lists.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-2">
          <MaterialIcon name="library_music" size="large" className="text-gris-400" />
          <p className="mt-2 text-sm font-semibold text-gris-800">
            Todavía no has subido ninguna lista
          </p>
          <p className="text-xs text-gris-500 mt-1">
            Sube un CSV de Spotify para tener canciones tuyas en tus sesiones.
          </p>
        </div>
        <UploadPanel onFile={(f) => void handleFile(f)} error={uploadError} />
      </div>
    );
  }

  const hasError = activeList?.error !== undefined;

  return (
    <div className="space-y-3">
      {/* Selector de lista + borrar + subir nueva */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[12rem]">
          <span className="sr-only">Elegir lista</span>
          <div className="relative">
            <MaterialIcon
              name="queue_music"
              size="small"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gris-400 pointer-events-none"
            />
            <select
              value={isAllMode ? ALL_LISTS : activeList?.id ?? ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm font-semibold rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[44px] appearance-none cursor-pointer"
            >
              {lists.length > 1 && (
                <option value={ALL_LISTS}>
                  Todas las listas ({lists.reduce((n, l) => n + l.trackCount, 0)})
                </option>
              )}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.trackCount})
                </option>
              ))}
            </select>
            <MaterialIcon
              name="expand_more"
              size="small"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gris-500 pointer-events-none"
            />
          </div>
        </label>
        <button
          type="button"
          disabled={isAllMode || !activeList}
          onClick={() =>
            activeList && setPendingDelete({ id: activeList.id, name: activeList.name })
          }
          aria-label={activeList ? `Borrar lista «${activeList.name}»` : 'Borrar lista'}
          title={isAllMode ? 'Elige una lista concreta para borrarla' : 'Borrar esta lista'}
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-gris-300 text-gris-500 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gris-300 disabled:hover:text-gris-500"
        >
          <MaterialIcon name="delete_outline" size="small" />
        </button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft="add"
          onClick={() => setShowUpload((v) => !v)}
          aria-expanded={showUpload}
          className="shrink-0"
        >
          Subir nueva lista
        </Button>
      </div>

      {/* Resumen de la vista (lista activa o todas) */}
      {(activeList !== null || isAllMode) && (
        <p className="text-xs text-gris-600 tabular-nums" aria-live="polite">
          <strong className="text-gris-800">{viewItems.length}</strong>{' '}
          {viewItems.length === 1 ? 'canción' : 'canciones'}
          {isAllMode && <span className="text-gris-500"> en {lists.length} listas</span>}
          {duplicatesCount > 0 && (
            <span className="text-tulipTree-700">
              {' · '}
              {duplicatesCount} con versiones
            </span>
          )}
        </p>
      )}

      {/* Aviso de deshacer tras quitar una canción */}
      {lastRemoval !== null && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-turquesa-200 bg-turquesa-50 px-3 py-2"
        >
          <MaterialIcon
            name="playlist_remove"
            size="small"
            className="text-turquesa-700 flex-shrink-0"
          />
          <p className="flex-1 text-xs text-gris-700 truncate">
            Quitada <strong>«{lastRemoval.name}»</strong> de «{lastRemoval.listName}».
          </p>
          <button
            type="button"
            onClick={handleUndoRemoval}
            className="text-xs font-semibold text-turquesa-700 hover:text-turquesa-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 rounded px-1 min-h-[32px] inline-flex items-center gap-1 whitespace-nowrap"
          >
            <MaterialIcon name="undo" size="small" />
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => setLastRemoval(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 text-gris-400 hover:text-gris-600 rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
          >
            <MaterialIcon name="close" size="small" />
          </button>
        </div>
      )}

      {showUpload && <UploadPanel onFile={(f) => void handleFile(f)} error={uploadError} />}

      {hasError ? (
        <p className="text-sm text-rosa-700 rounded-lg border border-rosa-200 bg-rosa-50 p-3" role="alert">
          {activeList?.error}
        </p>
      ) : (
        <>
          {/* Buscador */}
          <label className="block">
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                placeholder="Buscar canción, artista, álbum o género…"
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[40px]"
              />
              {searchText !== '' && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 text-gris-400 hover:text-rosa-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
                >
                  <MaterialIcon name="close" size="small" />
                </button>
              )}
            </div>
          </label>

          {/* Filtro de BPM + solo duplicados + limpiar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gris-600">BPM</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={bpmMin}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBpmMin(e.target.value)}
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBpmMax(e.target.value)}
                placeholder="max"
                aria-label="BPM máximo"
                className="w-16 px-2 py-1.5 text-sm rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px] tabular-nums"
              />
            </div>
            {duplicatesCount > 0 && (
              <DuplicatesToggle
                active={onlyDuplicates}
                count={duplicatesCount}
                onToggle={() => setOnlyDuplicates((v) => !v)}
              />
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gris-600 rounded hover:text-rosa-600 hover:bg-rosa-100/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 min-h-[36px]"
              >
                <MaterialIcon name="filter_alt_off" size="small" />
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Filas */}
          {filteredAnnotated.length === 0 ? (
            <p className="text-sm text-gris-600 text-center py-6 rounded-lg border border-dashed border-gris-300 bg-gris-50">
              {filtersActive
                ? 'Ningún tema cumple los filtros actuales.'
                : isAllMode
                  ? 'No hay canciones en tus listas.'
                  : 'Esta lista no tiene canciones.'}
            </p>
          ) : (
            <ul
              className="space-y-1.5"
              role="list"
              aria-label={`${filteredAnnotated.length} canciones`}
            >
              {filteredAnnotated.map((a) => (
                <li key={a.item.rowId}>
                  <UploadedTrackRow
                    track={a.item.track}
                    duplicateCount={a.groupSize}
                    listName={isAllMode ? a.item.listName : ''}
                    onRemove={() => handleRemoveFromList(a.item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
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
              <strong>«{pendingDelete?.name ?? ''}»</strong> se eliminará de tus listas y
              dejará de estar disponible en futuras sesiones.
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

interface UploadPanelProps {
  onFile: (file: File) => void;
  error: string | null;
}

/**
 * Bloque de subida de un nuevo CSV. Reutilizado por el estado vacío (sin
 * listas) y por el botón «Subir nueva lista».
 */
function UploadPanel({ onFile, error }: UploadPanelProps): JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-gris-300 bg-white p-4">
      <FileDropzone
        accept=".csv,text/csv"
        acceptedLabel="CSV"
        onFile={onFile}
        idlePrompt="Arrastra tu CSV de Spotify (Exportify) o pulsa para elegir"
      />
      {error !== null && (
        <p className="mt-2 text-xs text-rosa-700" role="alert">
          {error}
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
  );
}
