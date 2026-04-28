import { useMemo, useState, type ChangeEvent } from 'react';
import {
  analyzePoolCoverage,
  getAlternativesForSegment,
  replaceTrackInSegment,
  type CrossZoneMode,
  type MatchPreferences,
  type MatchedSegment,
  type PoolCoverage,
} from '@core/matching';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import { getTopGenres, parseTrackCsv, type Track } from '@core/tracks';
import { BestEffortBanner } from '@ui/components/BestEffortBanner';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { FileDropzone } from '@ui/components/FileDropzone';
import { GenrePills } from '@ui/components/GenrePills';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { PlaylistTrackRow } from '@ui/components/PlaylistTrackRow';
import type { UploadedCsv } from '@ui/state/uploadedCsv';
import type { MusicSourceMode } from '@ui/state/wizardStorage';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';

export interface MusicStepProps {
  segments: readonly ClassifiedSegment[];
  meta: RouteMeta;
  /** Catalogo activo combinado (predefinido + uploads del usuario) calculado en App. */
  tracks: readonly Track[];
  /** Preferencias controladas: el reducer vive en App para sobrevivir remountajes. */
  preferences: MatchPreferences;
  onPreferencesChange: (next: MatchPreferences) => void;
  /** Fuente del catalogo (predefined / mine / both). Controlada desde App. */
  sourceMode: MusicSourceMode;
  onSourceModeChange: (next: MusicSourceMode) => void;
  /** CSVs subidos por el usuario. Viven en App (in-memory) para que persistan al ir y volver. */
  uploadedCsvs: readonly UploadedCsv[];
  onUploadedCsvsChange: (next: readonly UploadedCsv[]) => void;
  /** Matching base calculado en App. null antes del primer calculo. */
  matched: readonly MatchedSegment[] | null;
  onMatchedChange: (next: MatchedSegment[]) => void;
  /** Indices reemplazados manualmente con "Otro tema". Viven en App. */
  replacedIndices: ReadonlySet<number>;
  onReplacedIndicesChange: (next: ReadonlySet<number>) => void;
  /** Avanza al siguiente paso. El matching ya esta sincronizado en App. */
  onAdvance: () => void;
  onBack: () => void;
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
  tracks,
  preferences,
  onPreferencesChange,
  sourceMode,
  onSourceModeChange,
  uploadedCsvs,
  onUploadedCsvsChange,
  matched,
  onMatchedChange,
  replacedIndices,
  onReplacedIndicesChange,
  onAdvance,
  onBack,
  crossZoneMode = 'overlap',
}: MusicStepProps): JSX.Element {
  // Unico state local que sobrevive: errores transitorios de subida de CSV.
  // Todo lo demas viene controlado desde App.
  const [uploadError, setUploadError] = useState<string | null>(null);

  const topGenres = useMemo(() => getTopGenres(tracks, 12), [tracks]);

  // Pre-check de cobertura: cuantos tracks unicos hace falta por zona
  // para cumplir la regla "cero repeticiones" sin huecos.
  const coverage = useMemo(
    () => analyzePoolCoverage(segments, tracks, preferences),
    [segments, tracks, preferences],
  );

  // Lista efectiva renderizada: si App aun no ha calculado el matching base
  // (matched === null en el primer mount tras procesar la ruta), mostramos
  // lista vacia hasta que el effect de App dispare. Es un caso fugaz.
  // Memoizado para no romper la igualdad referencial de los useMemo derivados.
  const list = useMemo<readonly MatchedSegment[]>(() => matched ?? [], [matched]);

  // Alternativas validas por fila (excluye URIs ya en la playlist). Mismo
  // criterio que en Result para que el dropdown sea consistente entre pasos.
  const alternativesByIndex = useMemo(
    () => list.map((_, i) => getAlternativesForSegment(list, i, tracks, preferences)),
    [list, tracks, preferences],
  );

  const handleReplaceWith = (index: number, uri: string): void => {
    const result = replaceTrackInSegment(list, index, tracks, preferences, uri);
    if (!result.replaced) return;
    onMatchedChange(result.matched);
    const next = new Set(replacedIndices);
    next.add(index);
    onReplacedIndicesChange(next);
  };

  const handleCsvUpload = async (file: File): Promise<void> => {
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = parseTrackCsv(text, 'user');
      if (parsed.length === 0) {
        onUploadedCsvsChange([
          ...uploadedCsvs,
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
      onUploadedCsvsChange([
        ...uploadedCsvs,
        {
          id: crypto.randomUUID(),
          name: file.name,
          trackCount: parsed.length,
          tracks: parsed,
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al leer el CSV';
      onUploadedCsvsChange([
        ...uploadedCsvs,
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
    onUploadedCsvsChange(uploadedCsvs.filter((c) => c.id !== id));
  };

  const setGenres = (genres: string[]): void => {
    onPreferencesChange({ ...preferences, preferredGenres: genres });
  };
  const setAllEnergetic = (e: ChangeEvent<HTMLInputElement>): void => {
    onPreferencesChange({ ...preferences, allEnergetic: e.target.checked });
  };

  const totalMinutes = Math.round(meta.totalDurationSec / 60);
  const bestEffortCount = list.filter((m) => m.matchQuality === 'best-effort').length;
  const replacedCount = replacedIndices.size;

  const validUploads = uploadedCsvs.filter((c) => c.error === undefined);
  const hasUserTracks = validUploads.length > 0;
  const showDropzone = sourceMode === 'mine' || sourceMode === 'both';
  const needsUserUpload = sourceMode === 'mine' && !hasUserTracks;

  // Aviso visible (no excluyente) sobre crossZoneMode para depuracion futura.
  void crossZoneMode;

  return (
    <WizardStep>
      <WizardStepHeading
        title="Tu música"
        subtitle="Elige de dónde sale el catálogo y marca los géneros que te van."
      />
      <Card title="De dónde sale tu música" titleIcon="library_music">
        <fieldset className="space-y-2">
          <legend className="sr-only">Fuente del catálogo de música</legend>
          <SourceRadio
            value="both"
            current={sourceMode}
            onChange={onSourceModeChange}
            title="Combinar ambas"
            desc="La biblioteca predefinida más tus CSV. Más variedad y siempre hay tracks disponibles."
          />
          <SourceRadio
            value="mine"
            current={sourceMode}
            onChange={onSourceModeChange}
            title="Solo mis CSV"
            desc="Solo canciones que tú subas. Máxima personalización; necesitas subir al menos un CSV."
          />
          <SourceRadio
            value="predefined"
            current={sourceMode}
            onChange={onSourceModeChange}
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
          onSwitchToBoth={() => onSourceModeChange('both')}
        />
      )}

      {bestEffortCount > 0 && <BestEffortBanner count={bestEffortCount} />}

      <Card title="Tu lista" titleIcon="queue_music">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="text-sm text-gris-600">
            <strong className="text-gris-800 tabular-nums">{list.length}</strong> temas
            para <strong className="text-gris-800 tabular-nums">{totalMinutes} min</strong> de
            ruta
          </p>
          {replacedCount > 0 && (
            <span className="text-xs text-turquesa-700 flex items-center gap-1">
              <MaterialIcon name="edit" size="small" className="text-turquesa-600" />
              {replacedCount} cambio{replacedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gris-500 italic">
            Sin temas que mostrar. Vuelve a Ruta para procesar un GPX.
          </p>
        ) : (
          <ul className="space-y-2 md:max-h-[55vh] md:overflow-y-auto md:pr-1">
            {list.map((m, i) => (
              <li key={`${m.startSec}-${i}`}>
                <PlaylistTrackRow
                  matched={m}
                  index={i + 1}
                  alternatives={alternativesByIndex[i] ?? []}
                  onReplaceWith={(uri) => handleReplaceWith(i, uri)}
                  replaced={replacedIndices.has(i)}
                  showSlope={crossZoneMode === 'overlap'}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FooterActions
        onBack={onBack}
        onNext={onAdvance}
        canGoNext={list.length > 0 && tracks.length > 0 && !needsUserUpload}
      />
    </WizardStep>
  );
}

interface SourceRadioProps {
  value: MusicSourceMode;
  current: MusicSourceMode;
  onChange: (next: MusicSourceMode) => void;
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
  sourceMode: MusicSourceMode;
  onSwitchToBoth: () => void;
}

function PoolCoverageWarning({
  coverage,
  sourceMode,
  onSwitchToBoth,
}: PoolCoverageWarningProps): JSX.Element {
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-tulipTree-300 bg-tulipTree-50 p-4 md:p-5 space-y-2"
    >
      <div className="flex items-start gap-3">
        <MaterialIcon
          name="lightbulb"
          size="medium"
          className="text-tulipTree-600 flex-shrink-0 mt-0.5"
        />
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-display font-semibold text-gris-900">
            Algunas canciones se van a repetir
          </h2>
          <p className="text-sm text-gris-700 mt-1">
            Para una sesión sin repetir nada necesitarías{' '}
            <strong className="tabular-nums">{coverage.neededTotal}</strong>{' '}
            canciones únicas, y tu catálogo tiene{' '}
            <strong className="tabular-nums">{coverage.availableTotal}</strong>.
            La playlist se generará igualmente; subiendo más listas
            {sourceMode !== 'both' && (
              <>
                {' '}o{' '}
                <button
                  type="button"
                  onClick={onSwitchToBoth}
                  className="text-turquesa-700 font-semibold underline-offset-2 hover:underline"
                >
                  combinando con la biblioteca predefinida
                </button>
              </>
            )}{' '}
            tendrás más variedad y mejor encaje por zona.
          </p>
        </div>
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
    <WizardStepFooter
      mobile={
        <>
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
        </>
      }
      desktop={
        <>
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
        </>
      }
    />
  );
}
