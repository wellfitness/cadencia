import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
} from 'react';
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
import { SexSelector } from './SexSelector';
import { computeNextBikeWeight } from './bikeWeight';
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

/**
 * Refs imperativas que el formulario expone al padre para cuestiones que la
 * UI controla pero pertenecen al flujo del paso (foco al primer error tras
 * intento de submit fallido).
 */
export interface UserDataFormHandle {
  /** Foco al primer input con error visible, en orden visual. */
  focusFirstError(): void;
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
export const UserDataForm = forwardRef<UserDataFormHandle, UserDataFormProps>(
  function UserDataForm(
    { inputs, dispatch, validation, currentYear, showAllErrors = false, mode = 'gpx' },
    ref,
  ): JSX.Element {
    const isSession = mode === 'session';
    const [internalShowAllErrors] = useState(showAllErrors);
    const showVacios = showAllErrors || internalShowAllErrors;

    // === Refs por campo para enfocar al primer error tras submit fallido. ===
    const weightRef = useRef<HTMLInputElement>(null);
    const maxHrRef = useRef<HTMLInputElement>(null);
    const restingHrRef = useRef<HTMLInputElement>(null);
    const ftpRef = useRef<HTMLInputElement>(null);
    const birthYearRef = useRef<HTMLInputElement>(null);
    // Para sex usamos un radio button accesible. Buscamos el primero al enfocar.
    const sexGroupRef = useRef<HTMLDivElement>(null);

    // === Disclosure controlado para "Estimar por edad" (P1). ===
    // Heuristica de apertura inicial: si el usuario ya tiene birthYear y no
    // tiene maxHeartRate, lo abrimos para que vea la entrada que esta usando.
    // Despues, al teclear maxHeartRate, lo cerramos automaticamente.
    const [estimateOpen, setEstimateOpen] = useState<boolean>(
      inputs.birthYear !== null && inputs.maxHeartRate === null,
    );
    // Auto-cerrar cuando el usuario mete FC max y no hay birthYear.
    useEffect(() => {
      if (inputs.maxHeartRate !== null && inputs.birthYear === null) {
        setEstimateOpen(false);
      }
    }, [inputs.maxHeartRate, inputs.birthYear]);
    const estimatePanelId = useId();

    // === Disclosure controlado para FTP (P5). ===
    // Inicial: abierto si ya hay FTP. Despues queda en manos del usuario.
    const [ftpOpen, setFtpOpen] = useState<boolean>(inputs.ftpWatts !== null);
    const ftpDetailsRef = useRef<HTMLDetailsElement>(null);

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

    // === Pre-carga de peso bici al cambiar tipo (decision 4). ===
    // Si el usuario no ha escrito un peso de bici (o ha dejado el default
    // anterior intacto), aplicamos el default del nuevo tipo. Si ya tecleo
    // algo distinto, respetamos su valor.
    const setBikeType = (value: BikeType): void => {
      dispatch({ type: 'SET_BIKE_TYPE', value });
      const nextWeight = computeNextBikeWeight({
        prevType: inputs.bikeType,
        nextType: value,
        currentWeight: inputs.bikeWeightKg,
      });
      if (nextWeight !== null) {
        dispatch({ type: 'SET_NUMBER', field: 'bikeWeightKg', value: nextWeight });
      }
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

    // === Foco al primer error en orden visual (P2). ===
    // Orden: peso -> FCmax -> FCreposo -> ftp -> birthYear -> sex.
    // Usamos data-invalid (aria-invalid se setea por el Input cuando hay error).
    const focusFirstError = (): void => {
      if (!validation.ok) {
        const codes = validation.errors.map((e) => e.code);
        const order: Array<{
          codes: ValidationError['code'][];
          run: () => void;
        }> = [
          {
            codes: ['WEIGHT_REQUIRED', 'WEIGHT_OUT_OF_RANGE'],
            run: () => weightRef.current?.focus(),
          },
          {
            codes: ['MAX_HR_OUT_OF_RANGE', 'RESTING_GE_MAX_HR'],
            run: () => maxHrRef.current?.focus(),
          },
          {
            codes: ['RESTING_HR_OUT_OF_RANGE'],
            run: () => restingHrRef.current?.focus(),
          },
          {
            codes: ['FTP_OUT_OF_RANGE'],
            run: () => {
              setFtpOpen(true);
              // Esperamos a que el panel exista en el DOM antes de enfocar.
              requestAnimationFrame(() => ftpRef.current?.focus());
            },
          },
          {
            codes: ['BIRTH_YEAR_OUT_OF_RANGE', 'NEED_FTP_OR_HR_DATA'],
            run: () => {
              setEstimateOpen(true);
              requestAnimationFrame(() => birthYearRef.current?.focus());
            },
          },
          {
            codes: ['SEX_REQUIRED'],
            run: () => {
              setEstimateOpen(true);
              requestAnimationFrame(() => {
                const node = sexGroupRef.current;
                if (!node) return;
                const firstRadio = node.querySelector<HTMLButtonElement>('button[role="radio"]');
                firstRadio?.focus();
              });
            },
          },
        ];
        for (const step of order) {
          if (step.codes.some((c) => codes.includes(c))) {
            step.run();
            return;
          }
        }
      }
    };

    // Exponer focusFirstError al padre via ref. useImperativeHandle se
    // re-evalua cada render asi que el padre siempre ve la version actual.
    useImperativeHandle(ref, () => ({ focusFirstError }));

    // === Toggle del disclosure FTP (P5). ===
    // Mantenemos <details> para conservar a11y nativa, pero lo controlamos
    // desde React: el state es la unica fuente de verdad.
    const handleFtpToggle = (): void => {
      const node = ftpDetailsRef.current;
      if (!node) return;
      setFtpOpen(node.open);
    };

    return (
      <div className="space-y-3 md:space-y-4">
        {/* Modo session: la antigua Card "Datos opcionales" se ha movido a un
            badge en el subtitulo (UserDataStep). Aqui solo renderizamos los
            campos. */}

        {/* === Layout (P7): grid 2 cols en lg solo en modo gpx (Bici+Peso | FC).
            En modo session colapsa a 1 col porque solo hay FC. FTP siempre va
            debajo, full-width, para no dejar hueco visual con la columna izquierda. === */}
        <div
          className={`grid grid-cols-1 ${
            !isSession ? 'lg:grid-cols-2' : ''
          } gap-3 md:gap-4 lg:gap-6 items-start`}
        >
          {!isSession && (
            <Card title="Bici y peso" titleIcon="directions_bike">
              <div className="space-y-3">
                <div
                  className="grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Tipo de bici"
                >
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
                    ref={weightRef}
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
                      'Tu peso descalzo, en ropa ligera.',
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
                      'Si lo dejas vacío usamos un peso típico para tu tipo de bici.',
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
                    ref={maxHrRef}
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
                      'La que mides con pulsómetro durante un test máximo.',
                    )}
                  />
                  <Input
                    ref={restingHrRef}
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
                      'Tómala recién despertada, antes de levantarte.',
                    )}
                  />
                </div>

                {/* === Disclosure controlado para "Estimar por edad" (P1) === */}
                <div
                  className={`rounded-lg border ${
                    estimateOpen
                      ? 'border-turquesa-300 bg-white'
                      : 'border-gris-200 bg-gris-50'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={estimateOpen}
                    aria-controls={estimatePanelId}
                    onClick={() => setEstimateOpen((v) => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gris-700 select-none min-h-[44px] text-left"
                  >
                    <MaterialIcon
                      name="expand_more"
                      size="small"
                      className={`text-gris-500 motion-safe:transition-transform motion-safe:duration-200 ${
                        estimateOpen ? 'rotate-180' : ''
                      }`}
                    />
                    ¿No conoces tu FC máxima? Te la estimamos por edad
                  </button>
                  {estimateOpen && (
                    <div
                      id={estimatePanelId}
                      className="px-3 pb-3 space-y-3 border-t border-gris-200 motion-safe:animate-fade-in"
                    >
                      <Input
                        ref={birthYearRef}
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
                      <div ref={sexGroupRef}>
                        <SexSelector
                          value={inputs.sex}
                          onChange={setSex}
                          error={
                            globalSexError && showVacios
                              ? describeValidationError(globalSexError)
                              : undefined
                          }
                        />
                      </div>
                      {estimatedMaxHr !== null && (
                        <div
                          className="flex items-center gap-2 rounded-lg bg-turquesa-50 border border-turquesa-200 px-3 py-2 text-sm text-turquesa-800"
                          role="status"
                        >
                          <MaterialIcon
                            name="auto_awesome"
                            size="small"
                            className="text-turquesa-600"
                          />
                          <span>
                            FC máxima estimada:{' '}
                            <strong className="font-semibold">
                              {Math.round(estimatedMaxHr)} bpm
                            </strong>
                            <span className="text-turquesa-700/70 ml-1">
                              (si la mides, prevalece sobre esta estimación)
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {globalRestingError && (
                  <p
                    role="alert"
                    className="text-sm text-rosa-600 font-medium flex items-center gap-2"
                  >
                    <MaterialIcon name="error_outline" size="small" className="text-rosa-600" />
                    {describeValidationError(globalRestingError)}
                  </p>
                )}
              </div>
            </Card>

        </div>

        {/* === Accordion FTP (P5), full-width fuera del grid para no
            dejar hueco visual cuando la columna izquierda termina antes. === */}
        <details
          ref={ftpDetailsRef}
          className="group rounded-xl border border-gris-200 bg-white p-3 md:p-5 open:border-turquesa-300 motion-safe:transition-colors motion-safe:duration-200"
          {...(ftpOpen ? { open: true } : {})}
          onToggle={handleFtpToggle}
        >
          <summary className="flex cursor-pointer items-center gap-2 text-base md:text-lg font-semibold text-gris-800 select-none min-h-[44px]">
            <MaterialIcon name="bolt" size="small" className="text-turquesa-600" />
            ¿Tienes potenciómetro? Mete tu FTP
            <MaterialIcon
              name="expand_more"
              size="small"
              className="ml-auto text-gris-500 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 pt-3 border-t border-gris-100 space-y-2 motion-safe:animate-fade-in">
            <p className="text-sm text-gris-600">
              Con FTP afinamos las zonas con Coggan. Sin esto usamos tu FC.
            </p>
            <Input
              ref={ftpRef}
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
              {describeValidationError(globalNeedHrError)} Rellena uno de los tres campos: FTP,
              FC máxima o año de nacimiento.
            </p>
          </Card>
        )}
      </div>
    );
  },
);
