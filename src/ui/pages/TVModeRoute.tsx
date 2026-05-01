import { useEffect, useState } from 'react';
import { readAndConsumeHandoff, type TVHandoffPayload } from '@core/tv/tvHandoff';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { Logo } from '@ui/components/Logo';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SessionTVMode } from '@ui/pages/SessionTVMode';

/**
 * Pantalla raiz montada cuando la URL es /tv. Lee el handoff que la pestaña
 * origen escribio en localStorage y arranca el SessionTVMode.
 *
 * Si no hay handoff (alguien abrio /tv directamente) muestra un placeholder
 * que devuelve al usuario al wizard.
 *
 * Esta pantalla es independiente del wizard: NO monta el Stepper ni ninguno
 * de los pasos. Es deliberadamente minima — la pestaña /tv es solo SessionTVMode.
 */
export function TVModeRoute(): JSX.Element {
  // Lazy init: leemos el handoff una sola vez en el primer render. Si la
  // pestaña recibe un F5, sessionStorage conserva la copia y volvemos a leer
  // el mismo payload, asi que el usuario no pierde el progreso del cronometro.
  const [payload] = useState<TVHandoffPayload | null>(() => readAndConsumeHandoff());

  // Pintamos el titulo de la pestaña para que el usuario distinga rapidamente
  // entre la pestaña del wizard y la del modo TV en su barra de pestanas.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = payload !== null ? `Modo TV · ${payload.plan.name}` : 'Modo TV · Cadencia';
    return () => {
      document.title = previousTitle;
    };
  }, [payload]);

  if (payload === null) {
    return <TVModePlaceholder />;
  }

  return (
    <SessionTVMode
      plan={payload.plan}
      validatedInputs={payload.validatedInputs}
      {...(payload.templateId !== undefined ? { templateId: payload.templateId } : {})}
      onClose={() => {
        // Cerrar la pestaña: window.close() solo funciona para pestañas
        // abiertas via window.open; las navegaciones directas del usuario lo
        // ignoran. Si falla, navegamos al inicio para no dejar al usuario
        // bloqueado en la pantalla del cronometro.
        try {
          window.close();
        } catch {
          // Silenciar.
        }
        // Fallback: si la pestaña sigue abierta tras window.close(), llevamos
        // al usuario al wizard. Esto cubre el caso F5 + cerrar.
        if (!window.closed) {
          window.location.assign('/');
        }
      }}
    />
  );
}

function TVModePlaceholder(): JSX.Element {
  return (
    <div className="min-h-full flex flex-col bg-gris-50">
      <header className="border-b border-gris-200 bg-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 flex items-center gap-3">
          <Logo variant="full" size="md" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <Card variant="info" title="Esta pestaña debe abrirse desde Cadencia" titleIcon="tv_off">
            <p className="text-gris-700 mb-4">
              El Modo TV se lanza desde el último paso del asistente, junto al botón
              «Crear en Spotify». Vuelve al asistente y pulsa{' '}
              <strong className="font-semibold">Abrir Modo TV</strong> para empezar tu sesión
              a pantalla completa.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                iconLeft="arrow_back"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Volver a Cadencia
              </Button>
              <span
                className="text-xs text-gris-500 inline-flex items-center gap-1.5"
                aria-hidden
              >
                <MaterialIcon name="info" size="small" className="text-gris-400" />
                Esta pestaña no contiene tus datos.
              </span>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
