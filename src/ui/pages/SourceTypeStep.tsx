import { SourceSelector, type RouteSourceChoice } from '@ui/components/SourceSelector';

export interface SourceTypeStepProps {
  /** Se llama al elegir una de las dos opciones. Avanza el wizard al siguiente paso. */
  onSelect: (choice: RouteSourceChoice) => void;
}

/**
 * Primer paso del wizard: el usuario elige si va a entrenar con una ruta
 * GPX exterior o construir una sesion indoor cycling. Al pulsar una de las
 * dos cards el wizard avanza directamente al paso "Datos" — sin boton
 * intermedio para no añadir un click innecesario.
 */
export function SourceTypeStep({ onSelect }: SourceTypeStepProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10 pb-10">
      <SourceSelector onSelect={onSelect} />
    </div>
  );
}
