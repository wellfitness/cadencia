import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPlayerState,
  getSpotifyClientId,
  next as apiNext,
  pause as apiPause,
  play as apiPlay,
  refreshAccessToken,
  saveTokens,
  tokensAreFresh,
  type PlayerError,
  type PlayerResult,
  type PlayerState,
  type SpotifyTokens,
} from '@integrations/spotify';

const POLL_INTERVAL_MS = 5_000;

export interface UseSpotifyTVPlayerArgs {
  /** Tokens iniciales (recibidos por el handoff). Se persisten en sessionStorage del tab /tv. */
  initialTokens: SpotifyTokens;
  /** Si false, el hook se queda inerte (todos los retornos van a sus defaults). */
  productPremium: boolean;
  /**
   * URIs por bloque, en orden. `blockTrackUris[i]` es el track que debe sonar
   * durante el bloque `i`. Cuando cambia `currentBlockIndex`, el hook fuerza
   * `play({uris: [blockTrackUris[i]], position_ms: 0})` para sincronizar.
   *
   * **El caller debe memoizar este array** (estable entre renders) para no
   * disparar efectos espurios. En la practica viene del handoff, que es
   * one-shot y no cambia en toda la vida del modo TV.
   */
  blockTrackUris: readonly string[];
  /** Indice del bloque actual del cronometro de SessionTVMode. */
  currentBlockIndex: number;
  /** True cuando el cronometro esta corriendo. Se usa solo para detectar pausas externas. */
  isRunning: boolean;
  /**
   * Callback disparado cuando el polling detecta que el reproductor esta
   * pausado pero el cronometro local sigue corriendo. SessionTVMode usa
   * esto para pausar tambien el cronometro y mantenerlo sincronizado.
   */
  onExternalPause: () => void;
}

export interface UseSpotifyTVPlayerResult {
  /** Estado mas reciente del reproductor (null hasta el primer poll exitoso). */
  playerState: PlayerState | null;
  /** Ultimo error de la API (null si todo va bien). Se borra al primer success posterior. */
  lastError: PlayerError | null;
  /**
   * True si hay un device activo (Spotify abierto en algun lado y reproduciendo
   * o pausado a la espera). Si false, la UI debe sugerir "abre Spotify".
   */
  hasActiveDevice: boolean;
  /** Pausa o reanuda segun el estado actual del reproductor. */
  togglePlay: () => Promise<void>;
  /** Salta al siguiente track (pasa al siguiente bloque musical). */
  skipNext: () => Promise<void>;
}

/**
 * Hook que gestiona la integracion del reproductor Spotify en el Modo TV.
 *
 * Responsabilidades:
 * 1. Mantener un access token vivo (refresh transparente cuando expira).
 * 2. Polling de `/me/player` cada 5s para detectar cambios externos.
 * 3. Sincronizar el cambio de bloque con un play() de la URI esperada.
 * 4. Exponer comandos play/pause/next a la UI de la barra de controles.
 *
 * No mantiene su propio cronometro: SessionTVMode sigue siendo la fuente
 * de verdad del tiempo. El hook solo es un puente con la API de Spotify.
 *
 * Si `productPremium` es false, el hook se queda inerte: no consume cuota,
 * no falla, devuelve defaults vacios. Asi la UI puede llamarlo sin condicional.
 */
export function useSpotifyTVPlayer(
  args: UseSpotifyTVPlayerArgs,
): UseSpotifyTVPlayerResult {
  const {
    initialTokens,
    productPremium,
    blockTrackUris,
    currentBlockIndex,
    isRunning,
    onExternalPause,
  } = args;

  const tokensRef = useRef<SpotifyTokens>(initialTokens);
  const onExternalPauseRef = useRef(onExternalPause);
  useEffect(() => {
    onExternalPauseRef.current = onExternalPause;
  }, [onExternalPause]);

  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [lastError, setLastError] = useState<PlayerError | null>(null);

  // Persistir tokens en sessionStorage del tab /tv en el primer mount, asi un
  // F5 dentro de /tv no pierde la sesion. El handoff de localStorage ya se
  // consumio en TVModeRoute, pero los tokens viajan por separado.
  //
  // Solo si productPremium: cuando el usuario no tiene Spotify conectado, el
  // caller pasa tokens vacios (placeholder por la regla de hooks). No queremos
  // sobrescribir el sessionStorage con tokens basura — el hook esta inerte
  // de todas formas.
  useEffect(() => {
    if (!productPremium) return;
    if (initialTokens.accessToken.length === 0) return;
    saveTokens(initialTokens);
    // Solo en el primer mount: initialTokens es el snapshot inicial. Si el
    // handoff cambia (no deberia en /tv), no queremos sobrescribir tokens
    // refrescados en este tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Helper: ejecuta una llamada API garantizando que el token este fresh.
   * Si el token esta expirado, refresca antes. Si la llamada devuelve
   * `token-expired` (carrera con la expiracion), refresca y reintenta UNA
   * vez. Mas reintentos serian indicativos de un problema mas profundo.
   */
  const callWithFreshToken = useCallback(
    async <T>(
      fn: (accessToken: string) => Promise<PlayerResult<T>>,
    ): Promise<PlayerResult<T>> => {
      // Sin clientId no podemos refrescar el token. La causa habitual: el
      // usuario borro su Client ID custom desde "Mis preferencias" mientras
      // estaba en Modo TV y el .env tampoco tiene fallback. Devolvemos error
      // clasificable para que la UI lo presente con accion "ir a preferencias".
      const clientId = getSpotifyClientId();
      if (clientId === null) {
        return {
          ok: false,
          error: { kind: 'network', message: 'No hay Client ID de Spotify configurado.' },
        };
      }
      let tokens = tokensRef.current;
      if (!tokensAreFresh(tokens)) {
        try {
          tokens = await refreshAccessToken({
            clientId,
            refreshToken: tokens.refreshToken,
          });
          tokensRef.current = tokens;
          saveTokens(tokens);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Refresh failed';
          return {
            ok: false,
            error: { kind: 'network', message, method: 'POST', path: '/api/token' },
          };
        }
      }
      let result = await fn(tokens.accessToken);
      if (!result.ok && result.error.kind === 'token-expired') {
        // Carrera: el token expiro entre el check y la peticion. Refresh y retry una vez.
        try {
          tokens = await refreshAccessToken({
            clientId,
            refreshToken: tokensRef.current.refreshToken,
          });
          tokensRef.current = tokens;
          saveTokens(tokens);
          result = await fn(tokens.accessToken);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Refresh failed';
          return {
            ok: false,
            error: { kind: 'network', message, method: 'POST', path: '/api/token' },
          };
        }
      }
      return result;
    },
    [],
  );

  // Polling de /me/player cada 5s, mas un fetch inmediato al montar.
  useEffect(() => {
    if (!productPremium) return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      const result = await callWithFreshToken(getPlayerState);
      if (cancelled) return;
      if (result.ok) {
        setPlayerState(result.value);
        setLastError(null);
        // Pausa externa: el usuario pauso desde Spotify mientras nuestro
        // cronometro seguia corriendo. Lo notificamos para que el cronometro
        // se sincronice.
        if (
          isRunning &&
          !result.value.isPlaying &&
          result.value.device !== null
        ) {
          onExternalPauseRef.current();
        }
      } else {
        setLastError(result.error);
      }
    };
    void poll();
    const id = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [productPremium, isRunning, callWithFreshToken]);

  // Block sync: cuando cambia el indice del bloque, forzamos play() del URI
  // esperado para que timer y musica vayan acompasados. Solo cuando la sesion
  // esta corriendo: si esta pausada, el usuario quiere mantener silencio.
  const lastSyncedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (!productPremium) return;
    if (!isRunning) return;
    if (lastSyncedIndexRef.current === currentBlockIndex) return;
    const uri = blockTrackUris[currentBlockIndex];
    if (uri === undefined) return;
    lastSyncedIndexRef.current = currentBlockIndex;
    void callWithFreshToken((token) =>
      apiPlay(token, { uris: [uri], positionMs: 0 }),
    ).then((result) => {
      if (!result.ok) setLastError(result.error);
    });
  }, [
    productPremium,
    isRunning,
    currentBlockIndex,
    blockTrackUris,
    callWithFreshToken,
  ]);

  const togglePlay = useCallback(async (): Promise<void> => {
    if (!productPremium) return;
    const isPlayingNow = playerState?.isPlaying === true;
    if (isPlayingNow) {
      const result = await callWithFreshToken((token) => apiPause(token));
      if (!result.ok) setLastError(result.error);
      else setPlayerState((prev) => (prev !== null ? { ...prev, isPlaying: false } : prev));
    } else {
      // Resume sin URI: deja que Spotify reanude desde donde estaba pausado.
      // El cambio de bloque ya se encarga de forzar la URI correcta cuando toca.
      const result = await callWithFreshToken((token) => apiPlay(token, {}));
      if (!result.ok) setLastError(result.error);
      else setPlayerState((prev) => (prev !== null ? { ...prev, isPlaying: true } : prev));
    }
  }, [productPremium, playerState, callWithFreshToken]);

  const skipNext = useCallback(async (): Promise<void> => {
    if (!productPremium) return;
    const result = await callWithFreshToken((token) => apiNext(token));
    if (!result.ok) setLastError(result.error);
  }, [productPremium, callWithFreshToken]);

  return {
    playerState,
    lastError,
    hasActiveDevice:
      playerState?.device !== null && playerState?.device !== undefined,
    togglePlay,
    skipNext,
  };
}
