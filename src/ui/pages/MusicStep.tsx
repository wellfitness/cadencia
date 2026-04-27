import { useMemo, useReducer, useState, type ChangeEvent } from 'react';
import {
  analyzePoolCoverage,
  EMPTY_PREFERENCES,
  matchTracksToSegments,
  ZONE_MUSIC_CRITERIA,
  type CrossZoneMode,
  type MatchPreferences,
  type MatchedSegment,
  type PoolCoverage,
} from '@core/matching';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import {
  dedupeByUri,
  getTopGenres,
  loadNativeTracks,
  parseTrackCsv,
  type Track,
} from '@core/tracks';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { FileDropzone } from '@ui/components/FileDropzone';
import { GenrePills } from '@ui/components/GenrePills';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TrackCard } from '@ui/components/TrackCard';

type SourceMode = 'predefined' | 'mine' | 'both';

interface UploadedCsv {
  id: string;
  name: string;
  trackCount: number;
  tracks: readonly Track[];
  error?: string;
}

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
  /**
   * Modo de matching frente a las zonas:
   * - 'overlap' (default): un track cubre los siguientes segmentos aunque
   *   cambien de zona. Adecuado para GPX (rutas continuas).
   * - 'discrete': cada bloque arranca con su propio track de su zona.
   *   Adecuado para sesiones indoor por intervalos.
   */
  crossZoneMode?: CrossZoneMode;
}

export function MusicStep({
  segments,
  meta,
  onMatched,
  onBack,
  initialPreferences,
  crossZoneMode = 'overlap',
}: MusicStepProps): JSX.Element {
  const [preferences, dispatch] = useReducer(
    preferencesReducer,
    initialPreferences ?? EMPTY_PREFERENCES,
  );

  // Fuente del catalogo: predefinido (CSVs embebidos), solo lo subido por el
  // usuario, o ambos combinados. Default 'both' para no romper el flow actual.
  const [sourceMode, setSourceMode] = useState<SourceMode>('both');
  const [uploadedCsvs, setUploadedCsvs] = useState<readonly UploadedCsv[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Catalogo combinado segun la fuente elegida. Los nativos se cachean a nivel
  // de modulo en loadNativeTracks(); los user tracks se mergean dedup por URI.
  const tracks = useMemo(() => {
    const userTracks = uploadedCsvs.flatMap((c) => [...c.tracks]);
    if (sourceMode === 'predefined') return loadNativeTracks();
    if (sourceMode === 'mine') return dedupeByUri(userTracks);
    return dedupeByUri([...loadNativeTracks(), ...userTracks]);
  }, [sourceMode, uploadedCsvs]);

  const topGenres = useMemo(() => getTopGenres(tracks, 12), [tracks]);

  // Pre-check de cobertura: cuantos tracks unicos hace falta por zona
  // para cumplir la regla "cero repeticiones" sin huecos.
  const coverage = useMemo(
    () => analyzePoolCoverage(segments, tracks, preferences),
    [segments, tracks, preferences],
  );

  // Matching en vivo: cada cambio de preferencias o fuente recalcula. <50ms
  // para catalogos pequenos, no necesita debounce.
  const matched = useMemo(
    () => matchTracksToSegments(segments, tracks, preferences, { crossZoneMode }),
    [segments, tracks, preferences, crossZoneMode],
  );

  const handleCsvUpload = async (file: File): Promise<void> => {
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = parseTrackCsv(text, 'user');
      if (parsed.length === 0) {
        setUploadedCsvs((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            trackCount: 0,
            tracks: [],
            error: 'CSV sin tracks válidos',
          },
        ]);
        return;
      }
      setUploadedCsvs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: file.name,
          trackCount: parsed.length,
          tracks: parsed,
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al leer el CSV';
      setUploadedCsvs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: file.name,
          trackCount: 0,
          tracks: [],
          error: message,
        },
      ]);
    }
  };

  const handleRemoveCsv = (id: string): void => {
    setUploadedCsvs((prev) => prev.filter((c) => c.id !== id));
  };

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

  const validUploads = uploadedCsvs.filter((c) => c.error === undefined);
  const hasUserTracks = validUploads.length > 0;
  const showDropzone = sourceMode === 'mine' || sourceMode === 'both';
  const needsUserUpload = sourceMode === 'mine' && !hasUserTracks;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10">
      <Card title="De dónde sale tu música" titleIcon="library_music">
        <fieldset className="space-y-2">
          <legend className="sr-only">Fuente del catálogo de música</legend>
          <SourceRadio
            value="both"
            current={sourceMode}
            onChange={setSourceMode}
            title="Combinar ambas"
            desc="La biblioteca predefinida más tus CSV. Más variedad y siempre hay tracks disponibles."
          />
          <SourceRadio
            value="mine"
            current={sourceMode}
            onChange={setSourceMode}
            title="Solo mis CSV"
            desc="Solo canciones que tú subas. Máxima personalización; necesitas subir al menos un CSV."
          />
          <SourceRadio
            value="predefined"
            current={sourceMode}
            onChange={setSourceMode}
            title="Solo predefinida"
            desc="La biblioteca embebida en la app, sin tus CSV."
          />
        </fieldset>

        {showDropzone && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-gris-600 leading-relaxed">
              ¿No tienes un CSV de tus listas? Genéralo gratis en{' '}
              <a
                href="https://exportify.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-turquesa-700 font-semibold underline-offset-2 hover:underline"
              >
                exportify.net
              </a>
              . Es código abierto, autoriza Spotify en tu navegador y descarga
              cualquier lista como CSV con BPM, energía y géneros (las columnas
              que necesitamos).
            </p>
            <FileDropzone
              acceptedLabel="CSV"
              accept=".csv,text/csv"
              onFile={(f) => void handleCsvUpload(f)}
              onError={(msg) => setUploadError(msg)}
            />
            {uploadError !== null && (
              <p
                className="text-sm text-rosa-600 flex items-center gap-1.5"
                role="alert"
              >
                <MaterialIcon name="error_outline" size="small" />
                {uploadError}
              </p>
            )}
            {uploadedCsvs.length > 0 && (
              <ul className="space-y-2">
                {uploadedCsvs.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                      c.error !== undefined
                        ? 'border-rosa-100 bg-rosa-100/30'
                        : 'border-gris-200 bg-gris-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MaterialIcon
                        name={c.error !== undefined ? 'error_outline' : 'check_circle'}
                        size="small"
                        className={
                          c.error !== undefined ? 'text-rosa-600' : 'text-turquesa-600'
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gris-800 truncate">
                          {c.name}
                        </p>
                        <p className="text-xs text-gris-500">
                          {c.error ?? `${c.trackCount} tracks cargados`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCsv(c.id)}
                      className="text-gris-500 hover:text-rosa-600 transition-colors p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      aria-label={`Quitar ${c.name}`}
                    >
                      <MaterialIcon name="close" size="small" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {needsUserUpload && (
          <p className="text-sm text-tulipTree-600 mt-3 flex items-center gap-1.5">
            <MaterialIcon name="info" size="small" className="text-tulipTree-500" />
            Sube al menos un CSV válido para continuar con esta fuente.
          </p>
        )}
      </Card>

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

      {!coverage.ok && (
        <PoolCoverageWarning
          coverage={coverage}
          sourceMode={sourceMode}
          onSwitchToBoth={() => setSourceMode('both')}
        />
      )}

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

      <FooterActions
        onBack={onBack}
        onNext={handleNext}
        canGoNext={
          matched.length > 0 && tracks.length > 0 && !needsUserUpload && coverage.ok
        }
      />
    </div>
  );
}

interface SourceRadioProps {
  value: SourceMode;
  current: SourceMode;
  onChange: (next: SourceMode) => void;
  title: string;
  desc: string;
}

function SourceRadio({
  value,
  current,
  onChange,
  title,
  desc,
}: SourceRadioProps): JSX.Element {
  const checked = value === current;
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer rounded-lg border-2 p-3 min-h-[44px] transition-colors ${
        checked
          ? 'border-turquesa-600 bg-turquesa-50'
          : 'border-gris-200 bg-white hover:border-turquesa-300'
      }`}
    >
      <input
        type="radio"
        name="source-mode"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 w-5 h-5 accent-turquesa-600 cursor-pointer"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gris-800">{title}</p>
        <p className="text-xs text-gris-500">{desc}</p>
      </div>
    </label>
  );
}

interface PoolCoverageWarningProps {
  coverage: PoolCoverage;
  sourceMode: SourceMode;
  onSwitchToBoth: () => void;
}

function PoolCoverageWarning({
  coverage,
  sourceMode,
  onSwitchToBoth,
}: PoolCoverageWarningProps): JSX.Element {
  const deficits = coverage.byZone.filter((z) => z.deficit > 0);
  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-tulipTree-500 bg-tulipTree-50 p-4 md:p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <MaterialIcon
          name="warning"
          size="medium"
          className="text-tulipTree-600 flex-shrink-0 mt-0.5"
        />
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-display font-semibold text-gris-900">
            Tu catálogo no llega para la sesión completa
          </h2>
          <p className="text-sm text-gris-700 mt-1">
            Para que ninguna canción se repita necesitas más temas en{' '}
            {deficits.length === 1 ? 'la siguiente zona' : 'las siguientes zonas'}.
          </p>
        </div>
      </div>
      <ul className="space-y-2 pl-1">
        {deficits.map((z) => (
          <li key={z.zone} className="flex items-baseline gap-2 text-sm text-gris-800">
            <span className="font-semibold tabular-nums">Z{z.zone}</span>
            <span className="text-gris-600">
              ({ZONE_MUSIC_CRITERIA[z.zone].description}):
            </span>
            <span className="tabular-nums">
              tienes {z.available}, necesitas {z.needed}
            </span>
            <span className="text-rosa-600 font-semibold tabular-nums">
              — faltan {z.deficit}
            </span>
          </li>
        ))}
      </ul>
      <div className="pt-1">
        <p className="text-sm text-gris-700">
          Sube otro CSV con más canciones de esas zonas
          {sourceMode !== 'both' && (
            <>
              {' '}o{' '}
              <button
                type="button"
                onClick={onSwitchToBoth}
                className="text-turquesa-700 font-semibold underline-offset-2 hover:underline"
              >
                combina con la biblioteca predefinida
              </button>
            </>
          )}
          .
        </p>
      </div>
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
