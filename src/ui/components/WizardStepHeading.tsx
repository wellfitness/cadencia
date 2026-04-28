export interface WizardStepHeadingProps {
  /** Titulo principal del paso (Righteous, ds-h2). */
  title: string;
  /** Frase contextual breve bajo el titulo (ABeeZee, gris-600). */
  subtitle?: string;
  className?: string;
}

/**
 * Cabecera tipografica de un paso del wizard. Coexiste con el Stepper
 * (que es navegacion) y aporta jerarquia visual: Righteous para el titulo
 * y ABeeZee para la subline contextual.
 *
 * Se renderiza como h2 porque el h1 vive en App.tsx (sr-only) cubriendo
 * todo el wizard. Cada paso aporta su h2 visible.
 */
export function WizardStepHeading({
  title,
  subtitle,
  className = '',
}: WizardStepHeadingProps): JSX.Element {
  return (
    <header className={`mb-3 md:mb-4 ${className}`.trim()}>
      <h2 className="font-display text-ds-h2 text-gris-800 mb-1">{title}</h2>
      {subtitle !== undefined && (
        <p className="text-base text-gris-600">{subtitle}</p>
      )}
    </header>
  );
}
