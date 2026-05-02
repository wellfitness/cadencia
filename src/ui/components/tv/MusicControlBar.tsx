import { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SpotifyAttribution } from '@ui/components/SpotifyAttribution';
import { SpotifyErrorReporter } from '@ui/components/SpotifyErrorReporter';
import type { PlayerError, PlayerState } from '@integrations/spotify';

export interface MusicControlBarProps {
  /** Estado actual del reproductor (null hasta el primer poll). */
  playerState: PlayerState | null;
  /** Ultimo error de la API. La barra renderiza el mensaje cuando no es null. */
  lastError: PlayerError | null;
  /** Si false, oculta el boton de pausar/reanudar. */
  hasActiveDevice: boolean;
  onTogglePlay: () => void;
  onSkipNext: () => void;
}

/**
 * Barra horizontal con los controles de Spotify integrados en el header
 * del Modo TV. Visual minimalista para no competir con la informacion del
 * cronometro (timer, zona, RPE).
 *
 * Estados visuales:
 *  - Sin device activo: muestra "Abre Spotify en tu movil/ordenador" + boton next
 *    deshabilitado. El play/pause no aparece hasta que haya device.
 *  - Con device + sonando: chip con titulo del track (truncado) + botones.
 *  - Con device + pausado: igual pero el icono de play indica "reanudar".
 *  - Error transitorio amistoso: linea roja debajo con el mensaje, los controles
 *    siguen pulsables (proximo poll los recalcula).
 *  - Error reportable (HTTP 4xx/5xx no esperado, fallo de red): ademas del
 *    mensaje, un boton "Detalles" abre un dialog con info tecnica + CTAs
 *    Copiar y Avisar por Telegram.
 */
export function MusicControlBar({
  playerState,
  lastError,
  hasActiveDevice,
  onTogglePlay,
  onSkipNext,
}: MusicControlBarProps): JSX.Element {
  const errorMessage = useMemo(() => formatErrorFriendly(lastError), [lastError]);
  const reportable = useMemo(() => formatErrorReportable(lastError), [lastError]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isPlaying = playerState?.isPlaying === true;
  const deviceName = playerState?.device?.name ?? null;

  return (
    <div className="bg-black/40 border-t border-white/10 px-3 sm:px-4 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MaterialIcon
            name={hasActiveDevice ? 'graphic_eq' : 'music_off'}
            size="small"
            className={hasActiveDevice ? 'text-turquesa-300' : 'text-white/40'}
          />
          <div className="min-w-0 text-xs sm:text-sm leading-tight">
            {hasActiveDevice ? (
              <>
                <p className="font-semibold truncate text-white/90">
                  {isPlaying ? 'Reproduciendo' : 'Pausado'}
                  {deviceName !== null && (
                    <span className="font-normal opacity-70"> · {deviceName}</span>
                  )}
                </p>
                <SpotifyAttribution variant="dark" />
              </>
            ) : (
              <p className="text-white/70">
                Abre Spotify en tu móvil u ordenador para empezar a sonar.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasActiveDevice && (
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar música' : 'Reanudar música'}
              title={isPlaying ? 'Pausar música (Spotify)' : 'Reanudar música (Spotify)'}
              className="w-8 h-8 rounded-md bg-turquesa-600/30 hover:bg-turquesa-600/50 text-white flex items-center justify-center transition-colors"
            >
              <MaterialIcon name={isPlaying ? 'pause' : 'play_arrow'} size="small" decorative />
            </button>
          )}
          <button
            type="button"
            onClick={onSkipNext}
            disabled={!hasActiveDevice}
            aria-label="Siguiente tema"
            title="Siguiente tema (Spotify)"
            className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <MaterialIcon name="skip_next" size="small" decorative />
          </button>
        </div>
      </div>
      {errorMessage !== null && (
        <div role="status" className="flex items-center gap-2 text-[11px] text-rosa-300">
          <p className="truncate flex-1" title={errorMessage}>
            {errorMessage}
          </p>
          {reportable !== null && (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="shrink-0 inline-flex items-center gap-0.5 font-semibold text-rosa-200 hover:text-white underline-offset-2 hover:underline"
            >
              <MaterialIcon name="info" size="small" />
              Detalles
            </button>
          )}
        </div>
      )}
      {reportable !== null && (
        <ErrorDetailsDialog
          open={detailsOpen}
          message={reportable}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Mensaje legible del estado de error para mostrar en la linea pequena de
 * la barra. Los kinds esperados (`no-active-device`, `not-premium`,
 * `token-expired`) tienen mensaje claro y accionable; los kinds reportables
 * (`unknown`, `network`) muestran un resumen compacto que invita a abrir
 * los detalles.
 */
function formatErrorFriendly(error: PlayerError | null): string | null {
  if (error === null) return null;
  switch (error.kind) {
    case 'no-active-device':
      // No es un error real; el render principal ya muestra "abre Spotify".
      return null;
    case 'not-premium':
      return 'Spotify Premium te permite reproducir cualquier tema sin anuncios y con mejor calidad. Pruébalo gratis en spotify.com/premium.';
    case 'token-expired':
      return 'Sesión Spotify caducada. Vuelve al asistente para reconectar.';
    case 'network':
      return 'Sin conexión con Spotify.';
    case 'unknown':
      return `Spotify respondió con un error (${error.status}).`;
  }
}

/**
 * Mensaje tecnico detallado para que el usuario pueda enviar captura. Solo
 * lo devolvemos para errores realmente reportables — los esperados (sin
 * device, no Premium, sesion caducada) no tienen mas datos relevantes que
 * los mostrados al usuario.
 */
function formatErrorReportable(error: PlayerError | null): string | null {
  if (error === null) return null;
  if (error.kind !== 'network' && error.kind !== 'unknown') return null;
  const method = error.method ?? '?';
  const path = error.path ?? '?';
  if (error.kind === 'network') {
    return `Spotify Player network en ${method} ${path}: ${error.message}`;
  }
  return `Spotify Player API ${error.status} en ${method} ${path}: ${error.message}`;
}

interface ErrorDetailsDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

function ErrorDetailsDialog({
  open,
  message,
  onClose,
}: ErrorDetailsDialogProps): JSX.Element {
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
      aria-labelledby="tv-error-details-title"
      className="
        max-w-md w-[calc(100%-2rem)] p-0 rounded-2xl border-0
        backdrop:bg-black/70 backdrop:backdrop-blur-sm
        text-white bg-gris-900
      "
    >
      <div className="p-5 md:p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <MaterialIcon name="close" />
        </button>
        <h2
          id="tv-error-details-title"
          className="font-display text-xl text-white mb-3 pr-10"
        >
          Detalles del error de Spotify
        </h2>
        <p className="text-sm text-white/80 mb-3">
          Si te ocurre repetidamente, copia los detalles y avísame por Telegram
          para revisarlo.
        </p>
        <SpotifyErrorReporter message={message} variant="dark" />
      </div>
    </dialog>
  );
}
