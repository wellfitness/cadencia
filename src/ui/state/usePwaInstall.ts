import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Evento `beforeinstallprompt` de Chrome (no esta en lib.dom estandar).
 * Solo Chromium-based (Chrome, Edge, Opera, Samsung) lo emiten.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallState {
  /** Chrome considera la app instalable y nos ha cedido el control del prompt. */
  canInstall: boolean;
  /** El prompt nativo esta abierto en este momento. */
  installing: boolean;
  /** La app ya corre en modo standalone o el usuario acaba de instalarla. */
  installed: boolean;
  /** Lanza el prompt nativo. No-op si `canInstall` es false. */
  install: () => Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone (no expone display-mode standalone)
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Gestiona el prompt de instalacion PWA en Chrome/Edge.
 *
 * Chrome dispara `beforeinstallprompt` cuando se cumplen los criterios
 * (manifest valido, SW activo, HTTPS, suficiente engagement). Capturamos
 * el evento y exponemos `install()` para que un boton manual lo dispare.
 *
 * Safari/Firefox no emiten este evento; alli `canInstall` siempre sera false
 * (en iOS la instalacion va por "Compartir > Anadir a pantalla de inicio").
 */
export function usePwaInstall(): PwaInstallState {
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event): void => {
      // Suprime la mini-infobar nativa para que controlemos nosotros la UX.
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onAppInstalled = (): void => {
      promptRef.current = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return (): void => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<void> => {
    const ev = promptRef.current;
    if (!ev) return;
    setInstalling(true);
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      // El evento solo se puede usar una vez segun la spec.
      promptRef.current = null;
      setCanInstall(false);
    } finally {
      setInstalling(false);
    }
  }, []);

  return { canInstall, installing, installed, install };
}
