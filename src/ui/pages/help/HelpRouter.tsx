import { HelpLayout } from '@ui/components/help/HelpLayout';
import { HelpHome } from './HelpHome';
import { SesionIndoorArticle } from './articles/SesionIndoorArticle';
import { ZonasArticle } from './articles/ZonasArticle';
import { IntervalosArticle } from './articles/IntervalosArticle';
import { PlantillasArticle } from './articles/PlantillasArticle';
import { MusicaArticle } from './articles/MusicaArticle';
import { SpotifyArticle } from './articles/SpotifyArticle';
import { SincronizarDriveArticle } from './articles/SincronizarDriveArticle';

export interface HelpRouterProps {
  pathname: string;
}

/**
 * Router interno del centro de ayuda. Ramifica por el pathname recibido por
 * App.tsx y delega en HelpLayout (que pone header, aside lateral en desktop
 * y SiteFooter) el render del articulo correspondiente.
 *
 * Mantiene la coherencia de patron pathname-based del resto de la app
 * (ningun React Router, switch explicito por path).
 */
export function HelpRouter({ pathname }: HelpRouterProps): JSX.Element {
  // Normalizamos quitando trailing slash si existe (acepta /ayuda y /ayuda/)
  const path = pathname.replace(/\/$/, '');

  switch (path) {
    case '/ayuda':
      return (
        <HelpLayout activeSlug={null}>
          <HelpHome />
        </HelpLayout>
      );
    case '/ayuda/sesion-indoor':
      return (
        <HelpLayout activeSlug="sesion-indoor">
          <SesionIndoorArticle />
        </HelpLayout>
      );
    case '/ayuda/zonas':
      return (
        <HelpLayout activeSlug="zonas">
          <ZonasArticle />
        </HelpLayout>
      );
    case '/ayuda/intervalos':
      return (
        <HelpLayout activeSlug="intervalos">
          <IntervalosArticle />
        </HelpLayout>
      );
    case '/ayuda/plantillas':
      return (
        <HelpLayout activeSlug="plantillas">
          <PlantillasArticle />
        </HelpLayout>
      );
    case '/ayuda/musica':
      return (
        <HelpLayout activeSlug="musica">
          <MusicaArticle />
        </HelpLayout>
      );
    case '/ayuda/spotify':
      return (
        <HelpLayout activeSlug="spotify">
          <SpotifyArticle />
        </HelpLayout>
      );
    case '/ayuda/sincronizar-drive':
      return (
        <HelpLayout activeSlug="sincronizar-drive">
          <SincronizarDriveArticle />
        </HelpLayout>
      );
    default:
      // Path desconocido bajo /ayuda: caemos al home del centro
      return (
        <HelpLayout activeSlug={null}>
          <HelpHome />
        </HelpLayout>
      );
  }
}
