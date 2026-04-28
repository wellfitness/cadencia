import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  EMPTY_USER_INPUTS,
  loadUserInputsFromSession,
  saveUserInputsToSession,
  validateUserInputs,
  type UserInputsRaw,
} from '@core/user';
import type { ClassifiedSegment, EditableSessionPlan, RouteMeta } from '@core/segmentation';
import { EMPTY_PREFERENCES, type MatchPreferences, type MatchedSegment } from '@core/matching';
import type { Track } from '@core/tracks';
import { Stepper, type StepperStep } from '@ui/components/Stepper';
import { Card } from '@ui/components/Card';
import { Logo } from '@ui/components/Logo';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import type { RouteSourceChoice } from '@ui/components/SourceSelector';
import { Landing } from '@ui/pages/Landing';
import { SourceTypeStep } from '@ui/pages/SourceTypeStep';
import { UserDataStep } from '@ui/pages/UserDataStep';
import { RouteStep } from '@ui/pages/RouteStep';
import { MusicStep } from '@ui/pages/MusicStep';
import { ResultStep } from '@ui/pages/ResultStep';
import { SessionTVMode } from '@ui/pages/SessionTVMode';
import { userInputsReducer } from '@ui/state/userInputsReducer';
import { loadWizardState, saveWizardState, type RouteSourceType } from '@ui/state/wizardStorage';

const STEPS: readonly StepperStep[] = [
  { label: 'Tipo', icon: 'tune' },
  { label: 'Datos', icon: 'person' },
  { label: 'Ruta', icon: 'route' },
  { label: 'Música', icon: 'music_note' },
  { label: 'Resultado', icon: 'playlist_play' },
] as const;

const STEP_TYPE = 0;
const STEP_DATA = 1;
const STEP_ROUTE = 2;
const STEP_MUSIC = 3;
const STEP_RESULT = 4;

export function App(): JSX.Element {
  // Carga lazy del state del wizard desde sessionStorage. Necesario para
  // sobrevivir al redirect de Spotify en /callback (full page navigation).
  const persisted = useState(() => loadWizardState())[0];

  // Vista activa: la landing es la pantalla de inicio para usuarios nuevos
  // o sesiones limpias. Si hay progreso persistido (vuelta de OAuth Spotify
  // o refresh a media tarea) saltamos directos al wizard para no interrumpir.
  const hasPersistedProgress =
    persisted !== null &&
    (persisted.currentStep > 0 ||
      persisted.completedSteps.length > 0 ||
      persisted.sourceType !== undefined);
  const [view, setView] = useState<'landing' | 'wizard'>(
    hasPersistedProgress ? 'wizard' : 'landing',
  );

  const [currentStep, setCurrentStep] = useState<number>(persisted?.currentStep ?? STEP_TYPE);
  const [completedSteps, setCompletedSteps] = useState<readonly number[]>(
    persisted?.completedSteps ?? [],
  );

  // State del usuario lifteado aqui para que pasos posteriores (Ruta, Resultado)
  // puedan leerlo y, en el caso de Resultado, editarlo en linea sin volver atras.
  const [inputs, dispatch] = useReducer(
    userInputsReducer,
    null,
    (): UserInputsRaw => loadUserInputsFromSession() ?? EMPTY_USER_INPUTS,
  );

  // currentYear cacheado en una sesion (no cambia significativamente durante el uso normal).
  const [currentYear] = useState(() => new Date().getFullYear());

  // Persistencia debounceada en sessionStorage
  useEffect(() => {
    const id = setTimeout(() => {
      saveUserInputsToSession(inputs);
    }, 300);
    return () => clearTimeout(id);
  }, [inputs]);

  // Origen de la ruta y plan de sesion editable (rama indoor cycling).
  const [sourceType, setSourceType] = useState<RouteSourceType | null>(
    persisted?.sourceType ?? null,
  );
  const [sessionPlan, setSessionPlan] = useState<EditableSessionPlan | null>(
    persisted?.sessionPlan ?? null,
  );

  // La validacion depende del sourceType: en modo 'session' relajamos las
  // reglas (peso/bici opcionales, sin requisito de FTP/FC/birthYear).
  const validationMode = sourceType === 'session' ? 'session' : 'gpx';
  const validation = useMemo(
    () => validateUserInputs(inputs, currentYear, validationMode),
    [inputs, currentYear, validationMode],
  );

  // Estado de la ruta procesada (vive en App para que la fase 4 "Resultado"
  // pueda leerlo sin volver atras). Inicializado desde sessionStorage si el
  // usuario vuelve del OAuth de Spotify.
  const [routeSegments, setRouteSegments] = useState<readonly ClassifiedSegment[] | null>(
    persisted?.routeSegments ?? null,
  );
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(persisted?.routeMeta ?? null);

  // Modo TV: overlay activable solo cuando hay sessionPlan
  const [tvModeActive, setTvModeActive] = useState(false);

  // Estado de la lista de musica generada (preferencias + segmentos casados).
  const [matchedList, setMatchedList] = useState<readonly MatchedSegment[] | null>(
    persisted?.matchedList ?? null,
  );
  const [musicPreferences, setMusicPreferences] = useState<MatchPreferences>(
    persisted?.musicPreferences ?? EMPTY_PREFERENCES,
  );

  // Catalogo activo del paso Musica (puede incluir uploads del usuario). Vive
  // solo en memoria — no se persiste en sessionStorage para no inflarlo con
  // CSVs grandes. Si es null, ResultStep cae al subset de nativos.
  const [livePool, setLivePool] = useState<readonly Track[] | null>(null);

  // Persistir el wizard state en sessionStorage en cada cambio.
  useEffect(() => {
    saveWizardState({
      currentStep,
      completedSteps,
      routeSegments,
      routeMeta,
      matchedList,
      musicPreferences,
      ...(sourceType !== null ? { sourceType } : {}),
      ...(sessionPlan !== null ? { sessionPlan } : {}),
    });
  }, [
    currentStep,
    completedSteps,
    routeSegments,
    routeMeta,
    matchedList,
    musicPreferences,
    sourceType,
    sessionPlan,
  ]);

  const handleNext = (): void => {
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = (): void => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index: number): void => {
    if (completedSteps.includes(index) && index !== currentStep) {
      setCurrentStep(index);
    }
  };

  const handleRouteProcessed = (segments: ClassifiedSegment[], meta: RouteMeta): void => {
    setRouteSegments(segments);
    setRouteMeta(meta);
  };

  const handleSourceTypeSelect = (next: RouteSourceChoice): void => {
    if (sourceType !== next) {
      // Si cambia la rama, limpiamos los datos derivados de la rama anterior
      setRouteSegments(null);
      setRouteMeta(null);
      setMatchedList(null);
      // Si dejamos la rama indoor, limpiamos el plan
      if (next !== 'session') {
        setSessionPlan(null);
      }
    }
    setSourceType(next);
    // Avance automatico al paso Datos: el usuario no necesita un boton extra
    setCompletedSteps((prev) => (prev.includes(STEP_TYPE) ? prev : [...prev, STEP_TYPE]));
    setCurrentStep(STEP_DATA);
  };

  const handleSessionPlanChange = (plan: EditableSessionPlan | null): void => {
    setSessionPlan(plan);
  };

  const handleMatched = (
    matched: MatchedSegment[],
    preferences: MatchPreferences,
    tracks: readonly Track[],
  ): void => {
    setMatchedList(matched);
    setMusicPreferences(preferences);
    setLivePool(tracks);
    handleNext();
  };

  const handleMatchedChange = (
    matched: MatchedSegment[],
    preferences: MatchPreferences,
  ): void => {
    setMatchedList(matched);
    setMusicPreferences(preferences);
  };

  // Modo TV pantalla completa: solo accesible si hay sessionPlan.
  if (tvModeActive && sessionPlan !== null && validation.ok) {
    return (
      <SessionTVMode
        plan={sessionPlan}
        validatedInputs={validation.data}
        onClose={() => setTvModeActive(false)}
      />
    );
  }

  // Landing: pantalla de inicio. Al pulsar "Empezar" entramos al wizard
  // por el paso Tipo (STEP_TYPE = 0).
  if (view === 'landing') {
    return <Landing onStart={() => setView('wizard')} />;
  }

  return (
    <div className="min-h-full flex flex-col bg-white">
      <Header />
      <div className="border-b border-gris-200 bg-gris-50">
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      <main className="flex-1">
        {currentStep === STEP_TYPE && (
          <SourceTypeStep onSelect={handleSourceTypeSelect} />
        )}

        {currentStep === STEP_DATA && sourceType !== null && (
          <UserDataStep
            inputs={inputs}
            dispatch={dispatch}
            validation={validation}
            currentYear={currentYear}
            onBack={handleBack}
            onNext={handleNext}
            mode={sourceType === 'session' ? 'session' : 'gpx'}
          />
        )}
        {currentStep === STEP_DATA && sourceType === null && (
          <NeedsTypeMessage onBack={handleBack} />
        )}

        {currentStep === STEP_ROUTE && validation.ok && sourceType !== null && (
          <RouteStep
            validatedInputs={validation.data}
            sourceType={sourceType}
            initialSessionPlan={sessionPlan ?? undefined}
            onProcessed={handleRouteProcessed}
            onSessionPlanChange={handleSessionPlanChange}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}
        {currentStep === STEP_ROUTE && (!validation.ok || sourceType === null) && (
          <NeedsDataMessage onBack={handleBack} />
        )}

        {currentStep === STEP_MUSIC && routeSegments !== null && routeMeta !== null && (
          <MusicStep
            segments={routeSegments}
            meta={routeMeta}
            onMatched={handleMatched}
            onBack={handleBack}
            initialPreferences={musicPreferences}
            crossZoneMode={sourceType === 'session' ? 'discrete' : 'overlap'}
          />
        )}
        {currentStep === STEP_MUSIC && (routeSegments === null || routeMeta === null) && (
          <NeedsRouteMessage onBack={handleBack} />
        )}

        {currentStep === STEP_RESULT &&
          validation.ok &&
          routeSegments !== null &&
          routeMeta !== null &&
          matchedList !== null && (
            <ResultStep
              inputs={inputs}
              dispatch={dispatch}
              validation={validation}
              validatedInputs={validation.data}
              currentYear={currentYear}
              routeSegments={routeSegments}
              routeMeta={routeMeta}
              matched={matchedList}
              preferences={musicPreferences}
              tracks={livePool}
              onMatchedChange={handleMatchedChange}
              onBack={handleBack}
              {...(sourceType === 'session'
                ? {
                    mode: 'session' as const,
                    crossZoneMode: 'discrete' as const,
                    onEnterTVMode: () => setTvModeActive(true),
                  }
                : {})}
            />
          )}
        {currentStep === STEP_RESULT &&
          (!validation.ok ||
            routeSegments === null ||
            routeMeta === null ||
            matchedList === null) && <NeedsMusicMessage onBack={handleBack} />}
      </main>

      <Footer />
    </div>
  );
}

function NeedsTypeMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Elige primero el tipo de entrenamiento" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Necesitamos saber si vas a entrenar con una ruta GPX o una sesión indoor para
          adaptarnos a ti.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Tipo
        </button>
      </Card>
    </div>
  );
}

function NeedsDataMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Revisa tus datos" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Vuelve al paso anterior para introducir los datos que necesitamos.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Datos
        </button>
      </Card>
    </div>
  );
}

function NeedsRouteMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Define tu ruta o sesión antes" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Para elegir la música necesitamos saber qué zonas tendrá tu entrenamiento.
          Vuelve al paso de Ruta para subir un GPX o construir una sesión indoor.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Ruta
        </button>
      </Card>
    </div>
  );
}

function NeedsMusicMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Genera la lista antes" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Para crear la lista en Spotify primero tienes que pasar por el paso de música.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Música
        </button>
      </Card>
    </div>
  );
}

function Header(): JSX.Element {
  return (
    <header className="border-b border-gris-200 bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 flex items-center gap-3">
        <Logo variant="full" size="md" />
      </div>
    </header>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="border-t border-gris-200 bg-gris-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs md:text-sm text-gris-500">
        <p className="flex items-center gap-1.5">
          <MaterialIcon name="lock" size="small" className="text-gris-400" />
          Sin cuentas, sin cookies, sin servidores. Todo corre en tu dispositivo.
        </p>
        <nav className="flex items-center gap-3">
          <a
            href="/privacy.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Privacidad
          </a>
          <span aria-hidden className="text-gris-300">·</span>
          <a
            href="/terms.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Términos
          </a>
          <span aria-hidden className="text-gris-300">·</span>
          <a
            href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Licencia
          </a>
        </nav>
      </div>
    </footer>
  );
}
