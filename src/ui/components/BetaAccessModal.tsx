import { useEffect, useRef } from 'react';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';

/**
 * URL del formulario de alta en la lista de testers de Spotify. Reusada
 * por el BetaBanner de la Landing para que solo haya un sitio donde
 * actualizar el enlace si cambia.
 */
export const BETA_FORM_URL = 'https://forms.gle/7iAq1kPzZ7ptdhaG8';

export interface BetaAccessModalProps {
  open: boolean;
  onClose: () => void;
  /** Continuar al wizard (sin pasar por el form). */
  onContinue: () => void;
}

/**
 * Modal pre-acceso al wizard. Avisa al usuario de los dos requisitos
 * para usar la creacion de lista en Spotify:
 *
 *   1. Spotify Premium (sino la lista se reproduce en aleatorio).
 *   2. Estar en la lista de testers de la app en Spotify Developer
 *      (mientras Spotify aprueba acceso publico, los usuarios deben ser
 *      anadidos manualmente al panel User Management — tope 25).
 *
 * Usamos el elemento <dialog> nativo: gratis ESC para cerrar, focus trap,
 * backdrop accesible, sin dependencias.
 */
export function BetaAccessModal({
  open,
  onClose,
  onContinue,
}: BetaAccessModalProps): JSX.Element {
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

  // Cierre por backdrop click (clic fuera del contenido)
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
      aria-labelledby="beta-modal-title"
      className="
        max-w-lg w-[calc(100%-2rem)] p-0 rounded-2xl border-0
        backdrop:bg-gris-900/60 backdrop:backdrop-blur-sm
        text-gris-800 bg-white
      "
    >
      <div className="p-6 md:p-8">
        {/* Cierre */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-full text-gris-500 hover:text-gris-800 hover:bg-gris-100 transition-colors"
        >
          <MaterialIcon name="close" />
        </button>

        <h2
          id="beta-modal-title"
          className="font-display text-2xl md:text-3xl text-gris-800 mb-2"
        >
          Antes de empezar
        </h2>
        <p className="text-gris-700 mb-5">
          Cadencia se conecta a tu cuenta de Spotify para crear la lista
          ordenada en tu biblioteca. Para que esto funcione necesitas dos cosas:
        </p>

        <ol className="space-y-4 mb-6">
          <li className="flex gap-3">
            <div
              className="shrink-0 w-8 h-8 rounded-full bg-turquesa-100 text-turquesa-700 font-display flex items-center justify-center"
              aria-hidden
            >
              1
            </div>
            <div>
              <p className="font-semibold text-gris-800">Spotify Premium</p>
              <p className="text-sm text-gris-600 mt-0.5">
                La cuenta gratuita reproduce en orden aleatorio en el móvil, lo
                que rompe el ajuste entre cada tramo y su canción.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <div
              className="shrink-0 w-8 h-8 rounded-full bg-turquesa-100 text-turquesa-700 font-display flex items-center justify-center"
              aria-hidden
            >
              2
            </div>
            <div>
              <p className="font-semibold text-gris-800">
                Estar en la lista de testers
              </p>
              <p className="text-sm text-gris-600 mt-0.5">
                La app está en proceso de aprobación pública por Spotify. Hasta
                que termine ese trámite, debo añadirte manualmente como usuario
                autorizado. Si no estás en la lista, la creación de la lista en
                tu cuenta Spotify fallará. Apúntate con tu email de Spotify y te
                añado.
              </p>
            </div>
          </li>
        </ol>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onContinue}
            iconRight="arrow_forward"
            className="sm:flex-1"
          >
            Continuar
          </Button>
          <a
            href={BETA_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out bg-turquesa-600 text-white border-turquesa-700 hover:bg-turquesa-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,190,200,0.3)] active:translate-y-0 text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px] no-underline"
          >
            <MaterialIcon name="science" size="small" />
            Apuntarme a la beta
          </a>
        </div>

        <p className="text-xs text-gris-500 mt-4">
          También puedes continuar sin estar en la lista para construir
          sesiones indoor y previsualizar la lista. La exportación a Spotify
          solo funcionará cuando estés autorizado.
        </p>
      </div>
    </dialog>
  );
}
