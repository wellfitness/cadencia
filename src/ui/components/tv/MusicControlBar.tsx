import { useMemo } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';
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
 *  - Error transitorio: linea roja debajo con el mensaje, los controles siguen
 *    pulsables (proximo poll los recalcula).
 */
export function MusicControlBar({
  playerState,
  lastError,
  hasActiveDevice,
  onTogglePlay,
  onSkipNext,
}: MusicControlBarProps): JSX.Element {
  const errorMessage = useMemo(() => formatError(lastError), [lastError]);
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
        <p
          role="status"
          className="text-[11px] text-rosa-300 truncate"
          title={errorMessage}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function formatError(error: PlayerError | null): string | null {
  if (error === null) return null;
  switch (error.kind) {
    case 'no-active-device':
      // No es un error real; el render principal ya muestra "abre Spotify".
      return null;
    case 'not-premium':
      return 'Spotify Premium es necesario para los controles integrados.';
    case 'token-expired':
      return 'Sesión Spotify caducada. Vuelve al asistente para reconectar.';
    case 'network':
      return `Sin conexión con Spotify (${error.message}).`;
    case 'unknown':
      return `Spotify respondió con un error (${error.status}).`;
  }
}
