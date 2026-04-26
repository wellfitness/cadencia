import { useMemo, useReducer, type ChangeEvent } from 'react';
import {
  EMPTY_PREFERENCES,
  matchTracksToSegments,
  type MatchPreferences,
  type MatchedSegment,
} from '@core/matching';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import { getTopGenres, loadNativeTracks } from '@core/tracks';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { GenrePills } from '@ui/components/GenrePills';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackCard } from '@ui/components/TrackCard';

type PreferencesAction =
  | { type: 'TOGGLE_GENRES'; genres: string[] }
  | { type: 'SET_ALL_ENERGETIC'; value: boolean }
  | { type: 'RESET' };

function preferencesReducer(
  state: MatchPreferences,
  action: PreferencesAction,
): MatchPreferences {
  switch (action.type) {
    case 'TOGGLE_GENRES':
      return { ...state, preferredGenres: action.genres };
    case 'SET_ALL_ENERGETIC':
      return { ...state, allEnergetic: action.value };
    case 'RESET':
      return EMPTY_PREFERENCES;
  }
}

const MAX_PREVIEW = 8;

export interface MusicStepProps {
  segments: readonly ClassifiedSegment[];
  meta: RouteMeta;
  /** Llamado al pulsar Siguiente con la lista final asignada y las preferencias usadas. */
  onMatched: (matched: MatchedSegment[], preferences: MatchPreferences) => void;
  onBack: () => void;
  /** Estado inicial de preferencias (si el usuario vuelve atrás y entra otra vez). */
  initialPreferences?: MatchPreferences;
}

export function MusicStep({
  segments,
  meta,
  onMatched,
  onBack,
  initialPreferences,
}: MusicStepProps): JSX.Element {
  const [preferences, dispatch] = useReducer(
    preferencesReducer,
    initialPreferences ?? EMPTY_PREFERENCES,
  );

  // Catalogo + top generos cacheado entre renders (singleton del modulo).
  const tracks = useMemo(() => loadNativeTracks(), []);
  const topGenres = useMemo(() => getTopGenres(tracks, 12), [tracks]);

  // Matching en vivo: cada cambio de preferencias recalcula. <50ms para 142
  // tracks y rutas tipicas, no necesita debounce.
  const matched = useMemo(
    () => matchTracksToSegments(segments, tracks, preferences),
    [segments, tracks, preferences],
  );

  const setGenres = (genres: string[]): void => {
    dispatch({ type: 'TOGGLE_GENRES', genres });
  };
  const setAllEnergetic = (e: ChangeEvent<HTMLInputElement>): void => {
    dispatch({ type: 'SET_ALL_ENERGETIC', value: e.target.checked });
  };

  const handleNext = (): void => {
    onMatched(matched, preferences);
  };

  const totalMinutes = Math.round(meta.totalDurationSec / 60);
  const previewItems = matched.slice(0, MAX_PREVIEW);
  const remaining = Math.max(0, matched.length - MAX_PREVIEW);
  const relaxedCount = matched.filter((m) => m.matchQuality !== 'strict').length;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10">
      <Card title="Tus preferencias" titleIcon="tune">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gris-700 mb-2">
              Géneros que te van
            </p>
            <p className="text-xs text-gris-500 mb-3">
              Marca los que te gusten. Si no marcas ninguno, usamos todo el catálogo.
            </p>
            <GenrePills
              availableGenres={topGenres}
              selectedGenres={preferences.preferredGenres}
              onChange={setGenres}
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={preferences.allEnergetic}
              onChange={setAllEnergetic}
              className="mt-1 w-5 h-5 accent-turquesa-600 cursor-pointer"
            />
            <div>
              <p className="text-sm font-semibold text-gris-700">Todo con energía</p>
              <p className="text-xs text-gris-500">
                Sube el listón en zonas suaves (Z1-Z2) para que ningún tramo se sienta
                blando.
              </p>
            </div>
          </label>
        </div>
      </Card>

      <Card title="Tu lista" titleIcon="queue_music">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="text-sm text-gris-600">
            <strong className="text-gris-800 tabular-nums">{matched.length}</strong> temas
            para <strong className="text-gris-800 tabular-nums">{totalMinutes} min</strong> de
            ruta
          </p>
          {relaxedCount > 0 && (
            <span
              className="text-xs text-tulipTree-600 flex items-center gap-1"
              title={`${relaxedCount} segmento(s) con encaje relajado por catálogo limitado`}
            >
              <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
              {relaxedCount} relajado{relaxedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {previewItems.length === 0 ? (
          <p className="text-sm text-gris-500 italic">
            Sin temas que mostrar. Vuelve a Ruta para procesar un GPX.
          </p>
        ) : (
          <ul className="space-y-2">
            {previewItems.map((m, i) => (
              <li key={`${m.startSec}-${m.track?.uri ?? 'empty'}`}>
                <TrackCard matched={m} index={i + 1} />
              </li>
            ))}
            {remaining > 0 && (
              <li className="pt-2 text-center text-sm text-gris-500">
                + {remaining} {remaining === 1 ? 'tema más' : 'temas más'} en el resultado
                final
              </li>
            )}
          </ul>
        )}
      </Card>

      <FooterActions onBack={onBack} onNext={handleNext} canGoNext={matched.length > 0} />
    </div>
  );
}

interface FooterActionsProps {
  onBack: () => void;
  onNext: () => void;
  canGoNext: boolean;
}

function FooterActions({ onBack, onNext, canGoNext }: FooterActionsProps): JSX.Element {
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 py-3 flex items-center justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={!canGoNext}
          onClick={onNext}
          fullWidth
        >
          Siguiente: Resultado
        </Button>
      </div>
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={!canGoNext}
          onClick={onNext}
        >
          Siguiente: Resultado
        </Button>
      </div>
    </>
  );
}
