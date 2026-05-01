import { useEffect, useRef } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { BETA_FORM_URL } from '@ui/components/BetaAccessModal';

export interface BetaAccessDeniedDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialogo modal que se abre cuando Spotify devuelve 403 al crear la lista,
 * caso tipico de "el usuario autenticado no esta en la lista de testers
 * del Developer Dashboard". Sustituye al banner de error generico para ese
 * caso especifico porque el usuario necesita un CTA accionable (apuntarse
 * al formulario) en vez de un mensaje frio.
 *
 * Patron `<dialog>` nativo igual que BetaAccessModal: ESC para cerrar,
 * focus trap, backdrop accesible, sin dependencias.
 */
export function BetaAccessDeniedDialog({
  open,
  onClose,
}: BetaAccessDeniedDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg === null) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>): void {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-labelledby="beta-denied-title"
      className="
        max-w-lg w-[calc(100%-2rem)] p-0 rounded-2xl border-0
        backdrop:bg-gris-900/60 backdrop:backdrop-blur-sm
        text-gris-800 bg-white
      "
    >
      <div className="p-6 md:p-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-full text-gris-500 hover:text-gris-800 hover:bg-gris-100 transition-colors"
        >
          <MaterialIcon name="close" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rosa-100 text-rosa-600 shrink-0"
            aria-hidden
          >
            <MaterialIcon name="lock" size="large" />
          </span>
          <h2
            id="beta-denied-title"
            className="font-display text-2xl md:text-3xl text-gris-800"
          >
            Aún no tienes acceso
          </h2>
        </div>

        <p className="text-gris-700 mb-3">
          Spotify ha rechazado la creación de la lista porque tu cuenta todavía
          no está autorizada para usar Cadencia.
        </p>
        <p className="text-gris-700 mb-5">
          La app está en beta privada mientras Spotify aprueba el acceso
          público. Apúntate con tu email de Spotify y te añado a mano a la
          lista de testers — suele tardar menos de 24 h.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 border-gris-300 bg-white text-gris-700 hover:bg-gris-50 transition-colors px-4 py-2.5 min-h-[44px] md:min-h-[48px]"
          >
            Cerrar
          </button>
          <a
            href={BETA_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out bg-rosa-600 text-white border-rosa-700 hover:bg-rosa-700 hover:-translate-y-0.5 active:translate-y-0 text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px] no-underline"
          >
            <MaterialIcon name="science" size="small" />
            Solicitar acceso
          </a>
        </div>

        <p className="text-xs text-gris-500 mt-4">
          Mientras tanto puedes seguir usando Cadencia para construir sesiones,
          previsualizar la lista y exportarla a Zwift en formato .zwo.
        </p>
      </div>
    </dialog>
  );
}
