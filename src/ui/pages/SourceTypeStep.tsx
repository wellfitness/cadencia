import type { Sport } from '@core/user';
import { SourceSelector, type TypeChoice } from '@ui/components/SourceSelector';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';

export interface SourceTypeStepProps {
  /** Deporte recordado de sesion previa (si lo hay). Default 'bike'. */
  defaultSport?: Sport;
  /**
   * Se llama al elegir una de las cards: capta deporte + tipo de fuente en
   * un solo click. Avanza el wizard al siguiente paso.
   */
  onSelect: (choice: TypeChoice) => void;
}

/**
 * Primer paso del wizard: el usuario elige DOS cosas en la misma pantalla:
 *   1. Deporte (bici / running) via toggle.
 *   2. Tipo de fuente (ruta GPX exterior / sesion por bloques) via card.
 * Al pulsar una de las dos cards el wizard avanza directamente al paso
 * "Datos" — sin boton intermedio para no añadir un click innecesario.
 */
export function SourceTypeStep({
  defaultSport,
  onSelect,
}: SourceTypeStepProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10 pb-10">
      <WizardStepHeading
        title="¿Qué vas a hacer hoy?"
        subtitle="Elige tu deporte y tipo de sesión. La lista la creamos a tu medida."
      />
      <SourceSelector
        {...(defaultSport !== undefined ? { defaultSport } : {})}
        onSelect={onSelect}
      />
    </div>
  );
}
