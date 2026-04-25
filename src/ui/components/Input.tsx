import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  helper?: string;
  error?: string;
  unit?: string;
  /** Si el label se debe ocultar visualmente (sigue presente para screen readers). */
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helper,
    error,
    unit,
    hideLabel = false,
    className = '',
    type = 'text',
    inputMode,
    required = false,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = `input-${reactId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const describedBy =
    [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(' ') || undefined;

  // Para inputs numericos, modo numerico por defecto en movil (teclado correcto)
  const effectiveInputMode = inputMode ?? (type === 'number' ? 'numeric' : undefined);

  const baseInputClasses =
    'block w-full rounded-lg border-2 bg-white px-3 py-2.5 text-base text-gris-800 placeholder-gris-400 transition-colors duration-200 focus:outline-none disabled:bg-gris-50 disabled:text-gris-400 disabled:cursor-not-allowed min-h-[44px] md:min-h-[48px]';
  const stateClasses = error
    ? 'border-error text-error focus:border-error'
    : 'border-gris-300 focus:border-turquesa-600';

  return (
    <div className={`w-full ${className}`.trim()}>
      <label
        htmlFor={inputId}
        className={`block text-sm font-semibold text-gris-700 mb-1.5 ${hideLabel ? 'sr-only' : ''}`}
      >
        {label}
        {required && (
          <span className="text-rosa-600 ml-0.5" aria-label="obligatorio">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required}
          required={required}
          className={`${baseInputClasses} ${stateClasses} ${unit ? 'pr-12' : ''}`.trim()}
          {...(effectiveInputMode ? { inputMode: effectiveInputMode } : {})}
          {...rest}
        />
        {unit && (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-gris-500"
            aria-hidden
          >
            {unit}
          </span>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-error font-medium">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="mt-1.5 text-sm text-gris-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
});
