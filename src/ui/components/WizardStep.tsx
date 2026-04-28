import type { ReactNode } from 'react';

export interface WizardStepProps {
  children: ReactNode;
  /** Override del max-width. Default `max-w-2xl`. */
  maxWidth?: 'max-w-2xl' | 'max-w-3xl';
  className?: string;
}

/**
 * Wrapper compartido por todos los pasos del wizard. Centraliza:
 * - Espaciado vertical homogeneo (`space-y-3 md:space-y-4`).
 * - Padding lateral mobile-first.
 * - `pb-32 md:pb-10` para que el footer fijo no tape contenido en mobile.
 *
 * El `max-w-2xl` por defecto cubre los pasos densos en formularios; se puede
 * subir a `max-w-3xl` para los pasos con tablas/charts (ruta, sesion).
 */
export function WizardStep({
  children,
  maxWidth = 'max-w-2xl',
  className = '',
}: WizardStepProps): JSX.Element {
  return (
    <div
      className={`mx-auto w-full ${maxWidth} px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
