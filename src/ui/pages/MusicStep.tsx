import { useMemo, useState } from 'react';
import {
  analyzePoolCoverage,
  type CrossZoneMode,
  type MatchPreferences,
  type MatchedSegment,
  type PoolCoverage,
} from '@core/matching';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import { parseTrackCsv, type Track } from '@core/tracks';
import { BestEffortBanner } from '@ui/components/BestEffortBanner';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { ExportifyHowto } from '@ui/components/ExportifyHowto';
import { FileDropzone } from '@ui/components/FileDropzone';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { PlaylistPreviewRow } from '@ui/components/PlaylistPreviewRow';
import type { UploadedCsv } from '@ui/state/uploadedCsv';
import type { MusicSourceMode } from '@ui/state/wizardStorage';
import { navigateInApp } from '@ui/utils/navigation';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';

export interface MusicStepProps {
  segments: readonly ClassifiedSegment[];
  meta: RouteMeta;
  /** Catalogo activo combinado (predefinido + uploads del usuario) calculado en App. */
  tracks: readonly Track[];
  /**
   * Preferencias musicales del usuario (generos preferidos + "todo con
   * energia"). Read-only desde MusicStep — la edicion vive en
   * /preferencias para que sean ajustes persistentes.
   */
  preferences: MatchPreferences;
  /** Fuente del catalogo (mine / both). Controlada desde App. */
  sourceMode: MusicSourceMode;
  onSourceModeChange: (next: MusicSourceMode) => void;
  /**
   * CSVs subidos por el usuario. Desde Fase E viven persistidos en
   * cadenciaStore y se sincronizan con Drive si el usuario lo conecto.
   * El array que llega es reactivo: re-render al detectar cambios en
   * el store (locales o remotos).
   */
  uploadedCsvs: readonly UploadedCsv[];
  /** Persistir un CSV nuevo. Recibe el csvText raw y el nombre del archivo. */
  onCsvUploaded: (csvText: string, name: string) => void;
  /** Borrar un CSV (tombstone). Se propaga via sync. */
  onCsvRemoved: (id: string) => void;
  /** Matching base calculado en App. null antes del primer calculo. */
  matched: readonly MatchedSegment[] | null;
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
  sourceMode,
  onSourceModeChange,
  uploadedCsvs,
  onCsvUploaded,
  onCsvRemoved,
  matched,
  onAdvance,
  onBack,
  crossZoneMode = 'overlap',
}: MusicStepProps): JSX.Element {
  // Unico state local que sobrevive: errores transitorios de subida de CSV.
  // Todo lo demas viene controlado desde App.
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleCsvUpload = async (file: File): Promise<void> => {
    setUploadError(null);
    try {
      const text = await file.text();
      // Validacion de UX: parseamos antes de persistir para dar feedback
      // inmediato si el CSV esta vacio o tiene formato roto. La persistencia
      // (createUploadedCsv) hace su propio parseo para trackCount.
      try {
        const parsed = parseTrackCsv(text, 'user');
        if (parsed.length === 0) {
          setUploadError(`"${file.name}" no tiene canciones válidas. Verifica el formato del CSV.`);
          return;
        }
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : 'CSV invalido';
        setUploadError(`"${file.name}": ${msg}`);
        return;
      }
      onCsvUploaded(text, file.name);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al leer el archivo';
      setUploadError(`"${file.name}": ${message}`);
    }
  };

  const handleRemoveCsv = (id: string): void => {
    onCsvRemoved(id);
  };

  const totalMinutes = Math.round(meta.totalDurationSec / 60);
  const bestEffortCount = list.filter((m) => m.matchQuality === 'best-effort').length;

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
        <div className="mb-4">
          <ExportifyHowto />
        </div>
        <fieldset className="space-y-2">
          <legend className="sr-only">Fuente del catálogo de música</legend>
          <SourceRadio
            value="both"
            current={sourceMode}
            onChange={onSourceModeChange}
            title="Combinar ambas"
            desc="La biblioteca predefinida más tus CSV. Damos preferencia a tus canciones cuando encajan; si te quedas corto, completamos con la predefinida."
          />
          <SourceRadio
            value="mine"
            current={sourceMode}
            onChange={onSourceModeChange}
            title="Solo mis CSV"
            desc="Solo canciones que tú subas. Máxima personalización; necesitas subir al menos un CSV."
          />
        </fieldset>

        <button
          type="button"
          onClick={() => navigateInApp('/catalogo')}
          className="mt-4 w-full inline-flex items-start gap-3 px-3 py-3 rounded-lg border border-gris-300 bg-white text-left hover:border-tulipTree-400 hover:bg-tulipTree-50 transition-colors min-h-[44px]"
        >
          <MaterialIcon
            name="edit_note"
            size="small"
            className="text-tulipTree-600 mt-0.5 flex-shrink-0"
          />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gris-800">
              Editar mi catálogo
            </span>
            <span className="block text-xs text-gris-500">
              Sube tus listas de Spotify, desmarca canciones del catálogo predefinido
              y revisa las que descartaste. Todo se guarda en tu navegador.
            </span>
          </span>
          <MaterialIcon
            name="arrow_forward"
            size="small"
            className="text-gris-400 mt-0.5 flex-shrink-0"
          />
        </button>

        {showDropzone && (
          <div className="mt-4 space-y-3">
            <FileDropzone
              acceptedLabel="CSV"
              accept=".csv,text/csv"
              idlePrompt="Mueve aquí tus listas de música (.csv) o pulsa para cargarlas desde tu dispositivo"
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
                          {c.error ?? `${c.trackCount} canciones cargadas`}
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
          <div
            role="alert"
            className="mt-3 rounded-lg border-2 border-rosa-600 bg-rosa-100/40 p-3 flex items-start gap-2"
          >
            <MaterialIcon
              name="error_outline"
              size="small"
              className="text-rosa-600 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-gris-800">
              <strong>No puedes continuar con esta fuente sin CSV cargados.</strong>{' '}
              Sube al menos un CSV válido o cambia la fuente a «Combinar ambas».
            </p>
          </div>
        )}
      </Card>

      <PreferencesSummary preferences={preferences} />

      {!coverage.ok && (
        <PoolCoverageWarning
          coverage={coverage}
          sourceMode={sourceMode}
          onSwitchToBoth={() => onSourceModeChange('both')}
        />
      )}

      {bestEffortCount > 0 && <BestEffortBanner count={bestEffortCount} />}

      <Card title="Tu lista" titleIcon="queue_music">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-3">
          <p className="text-sm text-gris-600">
            <strong className="text-gris-800 tabular-nums">{list.length}</strong> temas
            para <strong className="text-gris-800 tabular-nums">{totalMinutes} min</strong> de
            ruta
          </p>
          <span className="text-xs text-gris-500 italic">
            Vista previa — podrás editarla en el siguiente paso.
          </span>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gris-500 italic">
            {needsUserUpload
              ? 'Sin temas que mostrar — sube al menos un CSV válido o cambia la fuente del catálogo.'
              : tracks.length === 0
                ? 'Sin temas en el catálogo activo. Sube un CSV o cambia la fuente.'
                : 'Sin temas que mostrar. Vuelve a Plan para procesar un GPX.'}
          </p>
        ) : (
          <ul className="space-y-1.5 md:max-h-[55vh] md:overflow-y-auto md:pr-1">
            {list.map((m, i) => (
              <li key={`${m.startSec}-${i}`}>
                <PlaylistPreviewRow
                  matched={m}
                  index={i + 1}
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
            La lista se generará igualmente; subiendo más listas
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
          <Button
            variant="secondary"
            iconLeft="arrow_back"
            onClick={onBack}
            aria-label="Atrás"
            title="Atrás"
          />
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={!canGoNext}
            onClick={onNext}
            fullWidth
            aria-label="¡A pedalear!"
            title="¡A pedalear!"
          >
            ¡A pedalear!
          </Button>
        </>
      }
      desktop={
        <>
          <Button
            variant="secondary"
            iconLeft="arrow_back"
            onClick={onBack}
            aria-label="Atrás"
            title="Atrás"
          />
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={!canGoNext}
            onClick={onNext}
            aria-label="¡A pedalear!"
            title="¡A pedalear!"
          >
            ¡A pedalear!
          </Button>
        </>
      }
    />
  );
}

interface PreferencesSummaryProps {
  preferences: MatchPreferences;
}

/**
 * Resumen read-only de las preferencias musicales del usuario (generos
 * preferidos + "todo con energia"). La edicion vive en /preferencias →
 * Catalogo de musica para que sean ajustes que perduran entre sesiones,
 * no algo que el usuario tenga que volver a marcar cada vez.
 */
function PreferencesSummary({ preferences }: PreferencesSummaryProps): JSX.Element {
  const hasGenres = preferences.preferredGenres.length > 0;
  return (
    <Card title="Tus preferencias" titleIcon="tune">
      <div className="text-sm text-gris-700 space-y-2">
        {hasGenres ? (
          <p>
            <strong>Géneros preferidos:</strong>{' '}
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {preferences.preferredGenres.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-turquesa-100 text-turquesa-800"
                >
                  {g}
                </span>
              ))}
            </span>
          </p>
        ) : (
          <p className="text-gris-500">
            No has marcado géneros preferidos. Usaremos todo tu catálogo.
          </p>
        )}
        {preferences.allEnergetic && (
          <p className="text-xs text-gris-600">
            <MaterialIcon name="bolt" size="small" className="text-turquesa-600 mr-1" />
            «Todo con energía» activado.
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => navigateInApp('/preferencias')}
          className="inline-flex items-center gap-1 text-sm text-turquesa-700 font-semibold hover:text-turquesa-800 hover:underline min-h-[36px]"
        >
          <MaterialIcon name="edit" size="small" />
          Editar mis preferencias
        </button>
      </div>
    </Card>
  );
}
