import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AlternativeCandidate, MatchedSegment } from '@core/matching';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';
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
}: PlaylistTrackRowProps): JSX.Element {
  const { track, zone, matchQuality } = matched;
  const qualityLabel = QUALITY_LABEL[matchQuality];

  if (track === null) {
    return (
      <article className="flex items-center gap-3 rounded-lg border border-gris-200 bg-gris-50 p-3">
        <PlaceholderCover />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gris-500 italic">
            Sin tema disponible para esta zona
          </p>
        </div>
        <ZoneBadge zone={zone} size="sm" />
      </article>
    );
  }

  const showPicker = onReplaceWith !== undefined;

  return (
    <article className="rounded-lg border border-gris-200 bg-white p-3 hover:border-turquesa-300 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <PlaceholderCover />
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
          <ZoneBadge zone={zone} size="sm" />
          <span className="text-xs text-gris-500 tabular-nums">
            {Math.round(track.tempoBpm)} bpm
          </span>
        </div>
      </div>
      {showPicker && (
        <div className="mt-2 pt-2 border-t border-gris-100 flex items-center justify-between gap-2">
          {qualityLabel && (
            <span
              className="text-xs text-tulipTree-600 flex items-center gap-1"
              title="No habia un tema exacto para esta zona en tu catalogo"
            >
              <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
              {qualityLabel}
            </span>
          )}
          <AlternativesPicker
            alternatives={alternatives ?? []}
            onSelect={onReplaceWith}
            rowIndex={index}
          />
        </div>
      )}
    </article>
  );
}

interface AlternativesPickerProps {
  alternatives: readonly AlternativeCandidate[];
  onSelect: (uri: string) => void;
  rowIndex: number;
}

interface PopoverPosition {
  top: number;
  right: number;
}

function AlternativesPicker({
  alternatives,
  onSelect,
  rowIndex,
}: AlternativesPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const isEmpty = alternatives.length === 0;

  // Calcula y mantiene la posicion del popover anclada al boton. El popover
  // vive en un portal a document.body para no ser recortado por ancestros
  // con overflow:auto (la lista del Resultado tiene md:overflow-y-auto).
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function update(): void {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
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
              right: position.right,
            }}
            className="z-50 w-72 max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto rounded-lg border border-gris-200 bg-white shadow-lg ring-1 ring-black/5"
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
              <ul className="py-1">
                {alternatives.map((alt) => (
                  <li key={alt.track.uri}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSelect(alt.track.uri)}
                      className="w-full text-left px-3 py-2 min-h-[44px] flex items-center gap-3 hover:bg-turquesa-50 focus:bg-turquesa-50 focus:outline-none transition-colors"
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
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className="ml-auto">
      <Button
        variant="secondary"
        size="sm"
        iconLeft="refresh"
        iconRight={open ? 'expand_less' : 'expand_more'}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Cambiar tema del tramo ${rowIndex}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        Otro tema
      </Button>
      {popover}
    </div>
  );
}

function PlaceholderCover(): JSX.Element {
  return (
    <div
      className="flex items-center justify-center w-12 h-12 rounded-md bg-gradient-to-br from-turquesa-100 to-turquesa-50 shrink-0"
      aria-hidden
    >
      <MaterialIcon name="music_note" size="medium" className="text-turquesa-600" />
    </div>
  );
}
