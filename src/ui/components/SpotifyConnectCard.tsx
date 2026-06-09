import { useState } from 'react';
import {
  beginSpotifyAuthorization,
  clearAuthFlow,
  clearTokens,
  getSpotifyClientId,
  loadTokens,
} from '@integrations/spotify';
import { Button } from './Button';
import { ByocTutorialDialog } from './ByocTutorialDialog';
import { Card } from './Card';
import { MaterialIcon } from './MaterialIcon';

/**
 * Conexion anticipada y OPCIONAL de la cuenta de Spotify en el paso Musica.
 *
 * Por que existe: crear la playlist en el ultimo paso (Resultado) dispara el
 * redirect OAuth (full-page reload) justo despues de que el usuario haya
 * editado la lista. Permitir conectar aqui mueve ese redirect a un momento sin
 * nada que perder: al volver, en Resultado ya hay sesion y «Crear playlist» no
 * recarga la pagina. Sigue siendo opt-in — quien no la use conecta al crear,
 * como siempre.
 *
 * Reutiliza el mismo arranque de login que ResultStep (beginSpotifyAuthorization)
 * y el tutorial BYOC para configurar el Client ID si aun no lo tiene.
 */
export function SpotifyConnectCard(): JSX.Element {
  const [connected, setConnected] = useState<boolean>(() => loadTokens() !== null);
  const [byocOpen, setByocOpen] = useState<boolean>(false);
  // El click navega fuera de la app (full-page redirect); `authorizing` solo
  // bloquea un doble click en la fraccion de segundo previa a la navegacion.
  const [authorizing, setAuthorizing] = useState<boolean>(false);

  const startAuth = (clientId: string): void => {
    setAuthorizing(true);
    void beginSpotifyAuthorization(clientId);
  };

  const handleConnect = (): void => {
    const clientId = getSpotifyClientId();
    if (clientId === null) {
      // Sin Client ID propio: abrimos el tutorial BYOC. Al guardar uno, su
      // onSaved arranca el login con el id recien configurado.
      setByocOpen(true);
      return;
    }
    startAuth(clientId);
  };

  const handleDisconnect = (): void => {
    clearTokens();
    clearAuthFlow();
    setConnected(false);
  };

  return (
    <Card variant="tip" title="Conecta tu Spotify" titleIcon="link">
      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-gris-800">
            <MaterialIcon name="check_circle" size="small" className="text-turquesa-600" />
            Cuenta conectada. Crearás tu lista sin interrupciones.
          </p>
          <Button variant="secondary" size="sm" onClick={handleDisconnect}>
            Cerrar sesión
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gris-700">
            Conéctate ahora y crea tu lista al final sin que se recargue la página en
            el último paso. Es opcional: también puedes conectarte al crear la lista.
          </p>
          <Button
            variant="primary"
            iconLeft="link"
            loading={authorizing}
            onClick={handleConnect}
          >
            Conectar Spotify
          </Button>
        </div>
      )}
      <ByocTutorialDialog
        open={byocOpen}
        onClose={() => setByocOpen(false)}
        onSaved={(clientId) => {
          setByocOpen(false);
          startAuth(clientId);
        }}
      />
    </Card>
  );
}
