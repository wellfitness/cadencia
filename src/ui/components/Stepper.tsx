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
  // Progreso 0..1 para la barra mobile. currentStep+1 porque el indice de
  // paso actual ya cuenta como "en marcha".
  const totalSteps = steps.length;
  const progressRatio = totalSteps > 0 ? (currentStep + 1) / totalSteps : 0;
  const progressPct = Math.round(progressRatio * 100);
  const currentLabel = steps[currentStep]?.label ?? '';
  return (
    <nav
      aria-label="Progreso del flujo"
      className={`w-full ${className}`.trim()}
    >
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(idx);
          const isCurrent = idx === currentStep;
          // Es navegable si esta completado o si es el actual (clic en actual no hace nada).
          // Pasos futuros NO son navegables (rompen el flow del wizard).
          const isNavigable = isCompleted || isCurrent;
          return (
            <li key={step.label} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
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
      {/* Indicador textual del paso actual visible solo en mobile, donde
          los labels de cada step se ocultan para que las 5 burbujas quepan
          en 375px sin overflow horizontal. */}
      <div
        className="sm:hidden mt-2 flex items-center gap-2"
      >
        <div
          className="flex-1 h-1 rounded-full bg-gris-200 overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full bg-turquesa-600 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-gris-700 tabular-nums whitespace-nowrap font-semibold">
          {currentStep + 1}/{totalSteps} · {currentLabel}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        Paso {currentStep + 1} de {totalSteps}: {currentLabel}
      </p>
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
  // Mobile: circulos compactos (40px) sin label inline para que los 5 pasos
  // quepan en 375px sin overflow horizontal. El label visible vive en la
  // tira de progreso textual debajo (ver Stepper).
  const circleBase =
    'flex items-center justify-center rounded-full w-9 h-9 md:w-12 md:h-12 border-2 transition-colors duration-200 shrink-0';
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

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex items-center gap-2 rounded-full hover:opacity-90 transition-opacity duration-200 cursor-pointer min-h-[44px]"
        aria-label={`Volver al paso ${index + 1}: ${step.label}`}
      >
        <span className={`${circleBase} ${circleState}`}>
          {isCompleted ? (
            <MaterialIcon name="check" size="medium" />
          ) : (
            <MaterialIcon name={step.icon} size="medium" />
          )}
          <span className="sr-only">Paso {index + 1}</span>
        </span>
        <span
          className={`hidden sm:inline text-sm md:text-base whitespace-nowrap ${labelState} group-hover:underline underline-offset-4`}
        >
          {step.label}
        </span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 min-h-[44px]"
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
      <span
        className={`hidden sm:inline text-sm md:text-base whitespace-nowrap ${labelState}`}
      >
        {step.label}
      </span>
    </div>
  );
}
