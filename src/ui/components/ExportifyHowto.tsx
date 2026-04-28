import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

/**
 * Bloque desplegable que explica al usuario cómo exportar sus playlists de
 * Spotify a CSV usando exportify.net (gratis, código abierto, OAuth en el
 * navegador). Vive plegado por defecto en MusicStep, sobre el selector de
 * fuente — siempre visible, no gated por modo, para que también lo descubra
 * quien arranque con "Solo predefinida".
 *
 * Implementado con `<details>/<summary>` HTML nativo: a11y de teclado y
 * lector de pantalla de fábrica, sin estado React. El chevron rota 180° al
 * abrir vía `group-open:rotate-180` (Tailwind variante de `<details
 * className="group">`).
 */
export function ExportifyHowto(): JSX.Element {
  return (
    <details className="group rounded-xl bg-rosa-100 border-2 border-rosa-400">
      <summary
        className="flex items-center gap-3 p-4 cursor-pointer rounded-xl
          min-h-[44px] list-none [&::-webkit-details-marker]:hidden
          hover:border-rosa-500 transition-colors
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-rosa-600 focus-visible:ring-offset-2"
      >
        <MaterialIcon
          name="library_music"
          size="medium"
          className="text-rosa-600 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-base text-gris-800">
            ¿Cómo traer tu música de Spotify?
          </p>
          <p className="text-xs text-gris-600 mt-0.5">
            3 pasos, todo gratis y sin registros
          </p>
        </div>
        <MaterialIcon
          name="expand_more"
          size="medium"
          className="text-rosa-700 flex-shrink-0 transition-transform
            group-open:rotate-180"
        />
      </summary>

      <div className="px-4 pb-4 pt-1">
        <ol className="space-y-3">
          <Step
            number={1}
            title="Abre exportify.net"
            description="Es gratis y de código abierto. Pulsa «Login with Spotify» y autoriza el acceso (solo lectura)."
          />
          <Step
            number={2}
            title="Descarga la lista que quieras como CSV"
            description={
              <>
                Verás todas tus playlists. Pulsa el icono ↓ junto a la que te
                interese. Se baja como{' '}
                <code className="font-mono text-xs bg-white border border-rosa-400 rounded px-1 py-0.5 text-gris-800">
                  nombre-de-la-lista.csv
                </code>
                .
              </>
            }
          />
          <Step
            number={3}
            title="Cárgala aquí mismo"
            description="Elige «Solo mis CSV» o «Combinar ambas» y arrastra el CSV al recuadro, o pulsa para seleccionarlo. Cadencia lee BPM, energía y géneros para encajar cada canción con su zona."
          />
        </ol>

        <p className="text-xs text-gris-500 mt-4 flex items-start gap-1.5">
          <MaterialIcon
            name="lock"
            size="small"
            className="text-gris-400 flex-shrink-0 mt-0.5"
          />
          <span>
            Tu sesión de Spotify se queda en exportify; Cadencia no ve ni
            guarda tu cuenta.
          </span>
        </p>

        <a
          href="https://exportify.net"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full
            bg-rosa-600 text-white text-sm font-semibold
            hover:bg-rosa-700 transition-colors min-h-[44px]
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-rosa-600 focus-visible:ring-offset-2"
        >
          Abrir exportify.net
          <MaterialIcon name="open_in_new" size="small" />
        </a>
      </div>
    </details>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: ReactNode;
}

function Step({ number, title, description }: StepProps): JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="w-7 h-7 rounded-full bg-rosa-600 text-white text-sm
          font-bold flex items-center justify-center flex-shrink-0"
      >
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gris-800">{title}</p>
        <p className="text-sm text-gris-600 mt-0.5">{description}</p>
      </div>
    </li>
  );
}
