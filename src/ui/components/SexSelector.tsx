import type { BiologicalSex } from '@core/user';
import { MaterialIcon } from './MaterialIcon';

export interface SexSelectorProps {
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
export function SexSelector({ value, onChange, error }: SexSelectorProps): JSX.Element {
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
        <p role="alert" className="text-sm text-rosa-600 font-medium flex items-center gap-2">
          <MaterialIcon name="error_outline" size="small" className="text-rosa-600" />
          {error}
        </p>
      ) : (
        <p className="text-xs text-gris-600">
          Para elegir la fórmula correcta de FC máxima por edad (Gulati ♀ / Tanaka ♂).
        </p>
      )}
    </div>
  );
}
