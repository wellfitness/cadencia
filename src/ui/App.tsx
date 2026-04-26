import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  EMPTY_USER_INPUTS,
  loadUserInputsFromSession,
  saveUserInputsToSession,
  validateUserInputs,
  type UserInputsRaw,
} from '@core/user';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import { EMPTY_PREFERENCES, type MatchPreferences, type MatchedSegment } from '@core/matching';
import { Stepper, type StepperStep } from '@ui/components/Stepper';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { UserDataStep } from '@ui/pages/UserDataStep';
import { RouteStep } from '@ui/pages/RouteStep';
import { MusicStep } from '@ui/pages/MusicStep';
import { ResultStep } from '@ui/pages/ResultStep';
import { userInputsReducer } from '@ui/state/userInputsReducer';
import { loadWizardState, saveWizardState } from '@ui/state/wizardStorage';

const STEPS: readonly StepperStep[] = [
  { label: 'Datos', icon: 'person' },
  { label: 'Ruta', icon: 'route' },
  { label: 'Música', icon: 'music_note' },
  { label: 'Resultado', icon: 'playlist_play' },
] as const;

export function App(): JSX.Element {
  // Carga lazy del state del wizard desde sessionStorage. Necesario para
  // sobrevivir al redirect de Spotify en /callback (full page navigation).
  const persisted = useState(() => loadWizardState())[0];

  const [currentStep, setCurrentStep] = useState<number>(persisted?.currentStep ?? 0);
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

  const validation = useMemo(
    () => validateUserInputs(inputs, currentYear),
    [inputs, currentYear],
  );

  // Estado de la ruta procesada (vive en App para que la fase 4 "Resultado"
  // pueda leerlo sin volver atras). Inicializado desde sessionStorage si el
  // usuario vuelve del OAuth de Spotify.
  const [routeSegments, setRouteSegments] = useState<readonly ClassifiedSegment[] | null>(
    persisted?.routeSegments ?? null,
  );
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(persisted?.routeMeta ?? null);

  // Estado de la lista de musica generada (preferencias + segmentos casados).
  // Se setea cuando el usuario pulsa Siguiente en MusicStep y se actualiza
  // desde ResultStep si el usuario edita inputs/preferencias o sustituye temas.
  const [matchedList, setMatchedList] = useState<readonly MatchedSegment[] | null>(
    persisted?.matchedList ?? null,
  );
  const [musicPreferences, setMusicPreferences] = useState<MatchPreferences>(
    persisted?.musicPreferences ?? EMPTY_PREFERENCES,
  );

  // Persistir el wizard state en sessionStorage en cada cambio. Necesario para
  // que el redirect OAuth de Spotify (que hace full page navigation) no
  // pierda el progreso.
  useEffect(() => {
    saveWizardState({
      currentStep,
      completedSteps,
      routeSegments,
      routeMeta,
      matchedList,
      musicPreferences,
    });
  }, [currentStep, completedSteps, routeSegments, routeMeta, matchedList, musicPreferences]);

  const handleNext = (): void => {
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = (): void => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index: number): void => {
    // Solo permitir navegar a pasos completados (no saltar adelante).
    if (completedSteps.includes(index) && index !== currentStep) {
      setCurrentStep(index);
    }
  };

  const handleRouteProcessed = (segments: ClassifiedSegment[], meta: RouteMeta): void => {
    setRouteSegments(segments);
    setRouteMeta(meta);
  };

  const handleMatched = (
    matched: MatchedSegment[],
    preferences: MatchPreferences,
  ): void => {
    setMatchedList(matched);
    setMusicPreferences(preferences);
    handleNext();
  };

  const handleMatchedChange = (
    matched: MatchedSegment[],
    preferences: MatchPreferences,
  ): void => {
    setMatchedList(matched);
    setMusicPreferences(preferences);
  };

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
        {currentStep === 0 && (
          <UserDataStep
            inputs={inputs}
            dispatch={dispatch}
            validation={validation}
            currentYear={currentYear}
            onNext={handleNext}
          />
        )}
        {currentStep === 1 && validation.ok && (
          <RouteStep
            validatedInputs={validation.data}
            onProcessed={handleRouteProcessed}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}
        {currentStep === 1 && !validation.ok && (
          <NeedsDataMessage onBack={handleBack} />
        )}
        {currentStep === 2 && routeSegments !== null && routeMeta !== null && (
          <MusicStep
            segments={routeSegments}
            meta={routeMeta}
            onMatched={handleMatched}
            onBack={handleBack}
            initialPreferences={musicPreferences}
          />
        )}
        {currentStep === 2 && (routeSegments === null || routeMeta === null) && (
          <NeedsRouteMessage onBack={handleBack} />
        )}
        {currentStep === 3 &&
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
              onMatchedChange={handleMatchedChange}
              onBack={handleBack}
            />
          )}
        {currentStep === 3 &&
          (!validation.ok ||
            routeSegments === null ||
            routeMeta === null ||
            matchedList === null) && <NeedsMusicMessage onBack={handleBack} />}
      </main>

      <Footer />
    </div>
  );
}

interface NeedsDataMessageProps {
  onBack: () => void;
}

function NeedsDataMessage({ onBack }: NeedsDataMessageProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Necesitamos tus datos primero" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Vuelve al paso anterior para introducir tu peso y FTP o frecuencia cardíaca.
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
      <Card variant="info" title="Sube tu ruta antes" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Para elegir la música necesitamos saber qué zonas tendrá tu ruta. Vuelve a
          subir tu GPX en el paso anterior.
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
        <MaterialIcon
          name="directions_bike"
          size="large"
          className="text-turquesa-600"
          decorative
        />
        <div>
          <h1 className="font-display text-turquesa-600 text-2xl md:text-3xl leading-none">
            Vatios con Ritmo
          </h1>
          <p className="text-xs md:text-sm text-gris-500 mt-1">
            Tu ruta GPX, tu música al ritmo de tu potencia.
          </p>
        </div>
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

