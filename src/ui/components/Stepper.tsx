import { MaterialIcon } from './MaterialIcon';

export interface StepperStep {
  label: string;
  icon: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  currentStep: number;
  completedSteps: readonly number[];
  className?: string;
}

/**
 * Stepper horizontal accesible. Cada paso muestra icono + label.
 * - Paso completado: check turquesa
 * - Paso actual: bordeado y resaltado (aria-current="step")
 * - Pasos futuros: gris
 */
export function Stepper({
  steps,
  currentStep,
  completedSteps,
  className = '',
}: StepperProps): JSX.Element {
  return (
    <nav
      aria-label="Progreso del flujo"
      className={`w-full overflow-x-auto ${className}`.trim()}
    >
      <ol className="flex items-center justify-between gap-2 min-w-max md:min-w-0">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(idx);
          const isCurrent = idx === currentStep;
          return (
            <li key={step.label} className="flex items-center gap-2 flex-1">
              <StepIndicator
                index={idx}
                step={step}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
              />
              {idx < steps.length - 1 && (
                <span
                  className={`hidden sm:block flex-1 h-0.5 ${
                    isCompleted ? 'bg-turquesa-600' : 'bg-gris-200'
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepIndicatorProps {
  index: number;
  step: StepperStep;
  isCompleted: boolean;
  isCurrent: boolean;
}

function StepIndicator({ index, step, isCompleted, isCurrent }: StepIndicatorProps): JSX.Element {
  const circleBase =
    'flex items-center justify-center rounded-full w-10 h-10 md:w-12 md:h-12 border-2 transition-colors duration-200';
  const circleState = isCompleted
    ? 'bg-turquesa-600 border-turquesa-700 text-white'
    : isCurrent
      ? 'bg-white border-turquesa-600 text-turquesa-600'
      : 'bg-gris-50 border-gris-200 text-gris-400';

  const labelState = isCurrent
    ? 'text-turquesa-700 font-semibold'
    : isCompleted
      ? 'text-gris-700 font-medium'
      : 'text-gris-400 font-medium';

  return (
    <div
      className="flex items-center gap-2"
      {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
    >
      <span className={`${circleBase} ${circleState}`}>
        {isCompleted ? (
          <MaterialIcon name="check" size="medium" />
        ) : (
          <MaterialIcon name={step.icon} size="medium" />
        )}
        <span className="sr-only">Paso {index + 1}</span>
      </span>
      <span className={`text-sm md:text-base whitespace-nowrap ${labelState}`}>{step.label}</span>
    </div>
  );
}
