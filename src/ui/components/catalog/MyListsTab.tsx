import { useMemo, useState, type ChangeEvent } from 'react';
import { useCadenciaData } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';
import { createUploadedCsv, deleteUploadedCsv } from '@core/csvs/uploadedCsvs';
import {
  addDismissedUri,
  removeDismissedUri,
  addDismissedUris,
  removeDismissedUris,
} from '@core/csvs/dismissed';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { FileDropzone } from '@ui/components/FileDropzone';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { UploadedTrackRow } from './UploadedTrackRow';

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
 * Misma ergonomía que el editor del catálogo nativo (buscador, filtro de BPM,
 * acciones masivas, filas con descarte por canción) pero con un **selector**
 * arriba para elegir qué lista se edita, en vez de mostrar todo el catálogo.
 *
 * El descarte es global (`dismissedTrackUris`): el `livePool` del wizard ya
 * filtra esas URIs, también en el modo «solo mis listas». No hay allowlist
 * (a diferencia del nativo): aquí la única acción por tema es descartar o
 * recuperar.
 */
export function MyListsTab(): JSX.Element {
  const cadenciaData = useCadenciaData();
  const lists = useMemo(
    () => hydrateUploadedCsvs(cadenciaData.uploadedCsvs),
    [cadenciaData.uploadedCsvs],
  );
  // Set global de descartes — alimenta el estado de cada fila. Reactivo via
  // useCadenciaData: add/remove disparan re-render sin estado local propio.
  const dismissedSet = useMemo(
    () => new Set(cadenciaData.dismissedTrackUris),
    [cadenciaData.dismissedTrackUris],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [bpmMin, setBpmMin] = useState<string>('');
  const [bpmMax, setBpmMax] = useState<string>('');
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
    null,
  );

  // Lista activa: la seleccionada o, si esa ya no existe (p. ej. tras borrar),
  // la primera disponible. Null solo cuando no hay ninguna lista.
  const activeList = useMemo(
    () => lists.find((l) => l.id === selectedId) ?? lists[0] ?? null,
    [lists, selectedId],
  );

  const dismissedInList = useMemo(
    () => (activeList?.tracks ?? []).reduce((n, t) => (dismissedSet.has(t.uri) ? n + 1 : n), 0),
    [activeList, dismissedSet],
  );

  // Filas visibles tras buscador + rango de BPM. No mutan la lista: filtran
  // el render, igual que el editor nativo.
  const filteredTracks = useMemo(() => {
    const src = activeList?.tracks ?? [];
    const q = normalizeForSearch(searchText.trim());
    const minN = bpmMin.trim() === '' ? null : Number(bpmMin);
    const maxN = bpmMax.trim() === '' ? null : Number(bpmMax);
    return src.filter((t) => {
      if (q !== '') {
        const haystack = normalizeForSearch(
          `${t.name} ${t.artists.join(' ')} ${t.album} ${t.genres.join(' ')}`,
        );
        if (!haystack.includes(q)) return false;
      }
      if (minN !== null && Number.isFinite(minN) && t.tempoBpm < minN) return false;
      if (maxN !== null && Number.isFinite(maxN) && t.tempoBpm > maxN) return false;
      return true;
    });
  }, [activeList, searchText, bpmMin, bpmMax]);

  const visibleActive = filteredTracks.filter((t) => !dismissedSet.has(t.uri)).length;
  const visibleDismissed = filteredTracks.length - visibleActive;

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

  const handleToggleDismiss = (uri: string, nextDismissed: boolean): void => {
    if (nextDismissed) addDismissedUri(uri);
    else removeDismissedUri(uri);
  };

  const handleDismissVisible = (): void => {
    const uris = filteredTracks.filter((t) => !dismissedSet.has(t.uri)).map((t) => t.uri);
    if (uris.length > 0) addDismissedUris(uris);
  };

  const handleRecoverVisible = (): void => {
    const uris = filteredTracks.filter((t) => dismissedSet.has(t.uri)).map((t) => t.uri);
    if (uris.length > 0) removeDismissedUris(uris);
  };

  const clearFilters = (): void => {
    setSearchText('');
    setBpmMin('');
    setBpmMax('');
  };

  const filtersActive =
    searchText.trim() !== '' || bpmMin.trim() !== '' || bpmMax.trim() !== '';

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
              value={activeList?.id ?? ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm font-semibold rounded-lg border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[44px] appearance-none cursor-pointer"
            >
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
          onClick={() =>
            activeList && setPendingDelete({ id: activeList.id, name: activeList.name })
          }
          aria-label={activeList ? `Borrar lista «${activeList.name}»` : 'Borrar lista'}
          title="Borrar esta lista"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-gris-300 text-gris-500 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400"
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

      {/* Resumen de la lista activa */}
      {activeList && (
        <p className="text-xs text-gris-600 tabular-nums" aria-live="polite">
          <strong className="text-gris-800">{activeList.trackCount}</strong>{' '}
          {activeList.trackCount === 1 ? 'canción' : 'canciones'}
          {dismissedInList > 0 && (
            <span className="text-rosa-600">
              {' · '}
              {dismissedInList} {dismissedInList === 1 ? 'descartada' : 'descartadas'}
            </span>
          )}
        </p>
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

          {/* Filtro de BPM + limpiar */}
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

          {/* Acciones masivas sobre las visibles */}
          {filteredTracks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-gris-500 mr-1">Sobre las visibles:</span>
              <button
                type="button"
                onClick={handleDismissVisible}
                disabled={visibleActive === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gris-300 bg-white text-xs font-semibold text-gris-700 hover:border-rosa-400 hover:text-rosa-600 hover:bg-rosa-100/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gris-300 disabled:hover:text-gris-700 disabled:hover:bg-white min-h-[32px] tabular-nums"
              >
                <MaterialIcon name="do_not_disturb_on" size="small" />
                Descartar todas {visibleActive > 0 ? `(${visibleActive})` : ''}
              </button>
              <button
                type="button"
                onClick={handleRecoverVisible}
                disabled={visibleDismissed === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gris-300 bg-white text-xs font-semibold text-gris-700 hover:border-turquesa-400 hover:text-turquesa-700 hover:bg-turquesa-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gris-300 disabled:hover:text-gris-700 disabled:hover:bg-white min-h-[32px] tabular-nums"
              >
                <MaterialIcon name="undo" size="small" />
                Recuperar todas {visibleDismissed > 0 ? `(${visibleDismissed})` : ''}
              </button>
            </div>
          )}

          {/* Filas */}
          {filteredTracks.length === 0 ? (
            <p className="text-sm text-gris-600 text-center py-6 rounded-lg border border-dashed border-gris-300 bg-gris-50">
              {filtersActive
                ? 'Ningún tema cumple los filtros actuales.'
                : 'Esta lista no tiene canciones.'}
            </p>
          ) : (
            <ul className="space-y-1.5" role="list" aria-label={`${filteredTracks.length} canciones`}>
              {filteredTracks.map((t) => {
                const dismissed = dismissedSet.has(t.uri);
                return (
                  <li key={t.uri}>
                    <UploadedTrackRow
                      track={t}
                      dismissed={dismissed}
                      onToggleDismiss={() => handleToggleDismiss(t.uri, !dismissed)}
                    />
                  </li>
                );
              })}
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
