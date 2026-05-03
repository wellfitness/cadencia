import { useEffect, useState } from 'react';
import {
  exchangeCodeForTokens,
  getCurrentUser,
  getRedirectUri,
  getSpotifyClientId,
  loadAuthFlow,
  saveTokens,
  saveUserProfile,
} from '@integrations/spotify';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';

type Phase = 'verifying' | 'success' | 'error';

/**
 * Pantalla minima que se muestra en /callback tras el redirect de Spotify.
 *
 * Flujo:
 *   1. Lee `code` y `state` de la query.
 *   2. Recupera codeVerifier y state esperado de sessionStorage.
 *   3. Si state no coincide -> error CSRF, abortar.
 *   4. Si OK -> exchangeCodeForTokens, guardar tokens.
 *   5. Redirige a `/` (raiz). El App al cargar detectara los tokens y
 *      reanudara en el paso correcto.
 */
export function SpotifyCallback(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    if (oauthError !== null) {
      setErrorMsg(`Spotify rechazó el permiso (${oauthError}).`);
      setPhase('error');
      return;
    }
    if (code === null || state === null) {
      setErrorMsg('Faltan parámetros en la respuesta de Spotify.');
      setPhase('error');
      return;
    }

    const clientId = getSpotifyClientId();
    if (clientId === null) {
      setErrorMsg(
        'No hay Client ID configurado. Vuelve a la app y configura tu Client ID en «Mis preferencias».',
      );
      setPhase('error');
      return;
    }

    const flow = loadAuthFlow();
    if (!flow || flow.state !== state) {
      setErrorMsg('Estado de seguridad inválido. Vuelve a iniciar la creación.');
      setPhase('error');
      return;
    }

    void exchangeCodeForTokens({
      clientId,
      redirectUri: getRedirectUri(),
      code,
      codeVerifier: flow.codeVerifier,
    })
      .then(async (tokens) => {
        saveTokens(tokens);
        // Detectar Premium en background. Lo necesitamos cacheado para que
        // el wizard pueda decidir si activa los controles integrados de
        // musica en el Modo TV. Si /me falla (red, scope ausente), seguimos
        // adelante con la creacion de playlist; los controles del Modo TV
        // simplemente no apareceran hasta el proximo OAuth con scopes ok.
        try {
          const profile = await getCurrentUser(tokens.accessToken);
          saveUserProfile(profile);
        } catch {
          // Silenciar: no bloqueamos el flujo principal por un /me fallido.
        }
        setPhase('success');
        // Pequeno delay para que el usuario vea el mensaje antes de redirigir.
        setTimeout(() => {
          window.location.assign('/');
        }, 800);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error inesperado al autorizar';
        setErrorMsg(msg);
        setPhase('error');
      });
  }, []);

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-md">
        {phase === 'verifying' && (
          <Card title="Verificando con Spotify…" titleIcon="lock">
            <div className="flex items-center gap-3 py-4">
              <MaterialIcon
                name="progress_activity"
                size="medium"
                className="text-turquesa-600 animate-spin-slow"
              />
              <span className="text-gris-700">Comprobando tu autorización.</span>
            </div>
          </Card>
        )}
        {phase === 'success' && (
          <Card variant="tip" title="¡Conectado!" titleIcon="check_circle">
            <p className="text-gris-700">
              Volviendo a la app para crear tu lista…
            </p>
          </Card>
        )}
        {phase === 'error' && (
          <Card variant="info" title="No pudimos completar la conexión" titleIcon="error_outline">
            <p className="text-gris-700 mb-3">{errorMsg ?? 'Error desconocido.'}</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
            >
              <MaterialIcon name="arrow_back" size="small" />
              Volver a la app
            </a>
          </Card>
        )}
      </div>
    </div>
  );
}
