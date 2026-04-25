import { useEffect, useMemo, useReducer, useState, type ChangeEvent } from 'react';
import {
  EMPTY_USER_INPUTS,
  VALIDATION_LIMITS,
  clearUserInputsFromSession,
  describeValidationError,
  loadUserInputsFromSession,
  saveUserInputsToSession,
  validateUserInputs,
  type UserInputsRaw,
  type ValidationError,
  type ValidationResult,
} from '@core/user';
import { calculateMaxHeartRateGulati } from '@core/physiology';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { Input } from '@ui/components/Input';
import { MaterialIcon } from '@ui/components/MaterialIcon';

type FieldKey = keyof UserInputsRaw;

type Action =
  | { type: 'SET'; field: FieldKey; value: number | null }
  | { type: 'RESET' };

function reducer(state: UserInputsRaw, action: Action): UserInputsRaw {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.field]: action.value };
    case 'RESET':
      return EMPTY_USER_INPUTS;
  }
}

function parseNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function numberToInputValue(n: number | null): string {
  return n === null ? '' : String(n);
}

export interface UserDataStepProps {
  onNext: () => void;
  currentYear?: number;
}

export function UserDataStep({
  onNext,
  currentYear = new Date().getFullYear(),
}: UserDataStepProps): JSX.Element {
  // Carga inicial perezosa desde sessionStorage
  const [inputs, dispatch] = useReducer(
    reducer,
    null,
    (): UserInputsRaw => loadUserInputsFromSession() ?? EMPTY_USER_INPUTS,
  );

  // Para mostrar errores de "campo vacio" solo despues de un intento de submit
  const [showAllErrors, setShowAllErrors] = useState(false);

  // Persistencia debounceada
  useEffect(() => {
    const id = setTimeout(() => {
      saveUserInputsToSession(inputs);
    }, 300);
    return () => clearTimeout(id);
  }, [inputs]);

  const validation = useMemo<ValidationResult>(
    () => validateUserInputs(inputs, currentYear),
    [inputs, currentYear],
  );

  // FC max estimada en vivo (Gulati) cuando hay birthYear y no hay maxHeartRate
  const estimatedMaxHr: number | null = useMemo(() => {
    if (inputs.birthYear === null || inputs.maxHeartRate !== null) return null;
    const limits = VALIDATION_LIMITS.birthYear;
    const max = currentYear - limits.maxOffsetFromCurrent;
    if (inputs.birthYear < limits.min || inputs.birthYear > max) return null;
    return calculateMaxHeartRateGulati(currentYear - inputs.birthYear);
  }, [inputs.birthYear, inputs.maxHeartRate, currentYear]);

  const setField = (field: FieldKey) => (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET', field, value: parseNumberInput(e.target.value) });
  };

  const handleCancel = (): void => {
    dispatch({ type: 'RESET' });
    clearUserInputsFromSession();
    setShowAllErrors(false);
  };

  const handleSubmit = (): void => {
    if (validation.ok) {
      onNext();
    } else {
      setShowAllErrors(true);
    }
  };

  // Errores por campo (filtrar lo relevante)
  const errors: ValidationError[] = validation.ok ? [] : validation.errors;
  const errorFor = (codes: ValidationError['code'][]): string | undefined => {
    const found = errors.find((e) => codes.includes(e.code));
    if (!found) return undefined;
    // Errores de "campo vacio" requeridos solo se muestran tras intentar submit
    if (found.code === 'WEIGHT_REQUIRED' && !showAllErrors) return undefined;
    return describeValidationError(found);
  };

  const globalNeedHrError = errors.find((e) => e.code === 'NEED_FTP_OR_HR_DATA');
  const globalRestingError = errors.find((e) => e.code === 'RESTING_GE_MAX_HR');

  // Helper para que el spread no choque con exactOptionalPropertyTypes:
  // siempre devuelve uno de los dos objetos completos, sin claves undefined.
  const fieldFeedback = (
    codes: ValidationError['code'][],
    helper: string,
  ): { error: string } | { helper: string } => {
    const message = errorFor(codes);
    return message !== undefined ? { error: message } : { helper };
  };

  const submitDisabled = !validation.ok;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10 space-y-4 md:space-y-6 pb-32 md:pb-10">
      <header className="space-y-2">
        <h2 className="text-ds-h2 md:text-ds-h1 font-display text-gris-800">Tus datos</h2>
        <p className="text-gris-600">
          Necesitamos tu peso y o bien tu FTP, o tu FC máxima/año de nacimiento para estimar las
          zonas de intensidad de la ruta.
        </p>
      </header>

      <Card title="Datos básicos" titleIcon="person">
        <Input
          label="Peso corporal"
          type="number"
          step="0.1"
          min={VALIDATION_LIMITS.weightKg.min}
          max={VALIDATION_LIMITS.weightKg.max}
          unit="kg"
          required
          value={numberToInputValue(inputs.weightKg)}
          onChange={setField('weightKg')}
          {...fieldFeedback(
            ['WEIGHT_REQUIRED', 'WEIGHT_OUT_OF_RANGE'],
            'Tu peso corporal sin equipamiento.',
          )}
        />
      </Card>

      <Card variant="tip" title="¿FTP o frecuencia cardíaca?" titleIcon="lightbulb">
        <p className="text-gris-700">
          Si conoces tu <strong>FTP</strong> (potencia umbral en vatios), las zonas se calculan con
          el método Coggan. Si no, usamos tu <strong>FC máxima</strong> y FC en reposo (método
          Karvonen). Necesitas <em>una de las dos</em>.
        </p>
      </Card>

      <Card title="Potencia (recomendado si la tienes)" titleIcon="bolt">
        <Input
          label="FTP"
          type="number"
          step="1"
          min={VALIDATION_LIMITS.ftpWatts.min}
          max={VALIDATION_LIMITS.ftpWatts.max}
          unit="W"
          value={numberToInputValue(inputs.ftpWatts)}
          onChange={setField('ftpWatts')}
          {...fieldFeedback(
            ['FTP_OUT_OF_RANGE'],
            'Functional Threshold Power. Si la dejas vacía, usaremos tu FC.',
          )}
        />
      </Card>

      <Card title="Frecuencia cardíaca" titleIcon="favorite">
        <div className="space-y-4">
          <Input
            label="FC máxima"
            type="number"
            step="1"
            min={VALIDATION_LIMITS.maxHeartRate.min}
            max={VALIDATION_LIMITS.maxHeartRate.max}
            unit="bpm"
            value={numberToInputValue(inputs.maxHeartRate)}
            onChange={setField('maxHeartRate')}
            {...fieldFeedback(
              ['MAX_HR_OUT_OF_RANGE'],
              'Tu FC máxima medida en pulsómetro o en prueba de esfuerzo.',
            )}
          />
          <Input
            label="FC en reposo"
            type="number"
            step="1"
            min={VALIDATION_LIMITS.restingHeartRate.min}
            max={VALIDATION_LIMITS.restingHeartRate.max}
            unit="bpm"
            value={numberToInputValue(inputs.restingHeartRate)}
            onChange={setField('restingHeartRate')}
            {...fieldFeedback(
              ['RESTING_HR_OUT_OF_RANGE'],
              'Tu FC en reposo nada más despertar, antes de levantarte.',
            )}
          />

          <details
            className="group rounded-lg border border-gris-200 bg-gris-50 open:bg-white open:border-turquesa-300"
            open={inputs.birthYear !== null && inputs.maxHeartRate === null}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gris-700 select-none min-h-[44px]">
              <MaterialIcon
                name="expand_more"
                size="small"
                className="text-gris-500 transition-transform duration-200 group-open:rotate-180"
              />
              ¿No conoces tu FC máxima? Te la estimamos por edad
            </summary>
            <div className="px-3 pb-3 space-y-3 border-t border-gris-200">
              <Input
                label="Año de nacimiento"
                type="number"
                step="1"
                min={VALIDATION_LIMITS.birthYear.min}
                max={currentYear - VALIDATION_LIMITS.birthYear.maxOffsetFromCurrent}
                value={numberToInputValue(inputs.birthYear)}
                onChange={setField('birthYear')}
                {...fieldFeedback(
                  ['BIRTH_YEAR_OUT_OF_RANGE'],
                  'La estimamos con la fórmula de Gulati (más precisa que Tanaka).',
                )}
              />
              {estimatedMaxHr !== null && (
                <div
                  className="flex items-center gap-2 rounded-lg bg-turquesa-50 border border-turquesa-200 px-3 py-2 text-sm text-turquesa-800"
                  role="status"
                >
                  <MaterialIcon name="auto_awesome" size="small" className="text-turquesa-600" />
                  <span>
                    FC máxima estimada:{' '}
                    <strong className="font-semibold">{Math.round(estimatedMaxHr)} bpm</strong>
                    <span className="text-turquesa-700/70 ml-1">
                      (si la mides, prevalece sobre esta estimación)
                    </span>
                  </span>
                </div>
              )}
            </div>
          </details>
          {globalRestingError && (
            <p role="alert" className="text-sm text-error font-medium flex items-center gap-2">
              <MaterialIcon name="error_outline" size="small" className="text-error" />
              {describeValidationError(globalRestingError)}
            </p>
          )}
        </div>
      </Card>

      {globalNeedHrError && showAllErrors && (
        <Card variant="info" title="Faltan datos para calcular las zonas" titleIcon="info">
          <p className="text-gris-700">
            {describeValidationError(globalNeedHrError)} Rellena uno de los tres campos: FTP, FC
            máxima o año de nacimiento.
          </p>
        </Card>
      )}

      <FooterActions
        submitDisabled={submitDisabled}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

interface FooterActionsProps {
  submitDisabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function FooterActions({ submitDisabled, onCancel, onSubmit }: FooterActionsProps): JSX.Element {
  return (
    <>
      {/* Footer fijo en movil */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <Button variant="secondary" onClick={onCancel} aria-label="Cancelar y limpiar datos">
          Limpiar
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={submitDisabled}
          onClick={onSubmit}
          fullWidth
        >
          Siguiente: Ruta
        </Button>
      </div>
      {/* Inline en desktop */}
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Limpiar
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          Siguiente: Ruta
        </Button>
      </div>
    </>
  );
}
