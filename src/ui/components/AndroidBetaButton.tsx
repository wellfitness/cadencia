import { useEffect, useRef, useState } from 'react';
import { MaterialIcon } from './MaterialIcon';

/**
 * URL del Google Form donde el usuario deja su email de Google para que le
 * añadamos como tester en Play Console. La beta esta en Closed Testing: solo
 * los emails registrados en la lista de testers de Play Console pueden
 * descargar la APK. Sin formulario no hay forma de recoger esa lista.
 */
const BETA_FORM_URL = 'https://forms.gle/1djaa5TBtji2nD4H6';

export interface AndroidBetaButtonProps {
  /**
   * Versión compacta del botón (menor padding y altura) para ubicaciones
   * densas como el footer del wizard, donde un botón grande chocaria con
   * el resto de elementos pequenos. Default false (tamano del CTA hero).
   */
  compact?: boolean;
}

/**
 * AndroidBetaButton: CTA verde "Instalar en Android" que abre un modal
 * explicativo sobre la beta cerrada en Google Play. El modal enlaza al
 * Google Form donde el usuario deja su email para ser anadido como tester.
 *
 * Visible SIEMPRE (no condicional a navegador.userAgent Android): un usuario
 * navegando desde desktop puede perfectamente tener un Android en el bolsillo
 * y querer apuntarse a la beta. Filtrar por UA reduciria signups por dudoso
 * ahorro de ruido visual.
 *
 * El verde Android (#3ddc84) es identidad de plataforma — no se anade al
 * design-system general porque solo se usa aqui.
 *
 * Cuando la app salga de Closed Testing a Production en Play Console, este
 * componente puede transformarse en un enlace directo a la ficha de Play
 * (https://play.google.com/store/apps/details?id=app.movimientofuncional.cadencia)
 * o eliminarse si se prefiere depender solo del PWA install.
 */
export function AndroidBetaButton({ compact = false }: AndroidBetaButtonProps = {}): JSX.Element {
  const [open, setOpen] = useState(false);

  const sizeClasses = compact
    ? 'px-3 py-1.5 min-h-[36px] text-sm'
    : 'px-6 py-3 min-h-[48px] md:min-h-[52px] text-base';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-2 ${sizeClasses} font-semibold rounded-lg border-2 border-[#2bb86b] bg-[#3ddc84] text-gris-900 hover:bg-[#4ee59a] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(61,220,132,0.35)] active:translate-y-0 transition-all duration-200 ease-out`}
        aria-label="Apuntarme a la beta de Android"
      >
        <MaterialIcon name="android" size="small" />
        {compact ? 'Android' : 'Instalar en Android'}
      </button>
      <AndroidBetaDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface AndroidBetaDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de tema oscuro (bg-gris-900 con borde turquesa-300) — estetica
 * diferenciada del resto de la landing light-mode para senalar contexto
 * "beta / fuera de la app principal". Misma plantilla tecnica que
 * ConfirmDialog: <dialog> nativo + showModal/close via useEffect + listener
 * de 'cancel' para Esc + click en backdrop cierra.
 */
function AndroidBetaDialog({ open, onClose }: AndroidBetaDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
      onClose();
    };
    node.addEventListener('cancel', handleCancel);
    return () => {
      node.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="android-beta-title"
      aria-describedby="android-beta-description"
      className="rounded-2xl border-2 border-turquesa-300 bg-gris-900 p-0 shadow-2xl backdrop:bg-gris-900/60 backdrop:backdrop-blur-sm max-w-sm w-[calc(100%-2rem)]"
    >
      <div className="relative p-6 md:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-full text-gris-400 hover:text-white hover:bg-gris-700 transition-colors"
        >
          <MaterialIcon name="close" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-turquesa-900/40 text-turquesa-300"
            aria-hidden
          >
            <MaterialIcon name="android" size="large" />
          </span>

          <h3
            id="android-beta-title"
            className="font-display text-xl md:text-2xl text-white leading-tight"
          >
            Beta cerrada en Google Play
          </h3>

          <p id="android-beta-description" className="text-sm text-gris-200 leading-relaxed">
            La app de Android está en{' '}
            <span className="text-tulipTree-400 font-semibold">fase de pruebas cerrada</span>.
            Para participar necesito tu email de Google (el que usas en tu Android)
            para añadirte como tester.
          </p>

          <a
            href={BETA_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-base font-semibold rounded-lg bg-turquesa-500 text-white hover:bg-turquesa-400 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(4,218,219,0.35)] active:translate-y-0 transition-all duration-200 ease-out"
          >
            <MaterialIcon name="edit_note" size="small" />
            Apuntarme a la beta
          </a>

          <p className="text-xs text-gris-400">
            Te avisaré cuando puedas descargar la app desde Google Play.
          </p>
        </div>
      </div>
    </dialog>
  );
}
