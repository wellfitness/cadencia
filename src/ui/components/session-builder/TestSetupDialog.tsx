import type { TestProtocol } from '@core/segmentation';
import { MaterialIcon } from '../MaterialIcon';

interface Props {
  templateName: string;
  testProtocol: TestProtocol;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal pre-sesion de un test fisiologico guiado. Solo se renderiza cuando
 * el `testProtocol` tiene `hardwareDisclaimer` — un aviso critico que el
 * usuario debe leer antes de empezar (rampa: configurar SLOPE; 3MT:
 * NIVEL/SLOPE no ERG; 30-15 IFT: app de audio + conos a 40 m).
 *
 * Para tests sin hardwareDisclaimer (Daniels FCmax, 5-min run, MAP-5min
 * bike) este modal se omite y la sesion empieza directa.
 */
export function TestSetupDialog({
  templateName,
  testProtocol,
  onConfirm,
  onCancel,
}: Props): JSX.Element {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-setup-title"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-md w-full space-y-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-tulipTree-100 p-2 flex-shrink-0">
            <MaterialIcon
              name="warning"
              size="small"
              className="text-tulipTree-600"
              decorative
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="test-setup-title"
              className="font-display text-lg text-gris-800"
            >
              Antes de empezar el test
            </h2>
            <p className="text-xs text-gris-500 mt-0.5">{templateName}</p>
          </div>
        </div>

        <div className="rounded-lg bg-tulipTree-50 border border-tulipTree-200 px-4 py-3">
          <p className="text-sm text-gris-800 leading-relaxed">
            {testProtocol.hardwareDisclaimer}
          </p>
        </div>

        <p className="text-xs text-gris-600 leading-relaxed">
          Cuando empieces, abre este test en <strong>Modo TV</strong>: el cronómetro
          y los avisos por voz te guían fase por fase para que no tengas que mirar la
          pantalla. Al terminar te pediremos los datos clave del test para calcular
          el resultado.
        </p>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[44px] text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-turquesa-600 text-white hover:bg-turquesa-700 min-h-[44px] text-sm font-medium"
          >
            Entendido, empezar
          </button>
        </div>
      </div>
    </div>
  );
}
