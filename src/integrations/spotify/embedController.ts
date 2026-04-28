/**
 * Wrapper de la Spotify IFrame API. Permite reproducir previews sin mostrar
 * el reproductor visible: monta un iframe oculto (1×1 px fuera del viewport),
 * y controla play/pause/loadUri por postMessage.
 *
 * - Singleton: una única instancia del controller para toda la app.
 * - Carga la API una sola vez (lazy, primer click).
 * - Para usuarios sin sesión Spotify reproduce 30 s; con sesión, track completo.
 *   Ese comportamiento lo decide el propio embed, nosotros solo lo invocamos.
 *
 * No requiere OAuth ni token: el embed es endpoint público de Spotify.
 */

interface PlaybackState {
  position: number;
  duration: number;
  isPaused: boolean;
  isBuffering: boolean;
}

interface SpotifyController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  destroy(): void;
  addListener(event: 'ready' | 'playback_update', cb: (e: { data: PlaybackState }) => void): void;
}

interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}

type Listener = (state: { uri: string | null; isPaused: boolean }) => void;

const SCRIPT_URL = 'https://open.spotify.com/embed/iframe-api/v1';

let apiPromise: Promise<SpotifyIFrameAPI> | null = null;
let controllerPromise: Promise<SpotifyController> | null = null;
let currentUri: string | null = null;
let isPaused = true;
const listeners = new Set<Listener>();

function notify(): void {
  const snapshot = { uri: currentUri, isPaused };
  listeners.forEach((l) => l(snapshot));
}

function loadApi(): Promise<SpotifyIFrameAPI> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (api): void => {
      resolve(api);
    };
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);
  });
  return apiPromise;
}

function getController(): Promise<SpotifyController> {
  if (controllerPromise) return controllerPromise;
  controllerPromise = loadApi().then(
    (api) =>
      new Promise<SpotifyController>((resolve) => {
        // Contenedor oculto fuera de viewport pero presente en el DOM (los
        // browsers exigen iframe montado para que el audio funcione, pero
        // no requieren visibilidad si el play viene de un gesto humano).
        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-9999px';
        host.style.top = '0';
        host.style.width = '300px';
        host.style.height = '80px';
        host.setAttribute('aria-hidden', 'true');
        document.body.appendChild(host);

        api.createController(host, { uri: '', width: 300, height: 80 }, (controller) => {
          controller.addListener('playback_update', (event) => {
            isPaused = event.data.isPaused;
            notify();
          });
          resolve(controller);
        });
      }),
  );
  return controllerPromise;
}

export async function playPreview(uri: string): Promise<void> {
  const controller = await getController();
  if (currentUri !== uri) {
    currentUri = uri;
    isPaused = true;
    notify();
    controller.loadUri(uri);
  }
  controller.play();
}

export async function pausePreview(): Promise<void> {
  if (!controllerPromise) return;
  const controller = await controllerPromise;
  controller.pause();
}

export function subscribePreview(listener: Listener): () => void {
  listeners.add(listener);
  // Estado inicial
  listener({ uri: currentUri, isPaused });
  return () => {
    listeners.delete(listener);
  };
}
