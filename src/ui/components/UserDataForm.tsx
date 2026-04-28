import { useMemo, useState, type ChangeEvent, type Dispatch } from 'react';
import {
  BIKE_TYPES,
  DEFAULTS,
  VALIDATION_LIMITS,
  describeValidationError,
  type BikeType,
  type BiologicalSex,
  type UserInputsRaw,
  type ValidationError,
  type ValidationResult,
} from '@core/user';
import { BIKE_TYPE_ICONS, BIKE_TYPE_LABELS } from '@core/power';
import { calculateMaxHeartRate } from '@core/physiology';
import { Card } from './Card';
import { Input } from './Input';
import { MaterialIcon } from './MaterialIcon';
import type { UserInputsAction } from '@ui/state/userInputsReducer';

type NumericFieldKey =
  | 'weightKg'
  | 'ftpWatts'
  | 'maxHeartRate'
  | 'restingHeartRate'
  | 'birthYear'
  | 'bikeWeightKg';

function parseNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function numberToInputValue(n: number | null): string {
  return n === null ? '' : String(n);
}

export interface UserDataFormProps {
  inputs: UserInputsRaw;
  dispatch: Dispatch<UserInputsAction>;
  validation: ValidationResult;
  currentYear: number;
  /** True para mostrar errores de campos vacios (tras intentar avanzar). */
  showAllErrors?: boolean;
  /**
   * Modo del formulario:
   * - 'gpx' (default): pide peso, bici, FTP/FC. Todo orientado a calcular
   *   potencia desde la ecuacion fisica al procesar el GPX.
   * - 'session': pide solo FTP y FC (todo opcional). El peso y la bici no
   *   se usan en la pipeline indoor, asi que no se piden.
   */
  mode?: 'gpx' | 'session';
}

/**
 * Formulario de datos del usuario, sin chrome (header / footer / botones de
 * navegacion). Reusable en:
 *   - UserDataStep (paso del wizard, con footer Limpiar/Siguiente)
 *   - EditDataPanel (panel plegable en la pantalla Resultado)
 */
export function UserDataForm({
  inputs,
  dispatch,
  validation,
  currentYear,
  showAllErrors = false,
  mode = 'gpx',
}: UserDataFormProps): JSX.Element {
  const isSession = mode === 'session';
  const [internalShowAllErrors] = useState(showAllErrors);
  const showVacios = showAllErrors || internalShowAllErrors;

  const estimatedMaxHr: number | null = useMemo(() => {
    if (inputs.birthYear === null || inputs.maxHeartRate !== null) return null;
    if (inputs.sex === null) return null;
    const limits = VALIDATION_LIMITS.birthYear;
    const max = currentYear - limits.maxOffsetFromCurrent;
    if (inputs.birthYear < limits.min || inputs.birthYear > max) return null;
    return calculateMaxHeartRate(currentYear - inputs.birthYear, inputs.sex);
  }, [inputs.birthYear, inputs.maxHeartRate, inputs.sex, currentYear]);

  const setField = (field: NumericFieldKey) => (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_NUMBER', field, value: parseNumberInput(e.target.value) });
  };

  const setBikeType = (value: BikeType): void => {
    dispatch({ type: 'SET_BIKE_TYPE', value });
  };

  const setSex = (value: BiologicalSex): void => {
    dispatch({ type: 'SET_SEX', value });
  };

  const effectiveBikeType: BikeType = inputs.bikeType ?? DEFAULTS.bikeType;
  const bikeWeightPlaceholder = String(DEFAULTS.bikeWeightByType[effectiveBikeType]);

  const errors: ValidationError[] = validation.ok ? [] : validation.errors;
  const errorFor = (codes: ValidationError['code'][]): string | undefined => {
    const found = errors.find((e) => codes.includes(e.code));
    if (!found) return undefined;
    if (found.code === 'WEIGHT_REQUIRED' && !showVacios) return undefined;
    return describeValidationError(found);
  };

  const globalNeedHrError = errors.find((e) => e.code === 'NEED_FTP_OR_HR_DATA');
  const globalRestingError = errors.find((e) => e.code === 'RESTING_GE_MAX_HR');
  const globalSexError = errors.find((e) => e.code === 'SEX_REQUIRED');

  const fieldFeedback = (
    codes: ValidationError['code'][],
    helper: string,
  ): { error: string } | { helper: string } => {
    const message = errorFor(codes);
    return message !== undefined ? { error: message } : { helper };
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {isSession && (
        <Card variant="tip" titleIcon="info" title="Datos opcionales">
          <p className="text-sm text-gris-700">
            Para una sesión indoor todos los datos de abajo son opcionales. Si los rellenas
            podremos mostrarte tus rangos de FC objetivo durante la sesión y afinar mejor
            la potencia estimada de cada bloque.
          </p>
        </Card>
      )}
      {!isSession && (
      <Card title="Bici y peso" titleIcon="directions_bike">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tipo de bici">
            {BIKE_TYPES.map((type) => {
              const selected = effectiveBikeType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setBikeType(type)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-2 min-h-[60px] transition-colors duration-200 ${
                    selected
                      ? 'border-turquesa-600 bg-turquesa-50 text-turquesa-800'
                      : 'border-gris-200 bg-white text-gris-700 hover:border-turquesa-400 hover:bg-turquesa-50/40'
                  }`}
                >
                  <MaterialIcon
                    name={BIKE_TYPE_ICONS[type]}
                    size="small"
                    className={selected ? 'text-turquesa-600' : 'text-gris-500'}
                  />
                  <span className="text-xs md:text-sm font-semibold">
                    {BIKE_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tu peso"
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
                'Sin equipamiento.',
              )}
            />
            <Input
              label="Peso bici"
              type="number"
              step="0.1"
              min={VALIDATION_LIMITS.bikeWeightKg.min}
              max={VALIDATION_LIMITS.bikeWeightKg.max}
              unit="kg"
              placeholder={bikeWeightPlaceholder}
              value={numberToInputValue(inputs.bikeWeightKg)}
              onChange={setField('bikeWeightKg')}
              {...fieldFeedback(
                ['BIKE_WEIGHT_OUT_OF_RANGE'],
                `Si lo dejas vacío: ${bikeWeightPlaceholder} kg`,
              )}
            />
          </div>
        </div>
      </Card>
      )}

      <Card title="Frecuencia cardíaca" titleIcon="favorite">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="FC máxima"
              type="number"
              step="1"
              min={VALIDATION_LIMITS.maxHeartRate.min}
              max={VALIDATION_LIMITS.maxHeartRate.max}
              unit="bpm"
              value={numberToInputValue(inputs.maxHeartRate)}
              onChange={setField('maxHeartRate')}
              {...fieldFeedback(['MAX_HR_OUT_OF_RANGE'], 'Medida en pulsómetro.')}
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
              {...fieldFeedback(['RESTING_HR_OUT_OF_RANGE'], 'Al despertar.')}
            />
          </div>

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
                  'Usamos Gulati (mujeres) o Tanaka (hombres) según el sexo.',
                )}
              />
              <SexSelector
                value={inputs.sex}
                onChange={setSex}
                error={
                  globalSexError && showVacios
                    ? describeValidationError(globalSexError)
                    : undefined
                }
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

      <details
        className="group rounded-xl border border-gris-200 bg-white p-3 md:p-5 open:border-turquesa-300"
        open={inputs.ftpWatts !== null}
      >
        <summary className="flex cursor-pointer items-center gap-2 text-base md:text-lg font-semibold text-gris-800 select-none min-h-[44px]">
          <MaterialIcon name="bolt" size="small" className="text-turquesa-600" />
          ¿Tienes potenciómetro? Mete tu FTP
          <MaterialIcon
            name="expand_more"
            size="small"
            className="ml-auto text-gris-500 transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div className="mt-3 pt-3 border-t border-gris-100 space-y-2">
          <p className="text-sm text-gris-600">
            Con FTP afinamos las zonas con Coggan. Sin esto usamos tu FC.
          </p>
          <Input
            label="FTP"
            hideLabel
            type="number"
            step="1"
            min={VALIDATION_LIMITS.ftpWatts.min}
            max={VALIDATION_LIMITS.ftpWatts.max}
            unit="W"
            value={numberToInputValue(inputs.ftpWatts)}
            onChange={setField('ftpWatts')}
            {...fieldFeedback(['FTP_OUT_OF_RANGE'], 'Functional Threshold Power.')}
          />
        </div>
      </details>

      {globalNeedHrError && showVacios && !isSession && (
        <Card variant="info" title="Faltan datos para calcular las zonas" titleIcon="info">
          <p className="text-gris-700">
            {describeValidationError(globalNeedHrError)} Rellena uno de los tres campos: FTP, FC
            máxima o año de nacimiento.
          </p>
        </Card>
      )}
    </div>
  );
}

interface SexSelectorProps {
  value: BiologicalSex | null;
  onChange: (value: BiologicalSex) => void;
  error: string | undefined;
}

/**
 * Selector binario mujer/hombre. Solo aparece cuando se va a estimar la FC max
 * por edad: las formulas Gulati (mujeres) y Tanaka (hombres) divergen ~10 bpm,
 * lo que mueve una banda Karvonen entera. Si el usuario mide su FC max con
 * pulsometro, este selector no se usa.
 */
function SexSelector({ value, onChange, error }: SexSelectorProps): JSX.Element {
  const options: ReadonlyArray<{ value: BiologicalSex; label: string; icon: string }> = [
    { value: 'female', label: 'Mujer', icon: 'female' },
    { value: 'male', label: 'Hombre', icon: 'male' },
  ];
  return (
    <div className="space-y-1">
      <span className="block text-sm font-semibold text-gris-700">
        Sexo biológico <span className="text-gris-500 font-normal">(para la fórmula clínica)</span>
      </span>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sexo biológico">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 min-h-[44px] transition-colors duration-200 ${
                selected
                  ? 'border-turquesa-600 bg-turquesa-50 text-turquesa-800'
                  : 'border-gris-200 bg-white text-gris-700 hover:border-turquesa-400 hover:bg-turquesa-50/40'
              }`}
            >
              <MaterialIcon
                name={opt.icon}
                size="small"
                className={selected ? 'text-turquesa-600' : 'text-gris-500'}
              />
              <span className="text-sm font-semibold">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {error !== undefined ? (
        <p role="alert" className="text-sm text-error font-medium flex items-center gap-2">
          <MaterialIcon name="error_outline" size="small" className="text-error" />
          {error}
        </p>
      ) : (
        <p className="text-xs text-gris-600">
          Gulati para mujeres, Tanaka para hombres. Diferencia ≈10 bpm.
        </p>
      )}
    </div>
  );
}
