import { useEffect, useRef } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import type { ClientIdSource } from '@integrations/spotify/clientId';

export interface SpotifyAccessDeniedDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Origen del Client ID que provoco el 403. Cambia el mensaje y el CTA:
   *
   * - 'default': el usuario esta entrando con el Client ID compartido de
   *   Cadencia (fallback) y no esta en mi lista de 5 testers. La salida es
   *   configurar SU PROPIO Client ID via BYOC.
   *
   * - 'custom': el usuario ya tiene su propio Client ID configurado, pero
   *   olvido anadir SU CUENTA a la lista de testers (Users and Access) en
   *   SU app de Spotify. La salida es ir a su dashboard.
   */
  source: ClientIdSource;
  /**
   * Callback que el padre usa para abrir el modal BYOC (ByocTutorialDialog).
   * Solo se llama desde la variante 'default'.
   */
  onConfigureCustom: () => void;
}

const SPOTIFY_DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

/**
 * Dialogo que se abre cuando Spotify devuelve 403 al crear la lista. El 403
 * en Development Mode significa que la cuenta autenticada no aparece en la
 * lista de testers de la app que esta haciendo la peticion. La causa y la
 * solucion son distintas segun de quien sea esa app:
 *
 * - Si la app es la de Cadencia (Client ID por defecto, fallback) y el
 *   usuario no es uno de los 5 testers conocidos de Elena, le pedimos que
 *   se haga su propia app (BYOC) — el cuello de botella desaparece para
 *   siempre.
 *
 * - Si la app es la del propio usuario (Client ID custom configurado), el
 *   problema es que olvido autorizar SU CUENTA dentro de SU app. Le
 *   mandamos al dashboard a anadirse en Users and Access.
 *
 * Patron `<dialog>` nativo: ESC para cerrar, focus trap, backdrop accesible,
 * sin dependencias externas.
 */
export function SpotifyAccessDeniedDialog({
  open,
  onClose,
  source,
  onConfigureCustom,
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

  // Esc nativo: capturamos 'cancel' (mismo patron que ConfirmDialog y
  // ByocTutorialDialog) para enrutar al onClose del padre y mantener el
  // state sincronizado. Sin esto el dialog se cierra pero el setter
  // `setAccessDeniedOpen` queda en `true`, dejando un open fantasma que
  // dispararia un re-open en el siguiente render.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg === null) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
      onClose();
    };
    dlg.addEventListener('cancel', handleCancel);
    return () => {
      dlg.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>): void {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  const handleConfigureClick = (): void => {
    onClose();
    onConfigureCustom();
  };

  return (
    <dialog
      ref={dialogRef}
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

        <div className="flex items-center gap-3 mb-3 pr-10">
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
            {source === 'default'
              ? 'Aun no tienes acceso'
              : 'Tu cuenta no esta autorizada en tu app'}
          </h2>
        </div>

        {source === 'default' ? (
          <DefaultMessage onConfigureClick={handleConfigureClick} onClose={onClose} />
        ) : (
          <CustomMessage onClose={onClose} />
        )}
      </div>
    </dialog>
  );
}

interface DefaultMessageProps {
  onConfigureClick: () => void;
  onClose: () => void;
}

function DefaultMessage({
  onConfigureClick,
  onClose,
}: DefaultMessageProps): JSX.Element {
  return (
    <>
      <p className="text-gris-700 mb-3">
        Estas intentando crear la lista usando el Client ID compartido de
        Cadencia, y tu cuenta no esta en su lista de testers (Spotify limita
        este modo a 5 cuentas).
      </p>
      <p className="text-gris-700 mb-5">
        La solucion es configurar tu propio Client ID. Es gratuito, te lleva
        unos 3 minutos y solo lo haces una vez. A partir de ese momento usas
        Cadencia sin limites ni esperas.
      </p>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button
          type="button"
          onClick={onClose}
          className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 border-gris-300 bg-white text-gris-700 hover:bg-gris-50 transition-colors px-4 py-2.5 min-h-[44px] md:min-h-[48px]"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={onConfigureClick}
          className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out bg-turquesa-600 text-white border-turquesa-700 hover:bg-turquesa-700 hover:-translate-y-0.5 active:translate-y-0 text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px]"
        >
          <MaterialIcon name="vpn_key" size="small" />
          Configurar mi Client ID
        </button>
      </div>

      <p className="text-xs text-gris-500 mt-4">
        Mientras tanto puedes seguir usando Cadencia para construir sesiones,
        previsualizar la lista y exportarla a Zwift en formato .zwo.
      </p>
    </>
  );
}

interface CustomMessageProps {
  onClose: () => void;
}

function CustomMessage({ onClose }: CustomMessageProps): JSX.Element {
  return (
    <>
      <p className="text-gris-700 mb-3">
        Tu Client ID custom es valido, pero la cuenta de Spotify con la que
        acabas de iniciar sesion no aparece en la lista de testers de tu
        propia app.
      </p>
      <p className="text-gris-700 mb-3">
        Esto pasa porque al crear la app olvidaste anadir tu email en la
        seccion <strong>Users and Access</strong>.
      </p>

      <ol className="list-decimal pl-5 text-sm text-gris-700 space-y-1.5 mb-5">
        <li>
          Abre{' '}
          <a
            href={SPOTIFY_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-600 hover:text-turquesa-700 underline font-semibold"
          >
            developer.spotify.com/dashboard
          </a>
          .
        </li>
        <li>Entra en tu app (la que creaste para Cadencia).</li>
        <li>
          Pulsa <strong>Settings</strong> &raquo;{' '}
          <strong>User Management</strong> (o &laquo;Users and Access&raquo;).
        </li>
        <li>
          Anade el email de tu cuenta de Spotify Premium y el nombre que quieras.
        </li>
        <li>Vuelve a Cadencia y reintenta.</li>
      </ol>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button
          type="button"
          onClick={onClose}
          className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 border-gris-300 bg-white text-gris-700 hover:bg-gris-50 transition-colors px-4 py-2.5 min-h-[44px] md:min-h-[48px]"
        >
          Cerrar
        </button>
        <a
          href={SPOTIFY_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="sm:flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out bg-turquesa-600 text-white border-turquesa-700 hover:bg-turquesa-700 hover:-translate-y-0.5 active:translate-y-0 text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px] no-underline"
        >
          <MaterialIcon name="open_in_new" size="small" />
          Abrir mi dashboard
        </a>
      </div>
    </>
  );
}
