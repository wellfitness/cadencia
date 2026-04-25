import { useState } from 'react';
import { Stepper, type StepperStep } from '@ui/components/Stepper';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { UserDataStep } from '@ui/pages/UserDataStep';

const STEPS: readonly StepperStep[] = [
  { label: 'Datos', icon: 'person' },
  { label: 'Ruta', icon: 'route' },
  { label: 'Música', icon: 'music_note' },
  { label: 'Resultado', icon: 'playlist_play' },
] as const;

export function App(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<readonly number[]>([]);

  const handleNext = (): void => {
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
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
        {currentStep === 0 ? (
          <UserDataStep onNext={handleNext} />
        ) : (
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
            Tu ruta GPX, tu playlist al ritmo de tu potencia.
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
