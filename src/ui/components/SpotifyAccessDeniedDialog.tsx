import { useEffect, useRef } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';

/**
 * URL del formulario de alta en la lista de testers autorizados de la
 * integración de Cadencia con Spotify. Mientras Spotify no apruebe la cuota
 * extendida, las cuentas necesitan añadirse manualmente al Developer
 * Dashboard. Cuando se apruebe, este dialogo dejara de dispararse y la URL
 * podra retirarse.
 */
export const SPOTIFY_ACCESS_REQUEST_URL = 'https://forms.gle/7iAq1kPzZ7ptdhaG8';

export interface SpotifyAccessDeniedDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialogo que se abre cuando Spotify devuelve 403 al crear la lista, caso
 * tipico de "el usuario autenticado no tiene autorizacion para usar la
 * integracion". Muestra una explicacion amable y un CTA al formulario de
 * solicitud de acceso, en lugar del banner de error generico.
 *
 * Patron `<dialog>` nativo: ESC para cerrar, focus trap, backdrop accesible,
 * sin dependencias.
 */
export function SpotifyAccessDeniedDialog({
  open,
  onClose,
}: SpotifyAccessDeniedDialogProps): JSX.Element {
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
      aria-labelledby="spotify-denied-title"
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
            id="spotify-denied-title"
            className="font-display text-2xl md:text-3xl text-gris-800"
          >
            Aún no tienes acceso
          </h2>
        </div>

        <p className="text-gris-700 mb-3">
          Spotify no ha podido completar la creación de la lista en tu cuenta
          porque todavía no estás autorizada para usar la integración de
          Cadencia con Spotify.
        </p>
        <p className="text-gris-700 mb-5">
          Estamos en proceso de habilitar el acceso para todo el público.
          Mientras tanto, apúntate con tu email de Spotify y te incluyo
          manualmente — suele tardar menos de 24 h.
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
            href={SPOTIFY_ACCESS_REQUEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out bg-rosa-600 text-white border-rosa-700 hover:bg-rosa-700 hover:-translate-y-0.5 active:translate-y-0 text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px] no-underline"
          >
            <MaterialIcon name="mark_email_read" size="small" />
            Solicitar acceso
          </a>
        </div>

        <p className="text-xs text-gris-500 mt-4">
          Mientras tanto puedes seguir usando Cadencia para construir
          sesiones, previsualizar la lista y exportarla a Zwift en formato
          .zwo.
        </p>
      </div>
    </dialog>
  );
}
