import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AlternativeCandidate, MatchedSegment } from '@core/matching';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';
import { SlopePill } from './SlopePill';
import { TrackPreviewButton } from './TrackPreviewButton';
import { ZoneBadge } from './ZoneBadge';

export interface PlaylistTrackRowProps {
  matched: MatchedSegment;
  index: number;
  /**
   * Alternativas validas para este slot (excluyendo todas las URIs ya en la
   * playlist y la propia del segmento). Vacio o ausente -> boton deshabilitado.
   */
  alternatives?: readonly AlternativeCandidate[];
  /** Llamado al elegir un track del dropdown. */
  onReplaceWith?: (uri: string) => void;
  /** Marca visual: el usuario sustituyo este tema manualmente. */
  replaced?: boolean;
  /**
   * Callback opcional para enviar al usuario al paso «Música» y subir más
   * temas. Se renderiza como CTA dentro del null state (sin tema disponible).
   */
  onGoToMusicStep?: () => void;
  /**
   * Pinta la pendiente media del segmento al lado del ZoneBadge. Solo activar
   * en modo GPX; en sesión indoor los datos de elevación son 0.
   */
  showSlope?: boolean;
  /**
   * Callback opcional para descartar globalmente la cancion actual. Si se
   * proporciona, se renderiza un boton "X" junto a "Otro tema". El padre
   * decide la UX (modal de confirmacion + sustitucion automatica del slot).
   */
  onDismiss?: (uri: string, name: string) => void;
}

const QUALITY_LABEL: Record<MatchedSegment['matchQuality'], string | null> = {
  strict: null,
  'best-effort': 'Encaje libre',
  repeated: 'Repetida',
  insufficient: 'Sin canción libre',
};

/**
 * Fila de la lista final en la pantalla Resultado. Variante de TrackCard
 * con boton "Otro tema" siempre visible (no hover-only para mobile) que
 * abre un dropdown con TODAS las alternativas validas no repetidas.
 */
export function PlaylistTrackRow({
  matched,
  index,
  alternatives,
  onReplaceWith,
  replaced = false,
  onGoToMusicStep,
  showSlope = false,
  onDismiss,
}: PlaylistTrackRowProps): JSX.Element {
  const { track, zone, matchQuality } = matched;
  const qualityLabel = QUALITY_LABEL[matchQuality];

  if (track === null) {
    return (
      <article className="flex items-center gap-3 rounded-lg border border-tulipTree-300 bg-tulipTree-50 p-3">
        <PlaceholderCover zone={zone} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gris-800 flex items-center gap-1.5">
            <MaterialIcon name="warning" size="small" className="text-tulipTree-600" />
            Sin tema disponible para esta zona
          </p>
          {onGoToMusicStep !== undefined && (
            <button
              type="button"
              onClick={onGoToMusicStep}
              className="mt-1 text-xs font-semibold text-turquesa-700 hover:underline inline-flex items-center gap-1 min-h-[36px]"
            >
              <MaterialIcon name="library_music" size="small" />
              Subir más temas
            </button>
          )}
        </div>
        <ZoneBadge zone={zone} size="sm" />
      </article>
    );
  }

  const showPicker = onReplaceWith !== undefined;

  return (
    <article className="rounded-lg border border-gris-200 bg-white p-3 hover:border-turquesa-300 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <PlaceholderCover zone={zone} />
        <TrackPreviewButton uri={track.uri} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-gris-400 tabular-nums shrink-0">
              {index}.
            </span>
            <p className="text-sm font-semibold text-gris-800 truncate">{track.name}</p>
            {replaced && (
              <span
                title="Sustituido manualmente"
                className="text-xs text-turquesa-700 shrink-0 inline-flex items-center gap-0.5"
              >
                <MaterialIcon name="edit" size="small" className="text-turquesa-600" />
              </span>
            )}
          </div>
          <p className="text-xs text-gris-500 truncate">{track.artists.join(', ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            {showSlope && <SlopePill segment={matched} />}
            <ZoneBadge zone={zone} size="sm" />
          </div>
          <span className="text-xs text-gris-500 tabular-nums">
            {Math.round(track.tempoBpm)} bpm
          </span>
        </div>
      </div>
      {showPicker && (
        <div className="mt-2 pt-2 border-t border-gris-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <AlternativesPicker
              alternatives={alternatives ?? []}
              onSelect={onReplaceWith}
              rowIndex={index}
            />
            <RandomPickButton
              alternatives={alternatives ?? []}
              onSelect={onReplaceWith}
              rowIndex={index}
            />
            {onDismiss !== undefined && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft="block"
                onClick={() => onDismiss(track.uri, track.name)}
                aria-label={`Descartar definitivamente ${track.name}`}
                title="No la quiero en futuras playlists"
                className="!text-rosa-600 hover:!bg-rosa-50 hover:!border-rosa-300"
              >
                <span className="hidden sm:inline">No la quiero</span>
              </Button>
            )}
          </div>
          {qualityLabel && (
            <span
              className="text-xs text-tulipTree-600 flex items-center gap-1"
              title="No habia un tema exacto para esta zona en tu catalogo"
            >
              <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
              {qualityLabel}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

interface RandomPickButtonProps {
  alternatives: readonly AlternativeCandidate[];
  onSelect: (uri: string) => void;
  rowIndex: number;
}

/**
 * Sustituye el track actual por una alternativa elegida al azar entre las
 * disponibles para este slot. Aleatoriedad iniciada por el usuario (click
 * explicito), no por el motor — el matching del nucleo sigue siendo
 * determinista.
 */
function RandomPickButton({
  alternatives,
  onSelect,
  rowIndex,
}: RandomPickButtonProps): JSX.Element {
  const isEmpty = alternatives.length === 0;
  const handleClick = (): void => {
    if (isEmpty) return;
    const idx = Math.floor(Math.random() * alternatives.length);
    const pick = alternatives[idx];
    if (pick) onSelect(pick.track.uri);
  };
  return (
    <Button
      variant="secondary"
      size="sm"
      iconLeft="shuffle"
      onClick={handleClick}
      disabled={isEmpty}
      aria-label={`Elegir un tema al azar para el tramo ${rowIndex}`}
      title="Sustituir por un tema aleatorio de las alternativas"
    >
      <span className="hidden sm:inline">Aleatorio</span>
    </Button>
  );
}

interface AlternativesPickerProps {
  alternatives: readonly AlternativeCandidate[];
  onSelect: (uri: string) => void;
  rowIndex: number;
}

interface PopoverPosition {
  top: number;
  left: number;
}

// Normaliza para búsqueda diacritic-insensitive: "Avíccii" matchea "avicii",
// "café" matchea "cafe". El público hispanohablante teclea con/sin tildes
// indistintamente.
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function AlternativesPicker({
  alternatives,
  onSelect,
  rowIndex,
}: AlternativesPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const isEmpty = alternatives.length === 0;

  // Filtrado client-side por nombre o artistas. Mantiene el orden original
  // por score (es solo `Array.filter`), por lo que las "mejores" alternativas
  // siguen apareciendo arriba aunque el usuario escriba.
  const filtered = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed === '') return alternatives;
    const needle = normalizeForSearch(trimmed);
    return alternatives.filter((alt) => {
      if (normalizeForSearch(alt.track.name).includes(needle)) return true;
      if (normalizeForSearch(alt.track.artists.join(' ')).includes(needle)) return true;
      return false;
    });
  }, [alternatives, query]);

  // Calcula y mantiene la posicion del popover anclada al boton. El popover
  // vive en un portal a document.body para no ser recortado por ancestros
  // con overflow:auto (la lista del Resultado tiene md:overflow-y-auto).
  // En mobile (<640px) lo centramos horizontalmente con un margen lateral
  // de 16px para que no se salga del viewport.
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function update(): void {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 16;
      const popoverWidth = Math.min(448, viewportWidth - margin * 2);
      // Si el ancho disponible no llega para que el popover quepa anclado al
      // anchor sin rebasar el viewport, lo centramos horizontalmente.
      let left = rect.left;
      if (left + popoverWidth + margin > viewportWidth) {
        left = Math.max(margin, viewportWidth - popoverWidth - margin);
      }
      setPosition({
        top: rect.bottom + 4,
        left,
      });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Reset del filtro al cerrar: si el usuario reabre el dropdown vuelve al
  // ranking original sin tener que limpiar el campo a mano. El autofocus se
  // hace en el siguiente tick para que React haya renderizado el input antes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handle = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(handle);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (uri: string): void => {
    setOpen(false);
    onSelect(uri);
  };

  // El dropdown opera en modo "fallback" cuando no hay tracks con cadencia
  // ideal libres y se ofrecen otros del catalogo. Detectado por la ausencia
  // total de items strict — si los hubiera, el motor los devolveria solos.
  const isFallback = alternatives.length > 0 && alternatives.every((a) => !a.passesCadence);

  const popover =
    open && position
      ? createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            aria-label={`Alternativas para el tramo ${rowIndex}`}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
            }}
            className="z-50 w-[28rem] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto rounded-lg border border-gris-200 bg-white shadow-lg ring-1 ring-black/5"
          >
            {isEmpty ? (
              <div className="px-3 py-3 flex items-start gap-2">
                <MaterialIcon
                  name="info"
                  size="small"
                  className="text-tulipTree-500 mt-0.5 shrink-0"
                />
                <p className="text-xs text-gris-700">
                  No quedan más temas libres en tu catálogo para esta zona. Sube
                  más listas en el paso «Música» para tener variedad.
                </p>
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 bg-white border-b border-gris-100 px-2 py-2">
                  <label className="block">
                    <span className="sr-only">Buscar por título o artista</span>
                    <div className="relative">
                      <MaterialIcon
                        name="search"
                        size="small"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-400 pointer-events-none"
                      />
                      <input
                        ref={searchInputRef}
                        type="search"
                        value={query}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setQuery(e.target.value)
                        }
                        placeholder="Buscar por título o artista…"
                        className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-gris-300 bg-white focus:outline-none focus:ring-2 focus:ring-turquesa-400 focus:border-turquesa-400 min-h-[36px]"
                      />
                      {query !== '' && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            searchInputRef.current?.focus();
                          }}
                          aria-label="Limpiar búsqueda"
                          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 text-gris-400 hover:text-rosa-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400"
                        >
                          <MaterialIcon name="close" size="small" />
                        </button>
                      )}
                    </div>
                  </label>
                </div>
                {isFallback && (
                  <div className="px-3 py-2 border-b border-gris-100 bg-tulipTree-50/60 flex items-center gap-1.5">
                    <MaterialIcon
                      name="info"
                      size="small"
                      className="text-tulipTree-500 shrink-0"
                    />
                    <p className="text-xs text-tulipTree-700">
                      Sin opciones ideales libres
                    </p>
                  </div>
                )}
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-gris-600">
                      Sin resultados para «{query}»
                    </p>
                  </div>
                ) : (
                  <ul className="py-1">
                    {filtered.map((alt) => (
                      <li key={alt.track.uri}>
                        <div className="flex items-center gap-2 px-2">
                          <TrackPreviewButton uri={alt.track.uri} />
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => handleSelect(alt.track.uri)}
                            className="flex-1 text-left px-1 py-2 min-h-[44px] flex items-center gap-3 rounded hover:bg-turquesa-50 focus:bg-turquesa-50 focus:outline-none transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gris-800 truncate">
                                {alt.track.name}
                              </p>
                              <p className="text-xs text-gris-500 truncate">
                                {alt.track.artists.join(', ')}
                              </p>
                            </div>
                            <span className="text-xs text-gris-500 tabular-nums shrink-0">
                              {Math.round(alt.track.tempoBpm)} bpm
                            </span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef}>
      <Button
        variant="secondary"
        size="sm"
        iconLeft="refresh"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Cambiar tema del tramo ${rowIndex}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span className="hidden sm:inline">Otro tema</span>
        <MaterialIcon
          name={open ? 'expand_less' : 'expand_more'}
          size="small"
          className="hidden sm:inline-flex"
        />
      </Button>
      {popover}
    </div>
  );
}

interface PlaceholderCoverProps {
  zone: MatchedSegment['zone'];
}

function PlaceholderCover({ zone }: PlaceholderCoverProps): JSX.Element {
  // Tinte sutil por zona: bg-zone-{n}/10 sobre fondo turquesa de fallback.
  // Las clases necesitan estar literales para que Tailwind las recoja.
  const ZONE_TINT: Record<number, string> = {
    1: 'bg-zone-1/10',
    2: 'bg-zone-2/10',
    3: 'bg-zone-3/10',
    4: 'bg-zone-4/10',
    5: 'bg-zone-5/10',
    6: 'bg-zone-6/10',
  };
  const tint = ZONE_TINT[zone] ?? 'bg-turquesa-50';
  return (
    <div
      className={`flex items-center justify-center w-12 h-12 rounded-md ${tint} shrink-0`}
      aria-hidden
    >
      <MaterialIcon name="music_note" size="medium" className="text-gris-600" />
    </div>
  );
}
