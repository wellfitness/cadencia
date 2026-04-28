import type { ReactNode } from 'react';

export interface WizardStepFooterProps {
  /** Contenido del footer en mobile (fixed bottom, full width). */
  mobile: ReactNode;
  /** Contenido del footer en desktop (inline). Si se omite, usa el mismo layout que mobile. */
  desktop?: ReactNode;
}

/**
 * Footer reutilizable de un paso del wizard. Centraliza:
 * - En mobile: posicionado fixed en la parte inferior con safe-area iOS
 *   (`env(safe-area-inset-bottom)`) y sombra superior sutil.
 * - En desktop: layout inline alineado a la derecha con padding superior.
 *
 * Los hijos definen los botones concretos del paso. El componente no asume
 * un layout especifico de botones para que cada paso pueda ordenarlos como
 * necesite (atras + limpiar + siguiente, atras + reset + siguiente, etc.).
 */
export function WizardStepFooter({ mobile, desktop }: WizardStepFooterProps): JSX.Element {
  const desktopContent = desktop ?? mobile;
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] z-20">
        {mobile}
      </div>
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        {desktopContent}
      </div>
    </>
  );
}
