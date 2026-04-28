import { useEffect, useRef, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { MaterialIcon } from './MaterialIcon';

export interface ConfirmDialogProps {
  /** Si el modal esta abierto. */
  open: boolean;
  /** Titulo en la cabecera del modal. */
  title: string;
  /** Mensaje principal (puede ser texto o nodos). */
  message: ReactNode;
  /** Texto del boton de confirmacion. */
  confirmLabel?: string;
  /** Texto del boton de cancelar. */
  cancelLabel?: string;
  /** Variante del boton de confirmacion. Default 'primary' (turquesa). */
  confirmVariant?: ButtonVariant;
  /** Icono opcional al lado del titulo. */
  icon?: string;
  /** Handler invocado al confirmar. */
  onConfirm: () => void;
  /** Handler invocado al cancelar o cerrar (Esc, click fuera). */
  onCancel: () => void;
}

/**
 * Modal de confirmacion accesible basado en <dialog> nativo HTML5.
 *
 * Sin librerias externas: aprovecha el dialog nativo para focus trap, escape
 * para cerrar y backdrop integrado. Estilos del design-system Movimiento
 * Funcional (turquesa primary, rosa critical, ABeeZee/Righteous).
 *
 * Importante: el dialog se abre/cierra via showModal()/close() llamados desde
 * un useEffect que reacciona al prop `open`. No usamos el atributo `open`
 * declarativo porque el modal nativo solo activa el backdrop con showModal().
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sincroniza el prop `open` con el estado del <dialog> nativo.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  // El dialog nativo dispara 'cancel' con Esc y 'close' al cerrarse.
  // Capturamos 'cancel' para enrutar al handler onCancel (no estado interno).
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handleCancel = (e: Event): void => {
      // Permitimos el cierre nativo, pero notificamos al padre.
      e.preventDefault();
      onCancel();
    };
    node.addEventListener('cancel', handleCancel);
    return () => {
      node.removeEventListener('cancel', handleCancel);
    };
  }, [onCancel]);

  // Cerrar al hacer click en el backdrop (fuera del contenido del dialog).
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-testid="confirm-dialog"
      onClick={handleBackdropClick}
      className="rounded-xl border border-gris-200 bg-white p-0 shadow-xl backdrop:bg-gris-900/40 max-w-md w-[calc(100%-2rem)]"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="p-5 md:p-6 space-y-4">
        <h3
          id="confirm-dialog-title"
          className="flex items-center gap-2 text-base md:text-lg font-semibold text-gris-800"
        >
          {icon !== undefined && (
            <MaterialIcon name={icon} size="small" className="text-rosa-600" />
          )}
          {title}
        </h3>
        <div id="confirm-dialog-message" className="text-sm text-gris-700">
          {message}
        </div>
        {/* Mobile: stack vertical con accion principal arriba (orden visual
            de prioridad). Desktop: inline justify-end. */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            data-testid="confirm-dialog-cancel"
            fullWidth
            className="sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
            fullWidth
            className="sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
