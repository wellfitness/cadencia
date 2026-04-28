import { useEffect, useState } from 'react';

/**
 * Marcador que `navigateInApp` deja en `history.state` para distinguir las
 * entradas del historial creadas por la app de las navegaciones externas
 * (entrada directa por URL, refresh, llegada desde otro sitio).
 */
const IN_APP_STATE = { __cadenciaInApp: true } as const;

interface InAppHistoryState {
  __cadenciaInApp?: boolean;
}

/**
 * Hook que devuelve el `pathname` actual y se re-renderiza cuando cambia.
 * Escucha `popstate` (back/forward del navegador) y eventos `popstate`
 * sinteticos disparados por `navigateInApp`.
 *
 * Necesario porque la app no usa React Router: la deteccion estatica de
 * `window.location.pathname` no es reactiva por si sola, asi que sin este
 * hook un `pushState` no cambiaria la vista activa.
 */
export function usePathname(): string {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = (): void => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return pathname;
}

/**
 * Navega in-app a `path` empujando una entrada al historial y disparando un
 * evento `popstate` sintetico. `pushState` por si solo no notifica a los
 * listeners de `popstate`, asi que el dispatch manual es lo que sincroniza
 * el estado de `usePathname` con la nueva URL.
 *
 * Marca cada entrada con un sentinel en `history.state` para que
 * `navigateBack` distinga rutas creadas dentro de la app de las externas.
 */
export function navigateInApp(path: string): void {
  if (typeof window === 'undefined') return;
  window.history.pushState(IN_APP_STATE, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Vuelve a la entrada anterior del historial si fue creada por la app
 * (mediante `navigateInApp`); en caso contrario navega a `fallbackPath`.
 *
 * Usar `window.history.length` no es fiable porque incluye entradas previas
 * a la app (otra web del mismo dominio, por ejemplo). El sentinel en
 * `history.state` es la forma correcta de saber si "atras" devuelve al
 * usuario a una pantalla nuestra o lo saca del sitio.
 */
export function navigateBack(fallbackPath: string = '/'): void {
  if (typeof window === 'undefined') return;
  const state = window.history.state as InAppHistoryState | null;
  if (state?.__cadenciaInApp === true) {
    window.history.back();
  } else {
    navigateInApp(fallbackPath);
  }
}
