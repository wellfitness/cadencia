import { useMemo, useState } from 'react';
import type {
  TestDerivedValue,
  TestInput,
  TestProtocol,
  TestResult,
} from '@core/segmentation';
import type { UserInputsRaw } from '@core/user/userInputs';
import { MaterialIcon } from '../MaterialIcon';

interface Props {
  templateName: string;
  testProtocol: TestProtocol;
  /** Datos actuales del usuario (para que `compute()` pueda leer p. ej. weightKg). */
  user: UserInputsRaw;
  /** Llamado cuando el usuario pulsa "Guardar" con los inputs validos. */
  onSaved: (delta: Partial<UserInputsRaw>) => void;
  /** Llamado al cerrar sin guardar. */
  onSkipped: () => void;
}

/**
 * Modal post-sesion de un test fisiologico guiado. Pinta los `inputs` que
 * declara el `testProtocol` (1 o 2 numeros), los valida contra `[min, max]`,
 * calcula los valores derivados (FTP, VO2max, CP, vMAS, LTHR, FCmax) en
 * vivo via `compute()` y persiste el `delta` en el store al pulsar Guardar.
 *
 * Generico sobre todos los protocolos: el componente no contiene logica
 * especifica de cada test. El proximo test que se a~nada solo necesita
 * declarar su `testProtocol` en `sessionTemplates.ts`.
 */
export function TestResultDialog({
  templateName,
  testProtocol,
  user,
  onSaved,
  onSkipped,
}: Props): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(testProtocol.inputs.map((i) => [i.id, ''])),
  );

  /**
   * Parsea los strings del formulario a numbers y los valida contra el
   * rango [min, max] declarado en cada input. Si TODOS son validos, llama
   * a `compute()` para obtener el TestResult. Si alguno falta o sale de
   * rango, devuelve null y el boton Guardar queda deshabilitado.
   */
  const result = useMemo<TestResult | null>(() => {
    const numeric: Record<string, number> = {};
    for (const input of testProtocol.inputs) {
      const raw = values[input.id]?.trim() ?? '';
      if (raw === '') return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < input.min || n > input.max) return null;
      numeric[input.id] = n;
    }
    try {
      return testProtocol.compute(numeric, user);
    } catch {
      // RangeError de la formula (entrada fuera del dominio aunque dentro del
      // [min, max] del input). Ej: vo2maxFromMap5 con weight nulo. Si el
      // store no tiene weightKg, vo2maxFromMap5 usa default 70 — no deberia
      // saltar pero por defensiva: devolvemos null y usuario ajusta.
      return null;
    }
  }, [testProtocol, values, user]);

  const canSave = result !== null;

  const handleChange = (id: string, raw: string): void => {
    setValues((prev) => ({ ...prev, [id]: raw }));
  };

  const handleSave = (): void => {
    if (result === null) return;
    onSaved(result.delta);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') onSkipped();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-result-title"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onSkipped}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-lg w-full space-y-4 shadow-lg my-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-turquesa-100 p-2 flex-shrink-0">
            <MaterialIcon
              name="science"
              size="small"
              className="text-turquesa-700"
              decorative
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="test-result-title"
              className="font-display text-lg text-gris-800"
            >
              Resultado del test
            </h2>
            <p className="text-xs text-gris-500 mt-0.5">{templateName}</p>
          </div>
        </div>

        <p className="text-sm text-gris-700">
          Introduce los datos clave del test para calcular tu resultado y
          actualizar tu perfil.
        </p>

        <div className="space-y-3">
          {testProtocol.inputs.map((input) => (
            <InputField
              key={input.id}
              input={input}
              value={values[input.id] ?? ''}
              onChange={(raw) => handleChange(input.id, raw)}
            />
          ))}
        </div>

        {result !== null && <ResultPreview derived={result.derived} />}

        {testProtocol.postTestNote !== undefined && (
          <p className="text-xs text-gris-600 leading-relaxed border-l-2 border-turquesa-300 pl-3">
            {testProtocol.postTestNote}
          </p>
        )}

        {testProtocol.citationDois.length > 0 && (
          <p className="text-[11px] text-gris-500">
            Basado en evidencia científica:{' '}
            {testProtocol.citationDois.map((doi, i) => (
              <span key={doi}>
                <a
                  href={`https://doi.org/${doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-turquesa-600 hover:underline"
                >
                  doi.org/{doi}
                </a>
                {i < testProtocol.citationDois.length - 1 ? ', ' : ''}
              </span>
            ))}
            .
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onSkipped}
            className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[44px] text-sm"
          >
            Saltar (no guardar)
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-md bg-turquesa-600 text-white hover:bg-turquesa-700 disabled:opacity-50 min-h-[44px] text-sm font-medium"
          >
            Guardar resultado
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputFieldProps {
  input: TestInput;
  value: string;
  onChange: (raw: string) => void;
}

function InputField({ input, value, onChange }: InputFieldProps): JSX.Element {
  const trimmed = value.trim();
  const numeric = trimmed === '' ? null : Number(trimmed);
  const outOfRange =
    numeric !== null &&
    Number.isFinite(numeric) &&
    (numeric < input.min || numeric > input.max);
  const invalidNumber =
    trimmed !== '' && (!Number.isFinite(numeric) || Number.isNaN(numeric ?? NaN));
  const showError = outOfRange || invalidNumber;

  return (
    <label className="block">
      <span className="text-sm text-gris-700 font-medium">{input.label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={input.min}
        max={input.max}
        step={input.unit === 'kJ' ? 0.1 : 1}
        className={`mt-1 w-full rounded-md border-2 px-3 py-2 focus:outline-none ${
          showError
            ? 'border-rosa-500 focus:border-rosa-600'
            : 'border-gris-300 focus:border-turquesa-500'
        }`}
        aria-invalid={showError}
        aria-describedby={`${input.id}-help`}
      />
      <span
        id={`${input.id}-help`}
        className={`mt-1 block text-xs ${
          showError ? 'text-rosa-600' : 'text-gris-500'
        }`}
      >
        {showError
          ? `Valor fuera de rango (${input.min}–${input.max} ${input.unit}).`
          : (input.helperText ?? `Rango aceptado: ${input.min}–${input.max} ${input.unit}.`)}
      </span>
    </label>
  );
}

interface ResultPreviewProps {
  derived: ReadonlyArray<TestDerivedValue>;
}

function ResultPreview({ derived }: ResultPreviewProps): JSX.Element {
  return (
    <div className="rounded-lg bg-turquesa-50 border border-turquesa-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-turquesa-700 font-semibold mb-2">
        Tu resultado
      </p>
      <ul className="space-y-1">
        {derived.map((d) => (
          <li
            key={d.label}
            className="flex items-baseline justify-between gap-3 text-sm text-gris-800"
          >
            <span>{d.label}</span>
            <span className="font-bold tabular-nums">
              {formatDerivedValue(d)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDerivedValue(d: TestDerivedValue): string {
  const precision = d.precision ?? 0;
  return `${d.value.toFixed(precision)} ${d.unit}`;
}
