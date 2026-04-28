export interface WizardStepHeadingProps {
  /** Titulo principal del paso (Righteous, ds-h2). */
  title: string;
  /** Frase contextual breve bajo el titulo (ABeeZee, gris-600). */
  subtitle?: string;
  /**
   * Badge corto opcional al lado del subtitulo. Pensado para informacion
   * complementaria breve (ej. "Opcional"). Estilo: tulipTree-50 con borde.
   */
  badge?: string;
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
  badge,
  className = '',
}: WizardStepHeadingProps): JSX.Element {
  return (
    <header className={`mb-3 md:mb-4 ${className}`.trim()}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <h2 className="font-display text-ds-h2 text-gris-800">{title}</h2>
        {badge !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-tulipTree-50 border border-tulipTree-100 text-tulipTree-600 text-xs font-semibold">
            {badge}
          </span>
        )}
      </div>
      {subtitle !== undefined && (
        <p className="text-base text-gris-600">{subtitle}</p>
      )}
    </header>
  );
}
