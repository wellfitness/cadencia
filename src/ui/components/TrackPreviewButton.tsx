import { useEffect, useState } from 'react';
import {
  pausePreview,
  playPreview,
  subscribePreview,
} from '@integrations/spotify';
import { MaterialIcon } from './MaterialIcon';

export interface TrackPreviewButtonProps {
  uri: string;
}

// Spotify URI canónica: `spotify:track:{base62Id}`. Cualquier otra forma
// (link web, episodio, álbum) no es reproducible por el embed de track.
function isPlayableUri(uri: string): boolean {
  return /^spotify:track:[A-Za-z0-9]+$/.test(uri);
}

/**
 * Botón redondo de play/pause de la preview Spotify. Componente autónomo:
 * se suscribe al singleton del IFrame API controller y refleja en vivo si
 * está sonando ESTE uri concretamente. Click → arranca audio sin mostrar
 * reproductor visible (el iframe vive oculto fuera de viewport).
 */
export function TrackPreviewButton({ uri }: TrackPreviewButtonProps): JSX.Element {
  const playable = isPlayableUri(uri);
  const [isPlayingThis, setIsPlayingThis] = useState(false);

  useEffect(() => {
    if (!playable) return;
    const unsubscribe = subscribePreview((state) => {
      setIsPlayingThis(state.uri === uri && !state.isPaused);
    });
    return unsubscribe;
  }, [uri, playable]);

  const handleClick = (): void => {
    if (isPlayingThis) {
      void pausePreview();
    } else {
      void playPreview(uri);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!playable}
      aria-label={isPlayingThis ? 'Detener preview' : 'Escuchar 30 segundos'}
      aria-pressed={isPlayingThis}
      title={isPlayingThis ? 'Detener preview' : 'Escuchar 30 segundos'}
      className={
        'inline-flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-200 ease-out shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ' +
        (isPlayingThis
          ? 'bg-turquesa-600 text-white border-turquesa-700 hover:bg-turquesa-700'
          : 'bg-white text-turquesa-700 border-turquesa-300 hover:bg-turquesa-50 hover:border-turquesa-500')
      }
    >
      <MaterialIcon name={isPlayingThis ? 'stop_circle' : 'play_circle'} size="medium" />
    </button>
  );
}
