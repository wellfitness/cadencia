import { MaterialIcon } from './MaterialIcon';

export interface StepperStep {
  label: string;
  icon: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  currentStep: number;
  completedSteps: readonly number[];
  /** Si se provee, los pasos navegables (current y completed) se renderizan como botones clicables. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Stepper horizontal accesible. Cada paso muestra icono + label.
 * - Paso completado: check turquesa, clickable si onStepClick.
 * - Paso actual: bordeado y resaltado (aria-current="step").
 * - Pasos futuros: gris, NO clickable (evita saltar el flow sin completar).
 */
export function Stepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
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
          // Es navegable si esta completado o si es el actual (clic en actual no hace nada).
          // Pasos futuros NO son navegables (rompen el flow del wizard).
          const isNavigable = isCompleted || isCurrent;
          return (
            <li key={step.label} className="flex items-center gap-2 flex-1">
              <StepIndicator
                index={idx}
                step={step}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                {...(onStepClick && isNavigable && !isCurrent
                  ? { onClick: () => onStepClick(idx) }
                  : {})}
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
  /** Si se provee, el paso es un boton clicable. */
  onClick?: () => void;
}

function StepIndicator({
  index,
  step,
  isCompleted,
  isCurrent,
  onClick,
}: StepIndicatorProps): JSX.Element {
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

  const innerContent = (
    <>
      <span className={`${circleBase} ${circleState}`}>
        {isCompleted ? (
          <MaterialIcon name="check" size="medium" />
        ) : (
          <MaterialIcon name={step.icon} size="medium" />
        )}
        <span className="sr-only">Paso {index + 1}</span>
      </span>
      <span className={`text-sm md:text-base whitespace-nowrap ${labelState}`}>{step.label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity duration-200 cursor-pointer min-h-[44px]"
        aria-label={`Volver al paso ${index + 1}: ${step.label}`}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2"
      {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
    >
      {innerContent}
    </div>
  );
}
