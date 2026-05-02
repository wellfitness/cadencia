import { useState } from 'react';
import { ExternalLink } from './ExternalLink';

export interface SpotifyAttributionProps {
  /**
   * `'light'` para fondos claros (texto/logo oscuros),
   * `'dark'` para fondos oscuros (texto/logo claros). Sigue Branding
   * Guidelines de Spotify: monocromo en fondos no-blanco/no-negro.
   */
  variant?: 'light' | 'dark';
  /**
   * Tamano del wordmark. Spotify exige mínimo 70 px digital para el logo
   * completo, 21 px para solo el icono. Si solo quieres mostrar la
   * etiqueta junto a metadata pequeña, usa 'sm' (>=70 px).
   */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Atribucion oficial a Spotify segun Branding & Design Guidelines de la
 * Web API. Renderiza el logo oficial (SVG descargado desde el media kit
 * de Spotify) o, si los assets no estan presentes en `public/spotify/`,
 * un fallback textual «Música de Spotify» que cumple el minimo de
 * atribucion textual.
 *
 * Como subir los logos oficiales:
 *   1. Ir a https://newsroom.spotify.com/media-kit/
 *   2. Descargar el «Spotify Logo» (paquete RGB SVG) en sus tres variantes:
 *        - Spotify_Logo_RGB_Green.svg     (default, fondos blancos/claros)
 *        - Spotify_Logo_RGB_White.svg     (fondos oscuros, p.ej. Modo TV)
 *        - Spotify_Logo_RGB_Black.svg     (alternativa monocromo)
 *   3. Copiarlos a `public/spotify/` con esos nombres EXACTOS.
 *
 * Mientras los SVG no esten subidos, el componente cae a fallback
 * textual sin romper la UI ni los tests.
 *
 * Este componente debe aparecer en cada superficie que muestra metadata
 * de Spotify (track names, artist names, cover art, BPM derivado de
 * Audio Features). Hoy: MusicStep, ResultStep, CatalogEditorPage,
 * SessionTVMode.
 *
 * Usar el componente `<ExternalLink>` envoltura, NO `<a target="_blank">`,
 * por seguridad (rel=noopener noreferrer aplicado en un solo sitio).
 */
export function SpotifyAttribution({
  variant = 'light',
  size = 'sm',
  className = '',
}: SpotifyAttributionProps): JSX.Element {
  const [imageOk, setImageOk] = useState(true);

  const fileName =
    variant === 'dark'
      ? 'Spotify_Logo_RGB_White.svg'
      : 'Spotify_Logo_RGB_Green.svg';

  const heightPx = size === 'sm' ? 24 : 32;

  const labelClass =
    variant === 'dark'
      ? 'text-white/80'
      : 'text-gris-600';

  return (
    <ExternalLink
      href="https://www.spotify.com/"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold no-underline ${labelClass} ${className}`}
      title="Música de Spotify · abre spotify.com en una pestaña nueva"
    >
      <span className="opacity-80">Música de</span>
      {imageOk ? (
        <img
          src={`/spotify/${fileName}`}
          alt="Spotify"
          width={heightPx * 3.3}
          height={heightPx}
          style={{ height: heightPx, width: 'auto' }}
          onError={() => setImageOk(false)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="font-bold">Spotify</span>
      )}
    </ExternalLink>
  );
}
