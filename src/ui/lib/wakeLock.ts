/**
 * Pequeña utilidad sobre la Screen Wake Lock API que evita que la pantalla
 * del movil/tablet/portatil se apague durante una sesion activa del modo TV.
 *
 * El caso tipico es indoor: el usuario mira los numeros mientras pedalea
 * sin tocar la pantalla. Sin Wake Lock, Android/iOS apagan la pantalla a
 * los ~30s y muchos navegadores moviles entran en modo background, lo que
 * silencia/cancela tanto los beeps (Web Audio) como el TTS
 * (`speechSynthesis`). Por eso request/release acompañan al ciclo
 * play/pause del modo TV.
 *
 * Se re-adquiere automaticamente al volver a la pestana (visibilitychange)
 * porque el sistema libera el lock cuando la pestana pierde visibilidad —
 * sin re-adquirir, basta cambiar a Spotify y volver para perderlo.
 *
 * Soporte: Chrome 84+, Edge, Opera, Safari 16.4+, Firefox 126+. En
 * navegadores sin soporte (`'wakeLock' in navigator === false`), las
 * funciones son no-op silenciosas — no obligamos al llamador a comprobar.
 */

let sentinel: WakeLockSentinel | null = null;
let active = false;
let visibilityListenerAttached = false;

function isAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function acquire(): Promise<void> {
  if (!isAvailable()) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // El sistema puede negar el lock (bateria baja, modo ahorro). No es
    // critico — la sesion sigue funcionando, simplemente la pantalla
    // puede apagarse. No spammeamos el log.
  }
}

function ensureVisibilityListener(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (active && document.visibilityState === 'visible' && sentinel === null) {
      void acquire();
    }
  });
}

export const wakeLock = {
  /** `true` si la API esta disponible. Util para no mostrar UI engañosa. */
  isSupported(): boolean {
    return isAvailable();
  },

  /**
   * Pide el lock. Idempotente: llamar varias veces no acumula sentinels.
   * Marca `active` para que el handler de `visibilitychange` re-adquiera
   * automaticamente al volver a la pestana.
   */
  async request(): Promise<void> {
    active = true;
    ensureVisibilityListener();
    if (sentinel !== null) return; // ya tenemos lock
    await acquire();
  },

  /**
   * Libera el lock y desactiva la re-adquisicion automatica. Llamar al
   * pausar/cerrar el modo TV.
   */
  async release(): Promise<void> {
    active = false;
    if (sentinel !== null) {
      try {
        await sentinel.release();
      } catch {
        // ignore
      }
      sentinel = null;
    }
  },
};
