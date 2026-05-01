import { useState } from 'react';
import { MaterialIcon } from '@ui/components/MaterialIcon';

const TELEGRAM_SUPPORT_URL = 'https://t.me/wellfitness_trainer';

export interface SpotifyErrorReporterProps {
  /**
   * Mensaje tecnico del error. Idealmente formato
   * `Spotify API <status> en <method> <path>: <detail>`. Aparece en una caja
   * monoespaciada para que se pueda copiar de un click o con seleccion manual.
   */
  message: string;
  /** Variante de color. `light` para fondo blanco, `dark` para Modo TV. */
  variant?: 'light' | 'dark';
  /**
   * Headline opcional sobre la caja del mensaje. Si no se provee, omitimos
   * la cabecera y el reporter se renderiza solo con la caja + CTAs.
   */
  headline?: string;
}

/**
 * Componente compartido para reportar errores de Spotify al usuario de forma
 * accionable. Muestra el mensaje tecnico completo (que debe incluir status +
 * endpoint + detalle del servidor) y ofrece dos atajos:
 *   - Copiar al portapapeles para pegar en email/Telegram.
 *   - Enlace directo al Telegram de soporte (`t.me/wellfitness_trainer`).
 *
 * Pensado para reutilizarse en cualquier sitio donde un fallo de la API de
 * Spotify pueda escapar al usuario: paso de creacion de lista, controles
 * integrados del Modo TV, etc.
 */
export function SpotifyErrorReporter({
  message,
  variant = 'light',
  headline,
}: SpotifyErrorReporterProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin clipboard disponible (HTTP, permisos): el usuario aún puede
      // seleccionar y copiar el texto del <pre> manualmente.
    }
  };

  const isDark = variant === 'dark';
  const containerClass = isDark
    ? 'rounded-lg border border-rosa-400/40 bg-black/40 p-3 text-sm text-rosa-200 space-y-2'
    : 'rounded-lg border border-rosa-400 bg-rosa-100/40 p-3 text-sm text-rosa-700 space-y-2';
  const preClass = isDark
    ? 'whitespace-pre-wrap break-words font-mono text-xs bg-black/40 border border-rosa-400/30 rounded px-2 py-1.5 text-white/90'
    : 'whitespace-pre-wrap break-words font-mono text-xs bg-white border border-rosa-200 rounded px-2 py-1.5 text-gris-800';
  const linkClass = isDark
    ? 'inline-flex items-center gap-1 text-xs font-semibold text-rosa-200 hover:text-white underline-offset-2 hover:underline'
    : 'inline-flex items-center gap-1 text-xs font-semibold text-rosa-700 hover:text-rosa-700/80 underline-offset-2 hover:underline';

  return (
    <div role="alert" className={containerClass}>
      {headline !== undefined && (
        <p className="font-semibold">{headline}</p>
      )}
      <pre className={preClass}>{message}</pre>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void handleCopy()} className={linkClass}>
          <MaterialIcon name={copied ? 'check' : 'content_copy'} size="small" />
          {copied ? '¡Copiado!' : 'Copiar detalles'}
        </button>
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <MaterialIcon name="forum" size="small" />
          Avisar por Telegram
        </a>
      </div>
    </div>
  );
}
