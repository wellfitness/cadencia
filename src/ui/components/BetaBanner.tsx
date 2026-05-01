import { MaterialIcon } from '@ui/components/MaterialIcon';
import { BETA_FORM_URL } from '@ui/components/BetaAccessModal';

/**
 * Banner permanente que avisa del estado beta de la app: para crear listas
 * en Spotify hace falta Premium y estar en la lista manual de testers
 * (mientras Spotify no apruebe el acceso publico).
 *
 * Se monta en TRES sitios:
 *   - Landing.tsx: en la cabecera (primera impresion para visitantes nuevos).
 *   - App.tsx (WizardApp): encima del Footer del wizard, como recordatorio
 *     justo antes de llegar al paso de crear la playlist en Spotify.
 *   - HelpLayout.tsx: encima del SiteFooter de cada articulo de ayuda.
 *
 * Usa `rosa-600` (Critical del design-system) deliberadamente: el flujo de
 * Spotify falla silenciosamente para usuarios no autorizados, asi que el
 * aviso necesita destacar al maximo. Es la unica superficie roja de la app
 * (no compite con otros elementos de alerta).
 *
 * `role="alert"` lo prioriza para lectores de pantalla.
 */
export function BetaBanner(): JSX.Element {
  return (
    <div role="alert" className="bg-rosa-600 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
        <MaterialIcon name="science" className="shrink-0" aria-hidden />
        <p className="text-sm md:text-base font-semibold flex-1">
          Necesitas Spotify Premium y que te dé acceso a la beta privada para
          aprovechar al máximo sus funciones.
        </p>
        <a
          href={BETA_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-sm rounded-lg bg-white text-rosa-700 hover:bg-gris-100 transition-colors px-4 py-2 min-h-[40px] no-underline"
        >
          Solicitar acceso
          <MaterialIcon name="arrow_forward" size="small" decorative />
        </a>
      </div>
    </div>
  );
}
