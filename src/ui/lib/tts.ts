/**
 * Wrapper typed sobre la Web Speech API (`speechSynthesis`) para anuncios
 * de voz en castellano dentro del modo TV.
 *
 * Cadencia es PWA pura (sin APK Android), asi que NO necesitamos el
 * bridge Android nativo que sí usa `KinesisTTS` en otros proyectos del
 * autor. Aqui basta con `window.speechSynthesis`.
 *
 * Quirks que mitigamos:
 *  1. iOS Safari rechaza arrancar el motor TTS fuera de un gesto humano
 *     — igual que con AudioContext. Por eso `warmup()` se invoca desde el
 *     boton Play del modo TV (y desde la barra espaciadora).
 *  2. La lista de voces se carga asincrona en algunos navegadores
 *     (Chrome). Escuchamos `voiceschanged` y re-seleccionamos.
 *  3. `speechSynthesis.cancel()` antes de cada `speak()` evita que un
 *     anuncio quede en cola si el usuario salta varias fases rapido (con
 *     las flechas) y se acumulan utterances.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesListenerAttached = false;

function isAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Selecciona la mejor voz disponible para castellano. Preferimos en este
 * orden:
 *   1. Una voz cuyo `lang` empiece por "es-ES" (España).
 *   2. Cualquier voz cuyo `lang` empiece por "es" (Latam, US-Spanish, etc.).
 *   3. La voz por defecto del navegador.
 *   4. La primera disponible.
 *
 * Devuelve `null` si la API no esta disponible o no hay voces cargadas
 * todavia (en cuyo caso el navegador usara su default automaticamente).
 */
function pickBestSpanishVoice(): SpeechSynthesisVoice | null {
  if (!isAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('es-es')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    voices.find((v) => v.default) ??
    voices[0] ??
    null
  );
}

function refreshVoice(): void {
  cachedVoice = pickBestSpanishVoice();
}

function ensureVoicesListener(): void {
  if (voicesListenerAttached || !isAvailable()) return;
  voicesListenerAttached = true;
  refreshVoice();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoice);
}

export const tts = {
  /**
   * `true` si el navegador expone `speechSynthesis`. Si devuelve `false`,
   * el modo TV oculta el boton de voz y degrada al comportamiento legacy
   * (acorde de cambio de fase).
   */
  isSupported(): boolean {
    return isAvailable();
  },

  /**
   * Pre-arma el motor TTS desde un gesto humano (clic Play, barra
   * espaciadora). En iOS Safari, sin warmup desde gesto el primer
   * `speak()` provoca que el motor nazca suspendido y la voz quede muda.
   *
   * El truco es lanzar un utterance vacio con volumen 0: arma el motor
   * sin que el usuario oiga nada.
   */
  warmup(): void {
    if (!isAvailable()) return;
    ensureVoicesListener();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.lang = 'es-ES';
      u.volume = 0;
      if (cachedVoice) u.voice = cachedVoice;
      window.speechSynthesis.speak(u);
    } catch {
      // Motor no disponible o bloqueado por politica de gesto: degradacion silenciosa.
    }
  },

  /**
   * Habla el texto cancelando cualquier utterance previo. Fire-and-forget.
   * Si el TTS no esta disponible, no hace nada (el llamador puede caer al
   * comportamiento legacy si quiere — aqui no devolvemos error para no
   * obligar a manejarlo en cada call site).
   */
  speak(text: string): void {
    if (!isAvailable() || !text) return;
    ensureVoicesListener();
    try {
      // Cancelar cola anterior: el usuario salto de fase mientras la voz
      // hablaba. Sin esto, el motor encola y oimos «Zona 4...» seguido de
      // «Zona 5...» con mucho retraso.
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      u.volume = 1;
      u.rate = 1.0;
      if (cachedVoice) u.voice = cachedVoice;
      window.speechSynthesis.speak(u);
    } catch {
      // Algunos navegadores rechazan speak() en estado raro: degradacion silenciosa.
    }
  },

  /**
   * Detiene cualquier utterance en curso o en cola. Llamar al desmontar
   * el componente para no dejar la voz hablando despues de cerrar el
   * modo TV.
   */
  cancel(): void {
    if (!isAvailable()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  },
};
