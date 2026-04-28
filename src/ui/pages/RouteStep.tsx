import { useCallback, useMemo, useState } from 'react';
import { parseGpx } from '@core/gpx/parser';
import {
  segmentInto60SecondBlocks,
  type ClassifiedSegment,
  type EditableSessionPlan,
  type RouteMeta,
} from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user/userInputs';
import { calculateKarvonenZones, type KarvonenZoneRange } from '@core/physiology/karvonen';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { ElevationChart } from '@ui/components/ElevationChart';
import { FileDropzone } from '@ui/components/FileDropzone';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { RouteSummary } from '@ui/components/RouteSummary';
import type { RouteSourceChoice } from '@ui/components/SourceSelector';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';
import { SessionBuilder } from '@ui/pages/SessionBuilder';

export interface RouteStepProps {
  validatedInputs: ValidatedUserInputs;
  /** Origen ya elegido en el paso "Tipo". Define que sub-flujo renderiza. */
  sourceType: RouteSourceChoice;
  /** Plan de sesion previamente guardado (restaurado de sessionStorage). */
  initialSessionPlan?: EditableSessionPlan | undefined;
  /**
   * Segmentos GPX ya procesados (cuando el usuario vuelve al paso tras un
   * detour). Si vienen, el GpxRouteFlow arranca en fase 'ready' en vez de
   * mostrar la dropzone vacia, evitando que el usuario tenga que volver a
   * subir el archivo.
   */
  initialSegments?: readonly ClassifiedSegment[] | undefined;
  initialMeta?: RouteMeta | undefined;
  /** Plantilla activa de la SessionBuilder (null si edita desde cero). */
  initialActiveTemplateId?: string | null;
  onProcessed: (segments: ClassifiedSegment[], meta: RouteMeta) => void;
  /** Callback cuando el plan de sesion editable cambia. */
  onSessionPlanChange: (plan: EditableSessionPlan | null) => void;
  /** Callback cuando el usuario carga otra plantilla o empieza de cero. */
  onActiveTemplateIdChange?: (id: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

type GpxPhase = 'idle' | 'parsing' | 'ready' | 'error';

const PARSING_STEPS: readonly string[] = [
  'Leyendo archivo…',
  'Calculando potencia…',
  'Segmentando…',
];

export function RouteStep({
  validatedInputs,
  sourceType,
  initialSessionPlan,
  initialSegments,
  initialMeta,
  initialActiveTemplateId = null,
  onProcessed,
  onSessionPlanChange,
  onActiveTemplateIdChange,
  onBack,
  onNext,
}: RouteStepProps): JSX.Element {
  if (sourceType === 'session') {
    return (
      <SessionBuilder
        validatedInputs={validatedInputs}
        initialPlan={initialSessionPlan}
        initialActiveTemplateId={initialActiveTemplateId}
        onProcessed={(segments, meta, plan) => {
          onSessionPlanChange(plan);
          onProcessed(segments, meta);
        }}
        onChange={onSessionPlanChange}
        {...(onActiveTemplateIdChange !== undefined
          ? { onActiveTemplateIdChange }
          : {})}
        onBack={onBack}
        onNext={onNext}
      />
    );
  }

  return (
    <GpxRouteFlow
      validatedInputs={validatedInputs}
      initialSegments={initialSegments ?? null}
      initialMeta={initialMeta ?? null}
      onProcessed={onProcessed}
      onBack={onBack}
      onNext={onNext}
    />
  );
}

interface GpxRouteFlowProps {
  validatedInputs: ValidatedUserInputs;
  initialSegments: readonly ClassifiedSegment[] | null;
  initialMeta: RouteMeta | null;
  onProcessed: (segments: ClassifiedSegment[], meta: RouteMeta) => void;
  onBack: () => void;
  onNext: () => void;
}

function GpxRouteFlow({
  validatedInputs,
  initialSegments,
  initialMeta,
  onProcessed,
  onBack,
  onNext,
}: GpxRouteFlowProps): JSX.Element {
  // Si vienen segmentos ya procesados (vuelta atras desde un paso posterior),
  // arrancamos en 'ready' con el perfil ya pintado. Evita que el usuario tenga
  // que reabrir el archivo cada vez que retrocede a este paso.
  const hasInitial = initialSegments !== null && initialMeta !== null;
  const [phase, setPhase] = useState<GpxPhase>(hasInitial ? 'ready' : 'idle');
  const [parsingStep, setParsingStep] = useState<number>(0);
  const [segments, setSegments] = useState<ClassifiedSegment[] | null>(
    initialSegments !== null ? [...initialSegments] : null,
  );
  const [meta, setMeta] = useState<RouteMeta | null>(initialMeta);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const karvonenZones = useMemo<KarvonenZoneRange[] | undefined>(() => {
    if (
      !validatedInputs.hasHeartRateZones ||
      validatedInputs.effectiveMaxHr === null ||
      validatedInputs.restingHeartRate === null
    ) {
      return undefined;
    }
    return calculateKarvonenZones(
      validatedInputs.effectiveMaxHr,
      validatedInputs.restingHeartRate,
    );
  }, [validatedInputs]);

  const processFile = useCallback(
    async (file: File): Promise<void> => {
      setPhase('parsing');
      setParsingStep(0);
      setErrorMessage(null);
      try {
        // Paso 0: leyendo archivo
        const text = await file.text();
        // Paso 1: calculando potencia (parseGpx incluye haversine + power)
        setParsingStep(1);
        // Microyield para que el render del paso 1 entre antes del trabajo CPU.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const track = parseGpx(text);
        // Paso 2: segmentacion en bloques de 60s
        setParsingStep(2);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const result = segmentInto60SecondBlocks(track, validatedInputs);
        if (result.segments.length === 0) {
          throw new Error('No se pudo procesar la ruta: GPX demasiado corto.');
        }
        setSegments(result.segments);
        setMeta(result.meta);
        setPhase('ready');
        onProcessed(result.segments, result.meta);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido al procesar la ruta.';
        setErrorMessage(message);
        setPhase('error');
      }
    },
    [validatedInputs, onProcessed],
  );

  const handleReset = useCallback((): void => {
    setSegments(null);
    setMeta(null);
    setErrorMessage(null);
    setPhase('idle');
  }, []);

  return (
    <WizardStep maxWidth="max-w-3xl">
      <WizardStepHeading
        title="Tu ruta"
        subtitle="Sube el GPX que exportaste de Strava o Komoot. Lo procesamos en local."
      />
      {phase === 'idle' && (
        <>
          <FileDropzone
            onFile={(f) => void processFile(f)}
            onError={(msg) => {
              setErrorMessage(msg);
              setPhase('error');
            }}
          />
          <details className="group rounded-lg border border-gris-200 bg-white px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3 text-sm font-semibold text-gris-700 min-h-[36px]">
              <span className="inline-flex items-center gap-2">
                <MaterialIcon name="help_outline" size="small" className="text-turquesa-600" />
                ¿Cómo exporto un GPX desde Strava, Komoot o Garmin?
              </span>
              <MaterialIcon
                name="expand_more"
                size="small"
                className="text-gris-500 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-2 pt-2 border-t border-gris-100 text-sm text-gris-700 space-y-2">
              <div>
                <p className="font-semibold text-gris-800">Strava</p>
                <p>
                  Abre la actividad → menú con tres puntos → «Exportar GPX». También
                  funciona desde una ruta planificada en «Mis Rutas».
                </p>
              </div>
              <div>
                <p className="font-semibold text-gris-800">Komoot</p>
                <p>
                  Abre la ruta planificada → «Más» → «Exportar como GPX». La app
                  móvil también lo permite desde el menú compartir.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gris-800">Garmin Connect</p>
                <p>
                  Abre la actividad en la web → engranaje arriba a la derecha →
                  «Exportar archivo original» o «Exportar a GPX».
                </p>
              </div>
            </div>
          </details>
          <Card variant="tip" title="¿Qué pasa con tu archivo?" titleIcon="lock">
            <ul className="text-gris-700 space-y-1 list-disc pl-5">
              <li>Tu GPX no sale de tu dispositivo. Todo se procesa en tu navegador.</li>
              <li>
                Calculamos la potencia estimada en cada tramo de ~60 s con tus datos físicos.
              </li>
              <li>
                Asignamos cada tramo a una zona Z1-Z5{' '}
                {validatedInputs.hasHeartRateZones && <>(con su rango de BPM esperado) </>}
                para luego elegir canciones de Spotify con el BPM y la energía adecuados.
              </li>
            </ul>
          </Card>
        </>
      )}

      {phase === 'parsing' && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-gris-700">
            <MaterialIcon
              name="progress_activity"
              size="large"
              className="text-turquesa-600 animate-spin-slow"
            />
            <ol
              className="space-y-1 text-sm text-gris-700 min-w-[220px]"
              aria-live="polite"
            >
              {PARSING_STEPS.map((label, idx) => {
                const done = idx < parsingStep;
                const active = idx === parsingStep;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 transition-opacity ${active ? 'font-semibold text-gris-800' : done ? 'opacity-70' : 'opacity-40'}`}
                  >
                    <MaterialIcon
                      name={done ? 'check_circle' : active ? 'radio_button_checked' : 'radio_button_unchecked'}
                      size="small"
                      className={done ? 'text-turquesa-600' : active ? 'text-turquesa-600' : 'text-gris-400'}
                    />
                    {label}
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>
      )}

      {phase === 'error' && (
        <Card variant="info" title="No se pudo procesar el archivo" titleIcon="error_outline">
          <p className="text-gris-700 mb-4">
            {errorMessage ?? 'Ha ocurrido un error inesperado.'}
          </p>
          <Button variant="primary" iconLeft="refresh" onClick={handleReset}>
            Probar de nuevo
          </Button>
        </Card>
      )}

      {phase === 'ready' && segments && meta && (
        <>
          <Card title="Perfil de la ruta" titleIcon="terrain">
            {karvonenZones === undefined && (
              <p className="text-xs text-gris-500 mb-3 flex items-start gap-1.5">
                <MaterialIcon name="info" size="small" className="text-gris-400 mt-0.5" />
                Pasa el cursor sobre el gráfico para ver la potencia y zona de cada tramo.
              </p>
            )}
            {karvonenZones !== undefined && (
              <p className="text-xs text-gris-500 mb-3 flex items-start gap-1.5">
                <MaterialIcon name="info" size="small" className="text-gris-400 mt-0.5" />
                Pasa el cursor para ver potencia, zona y BPM esperados en cada tramo.
              </p>
            )}
            {karvonenZones !== undefined ? (
              <ElevationChart segments={segments} karvonenZones={karvonenZones} />
            ) : (
              <ElevationChart segments={segments} />
            )}
          </Card>
          {karvonenZones !== undefined ? (
            <RouteSummary meta={meta} karvonenZones={karvonenZones} />
          ) : (
            <RouteSummary meta={meta} />
          )}
        </>
      )}

      <FooterActions
        onBack={onBack}
        onReset={handleReset}
        onNext={onNext}
        canGoNext={phase === 'ready'}
        canReset={phase === 'ready' || phase === 'error'}
      />
    </WizardStep>
  );
}

interface FooterActionsProps {
  onBack: () => void;
  onReset: () => void;
  onNext: () => void;
  canGoNext: boolean;
  canReset: boolean;
}

function FooterActions({
  onBack,
  onReset,
  onNext,
  canGoNext,
  canReset,
}: FooterActionsProps): JSX.Element {
  // En mobile envolvemos en un sub-flex para que cuando hay 3 acciones el
  // `Siguiente` (fullWidth) tenga su propia fila debajo de Atras + Otro
  // archivo. Asi los tres botones respiran y ninguno queda apretado en 375px.
  return (
    <WizardStepFooter
      mobile={
        canReset ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between gap-2">
              <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
                Atrás
              </Button>
              <Button variant="secondary" iconLeft="refresh" onClick={onReset}>
                Otro archivo
              </Button>
            </div>
            <Button
              variant="primary"
              iconRight="arrow_forward"
              disabled={!canGoNext}
              onClick={onNext}
              fullWidth
            >
              Siguiente: Música
            </Button>
          </div>
        ) : (
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
              Siguiente: Música
            </Button>
          </>
        )
      }
      desktop={
        <>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          {canReset && (
            <Button variant="secondary" iconLeft="refresh" onClick={onReset}>
              Subir otra ruta
            </Button>
          )}
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={!canGoNext}
            onClick={onNext}
          >
            Siguiente: Música
          </Button>
        </>
      }
    />
  );
}
