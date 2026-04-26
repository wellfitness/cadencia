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
import { userInputsReducer } from '@ui/state/userInputsReducer';

const STEPS: readonly StepperStep[] = [
  { label: 'Datos', icon: 'person' },
  { label: 'Ruta', icon: 'route' },
  { label: 'Música', icon: 'music_note' },
  { label: 'Resultado', icon: 'playlist_play' },
] as const;

export function App(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<readonly number[]>([]);

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
  // pueda leerlo sin volver atras).
  const [routeSegments, setRouteSegments] = useState<readonly ClassifiedSegment[] | null>(null);
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(null);

  // Estado de la lista de musica generada (preferencias + segmentos casados).
  // Se setea cuando el usuario pulsa Siguiente en MusicStep.
  const [, setMatchedList] = useState<readonly MatchedSegment[] | null>(null);
  const [musicPreferences, setMusicPreferences] = useState<MatchPreferences>(EMPTY_PREFERENCES);

  const handleNext = (): void => {
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = (): void => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
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

  return (
    <div className="min-h-full flex flex-col bg-white">
      <Header />
      <div className="border-b border-gris-200 bg-gris-50">
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <Stepper steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />
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
        {currentStep > 2 && (
          <PlaceholderStep
            label={STEPS[currentStep]?.label ?? 'Próximo paso'}
            icon={STEPS[currentStep]?.icon ?? 'construction'}
          />
        )}
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
        <a
          href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
        >
          Licencia PolyForm Noncommercial 1.0.0
        </a>
      </div>
    </footer>
  );
}

interface PlaceholderStepProps {
  label: string;
  icon: string;
}

function PlaceholderStep({ label, icon }: PlaceholderStepProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title={`Paso "${label}"`} titleIcon={icon}>
        <p className="text-gris-700">
          Este paso se construye en una fase posterior. Por ahora solo el formulario de datos del
          usuario está activo.
        </p>
      </Card>
    </div>
  );
}
