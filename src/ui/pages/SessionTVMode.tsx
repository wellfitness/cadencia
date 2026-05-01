import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateKarvonenZones,
  formatRpeRange,
  getZoneFeeling,
  type HeartRateZone,
  type KarvonenZoneRange,
} from '@core/physiology';
import {
  expandSessionPlan,
  findTemplate,
  getRecommendedCadence,
  type CadenceProfile,
  type EditableSessionPlan,
  type SessionBlock,
  type SessionTemplate,
} from '@core/segmentation';
import { getZoneCriteria } from '@core/matching';
import { EMPTY_USER_INPUTS, type Sport, type ValidatedUserInputs } from '@core/user/userInputs';
import { Logo } from '@ui/components/Logo';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { zoneTextColor } from '@ui/components/zoneColors';
import { tts } from '@ui/lib/tts';
import { wakeLock } from '@ui/lib/wakeLock';
import { buildPhaseAnnouncement, COMPLETION_ANNOUNCEMENT } from '@ui/lib/ttsMessages';
import { updateSection, useCadenciaData } from '@ui/state/cadenciaStore';
import { TestResultDialog } from '@ui/components/session-builder/TestResultDialog';
import { MusicControlBar } from '@ui/components/tv/MusicControlBar';
import { useSpotifyTVPlayer } from '@ui/components/tv/useSpotifyTVPlayer';
import type { TVHandoffSpotify } from '@core/tv/tvHandoff';

const CADENCE_PROFILE_LABELS: Record<CadenceProfile, string> = {
  flat: 'Llano',
  climb: 'Escalada',
  sprint: 'Sprint',
};

export interface SessionTVModeProps {
  plan: EditableSessionPlan;
  validatedInputs: ValidatedUserInputs;
  /**
   * Id de la plantilla que origino este plan, si la sesion proviene de una.
   * Se usa para detectar plantillas-test (`kind === 'test'`) y disparar el
   * TestResultDialog al completar la sesion. Indefinido cuando el usuario
   * construyo el plan desde cero o lo importo de un .zwo.
   */
  templateId?: string;
  /**
   * Datos de Spotify para activar los controles integrados de musica
   * (Premium-only, progressive enhancement). Indefinido si el usuario no
   * tiene sesion Spotify, no es Premium, o el token no incluye los scopes
   * de player. En ese caso el Modo TV cae al comportamiento legacy.
   */
  spotify?: TVHandoffSpotify;
  onClose: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  warmup: 'CALENTAMIENTO',
  work: 'TRABAJO',
  recovery: 'RECUPERACIÓN',
  rest: 'DESCANSO',
  cooldown: 'VUELTA A LA CALMA',
  main: 'PRINCIPAL',
};

/**
 * Iconos por fase. La fase 'main' es el unico icono dependiente del deporte:
 * en bike pintamos una bici, en run un corredor. El resto son universales
 * (calentamiento, descanso, etc.) y se reutilizan tal cual.
 */
function getPhaseIcon(phase: string, sport: Sport): string {
  switch (phase) {
    case 'warmup':
      return 'whatshot';
    case 'work':
      return 'fitness_center';
    case 'recovery':
      return 'self_improvement';
    case 'rest':
      return 'pause_circle';
    case 'cooldown':
      return 'ac_unit';
    case 'main':
      return sport === 'run' ? 'directions_run' : 'directions_bike';
    default:
      return 'fitness_center';
  }
}

const ZONE_BG_DARK: Record<HeartRateZone, string> = {
  1: 'bg-zone-1',
  2: 'bg-zone-2',
  3: 'bg-zone-3',
  4: 'bg-zone-4',
  5: 'bg-zone-5',
  6: 'bg-zone-6',
};

const ZONE_TEXT: Record<HeartRateZone, string> = {
  1: 'text-zone-1',
  2: 'text-zone-2',
  3: 'text-zone-3',
  4: 'text-zone-4',
  5: 'text-zone-5',
  6: 'text-zone-6',
};

const ZONE_PERCENT_FCR: Record<HeartRateZone, string> = {
  1: '50-60% FCR',
  2: '60-70% FCR',
  3: '70-80% FCR',
  4: '80-90% FCR',
  5: '90-100% FCR',
  6: '100% FCR',
};

const WARNING_BEEP_TIMES = new Set([10, 5, 3, 2, 1]);

/**
 * Modo TV: cronometro fase a fase con beeps de aviso, voz del entrenador,
 * atajos de teclado y feedback visual prominente. Pensado para usar
 * mientras suena la playlist de Spotify en otra app (la app no controla
 * audio externo).
 *
 * Voz: al iniciar cada bloque se anuncia «Zona X, sensacion, cadencia,
 * duracion. RPE». Sustituye al acorde de cambio de fase para no saturar.
 * Si el usuario silencia la voz (atajo V o boton), el acorde vuelve como
 * red de seguridad sonora.
 *
 * Wake Lock: mientras isRunning, se mantiene la pantalla encendida via
 * Screen Wake Lock API (Chrome 84+, Safari 16.4+). Sin esto, la pantalla
 * se apaga a los ~30s y muchos navegadores moviles silencian el audio.
 *
 * Atajos: Space (play/pause), Flechas (saltar fase), Esc (cerrar),
 *         S (sonido), V (voz), R (reiniciar).
 */
export function SessionTVMode({
  plan,
  validatedInputs,
  templateId,
  spotify,
  onClose,
}: SessionTVModeProps): JSX.Element {
  const expanded = useMemo(() => expandSessionPlan(plan), [plan]);
  const blocks = expanded.blocks;

  /**
   * Busca la plantilla activa para detectar tests guiados. Indefinido si la
   * sesion no se origino desde plantilla o el id no esta en SESSION_TEMPLATES
   * (defensa contra desincronizaciones; tests-templates nuevas requieren
   * actualizar el union SessionTemplateId, asi que esto no ocurre en runtime
   * salvo si el handoff lleva basura).
   */
  const activeTemplate: SessionTemplate | undefined =
    templateId !== undefined ? findTemplate(templateId) : undefined;
  const testProtocol = activeTemplate?.kind === 'test' ? activeTemplate.testProtocol : undefined;
  // Default 'bike' por retrocompat con planes guardados antes de la extension
  // a running (mismo criterio que expandSessionPlan).
  const sport: Sport = plan.sport ?? 'bike';
  const isRun = sport === 'run';
  const totalDurationSec = useMemo(
    () => blocks.reduce((acc, b) => acc + b.durationSec, 0),
    [blocks],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(() => blocks[0]?.durationSec ?? 0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  /**
   * Tracking del modal post-test: true si el usuario ya guardo o salto el
   * resultado. Solo aplica si la sesion proviene de una plantilla-test.
   */
  const [testResultDismissed, setTestResultDismissed] = useState(false);

  // Detección estable: Safari iOS no implementa Vibration API, ni la mayoría
  // de tablets tiene motor háptico aunque navegador la exponga.
  const vibrationSupported = useMemo(
    () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    [],
  );

  // Soporte de TTS: si el navegador no expone speechSynthesis, ocultamos el
  // boton de voz y degradamos al comportamiento legacy (acorde de cambio).
  const ttsSupported = useMemo(() => tts.isSupported(), []);

  // Persistencia de la preferencia voz on/off en cadenciaStore (sincroniza
  // con Drive). Default true cuando el usuario nunca lo ha tocado.
  const cadenciaData = useCadenciaData();
  const voiceEnabledStored = cadenciaData.tvModePrefs?.voiceEnabled ?? true;
  // El estado efectivo combina la preferencia del usuario con el soporte
  // del navegador. Todos los call sites consultan esto, no la prefencia
  // pura, para no intentar hablar en un browser sin TTS.
  const effectiveVoiceEnabled = voiceEnabledStored && ttsSupported;

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track del ultimo bloque cuyo anuncio TTS ya se disparo, para no
  // repetirlo al pausar/reanudar la misma fase. Se resetea con restart o
  // cuando cambia currentIndex.
  const announcedIndexRef = useRef<number | null>(null);

  // Pausa externa de Spotify (usuario pulso pause desde su movil mientras
  // el cronometro corria). Sincronizamos el cronometro local. Memoizado
  // para no thrashear los efectos del hook de Spotify.
  const handleExternalPause = useCallback((): void => {
    setIsRunning(false);
    void wakeLock.release();
  }, []);

  // Args estables para el hook de Spotify. Cuando no hay handoff de spotify
  // (usuario sin Premium / sin conectar), pasamos args neutros y el hook
  // se queda inerte (no consume cuota, no hace polling, no falla).
  const blockTrackUris = useMemo(
    () => spotify?.blockTrackUris ?? [],
    [spotify?.blockTrackUris],
  );
  const spotifyTV = useSpotifyTVPlayer({
    initialTokens: spotify?.tokens ?? {
      accessToken: '',
      refreshToken: '',
      expiresAtMs: 0,
      scope: '',
    },
    productPremium: spotify?.productPremium === true,
    blockTrackUris,
    currentBlockIndex: currentIndex,
    isRunning,
    onExternalPause: handleExternalPause,
  });

  const currentBlock = blocks[currentIndex];

  // Zonas Karvonen (si el usuario tiene FC max y reposo)
  const karvonenZones = useMemo<KarvonenZoneRange[] | null>(() => {
    if (
      !validatedInputs.hasHeartRateZones ||
      validatedInputs.effectiveMaxHr === null ||
      validatedInputs.restingHeartRate === null
    ) {
      return null;
    }
    return calculateKarvonenZones(
      validatedInputs.effectiveMaxHr,
      validatedInputs.restingHeartRate,
    );
  }, [validatedInputs]);

  const currentZoneFc = useMemo(() => {
    if (currentBlock === undefined || karvonenZones === null) return null;
    return karvonenZones.find((z) => z.zone === currentBlock.zone) ?? null;
  }, [currentBlock, karvonenZones]);

  // iOS Safari rechaza crear/reanudar AudioContext fuera de un gesto humano: si
  // el primer beep llega desde el setInterval del timer (warning a 10s del fin
  // de fase), el contexto nace 'suspended' y queda mudo el resto de la sesion.
  // Por eso este helper se invoca tambien desde toggleRunning, que es el unico
  // gesto fiable (clic en Play o barra espaciadora) en el ciclo del modo TV.
  const ensureAudioContext = useCallback((): void => {
    if (audioContextRef.current === null) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx === undefined) return;
      try {
        audioContextRef.current = new Ctx();
      } catch {
        return;
      }
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Si resume rechaza (fuera de gesto), degradamos en silencio.
      });
    }
  }, []);

  const playBeep = useCallback(
    (frequency: number, durationMs: number, volume = 0.3): void => {
      if (!soundEnabled) return;
      try {
        ensureAudioContext();
        const ctx = audioContextRef.current;
        if (ctx === null) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        osc.type = 'sine';
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch {
        // Audio no disponible: degradacion silenciosa
      }
    },
    [soundEnabled, ensureAudioContext],
  );

  const vibrate = useCallback(
    (pattern: number | number[]): void => {
      if (!vibrationEnabled || !vibrationSupported) return;
      try {
        navigator.vibrate(pattern);
      } catch {
        // No disponible: degradacion silenciosa
      }
    },
    [vibrationEnabled, vibrationSupported],
  );

  const playWarning = useCallback((): void => {
    playBeep(660, 100, 0.25);
    vibrate(80);
  }, [playBeep, vibrate]);

  const playPhaseChange = useCallback((): void => {
    playBeep(880, 150);
    setTimeout(() => playBeep(1100, 150), 200);
    setTimeout(() => playBeep(1320, 300), 400);
  }, [playBeep]);

  const playCompletion = useCallback((): void => {
    playBeep(523, 200);
    setTimeout(() => playBeep(659, 200), 250);
    setTimeout(() => playBeep(784, 200), 500);
    setTimeout(() => playBeep(1047, 400), 750);
    vibrate([300, 100, 300, 100, 500]);
  }, [playBeep, vibrate]);

  const goToNextPhase = useCallback((): void => {
    if (currentIndex < blocks.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextBlock = blocks[nextIndex];
      setCurrentIndex(nextIndex);
      setTimeRemaining(nextBlock?.durationSec ?? 0);
      // Si la voz está activa, el anuncio del nuevo bloque lo dispara el
      // useEffect de abajo (reactivo a currentIndex). El acorde se omite
      // para no solapar con la voz. Si la voz está silenciada o no
      // soportada, el acorde es el unico marcador audible del cambio.
      if (!effectiveVoiceEnabled) {
        playPhaseChange();
      }
      // Z6 → patrón más largo y rotundo para que destaque del cambio de fase
      // estándar, dado que es el tramo de máxima exigencia.
      const isMaxZone = nextBlock?.zone === 6;
      vibrate(isMaxZone ? [400, 80, 400, 80, 400] : [200, 100, 200]);
    } else {
      setIsCompleted(true);
      setIsRunning(false);
      playCompletion();
      if (effectiveVoiceEnabled) {
        tts.speak(COMPLETION_ANNOUNCEMENT);
      }
      // Liberar el wake lock al terminar — la sesion ya no esta activa.
      void wakeLock.release();
    }
  }, [currentIndex, blocks, playPhaseChange, playCompletion, vibrate, effectiveVoiceEnabled]);

  const goToPrevPhase = useCallback((): void => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevBlock = blocks[prevIndex];
      setCurrentIndex(prevIndex);
      setTimeRemaining(prevBlock?.durationSec ?? 0);
    }
  }, [currentIndex, blocks]);

  const toggleRunning = useCallback((): void => {
    // Pre-armar el AudioContext y el motor TTS en este gesto humano
    // (clic Play / barra espaciadora). iOS Safari requiere que ambos
    // motores se armen desde un gesto del usuario; si el primer beep o
    // utterance llega desde un setInterval, queda suspendido y mudo el
    // resto de la sesion.
    ensureAudioContext();
    if (effectiveVoiceEnabled) {
      tts.warmup();
    }
    setIsRunning((prev) => {
      const next = !prev;
      // Pedir/liberar wake lock en el mismo gesto: pantalla encendida
      // mientras la sesion esta activa, sleep normal cuando se pausa.
      if (next) {
        void wakeLock.request();
      } else {
        void wakeLock.release();
      }
      return next;
    });
    // Sincronizar musica con cronometro cuando hay sesion Spotify activa.
    // Solo despues del primer arranque (cuando ya hay un playerState):
    // el primer Play lo gestiona el block-sync del hook, que carga la URI
    // del bloque con play({uris}). Si llamasemos a togglePlay aqui en el
    // arranque inicial, podriamos llegar antes que el block-sync y mandar
    // un play({}) sin URI → 404 No Active Device aunque haya device.
    if (spotify !== undefined && spotifyTV.playerState !== null) {
      void spotifyTV.togglePlay();
    }
  }, [ensureAudioContext, effectiveVoiceEnabled, spotify, spotifyTV]);

  const restart = useCallback((): void => {
    setCurrentIndex(0);
    setTimeRemaining(blocks[0]?.durationSec ?? 0);
    setTotalElapsed(0);
    setIsCompleted(false);
    setIsRunning(false);
    // Permitir reanunciar el bloque 0 al volver a pulsar Play, y detener
    // cualquier voz en curso (ej. "Sesion completada" si se reinicia
    // antes de que termine de hablar).
    announcedIndexRef.current = null;
    tts.cancel();
    void wakeLock.release();
  }, [blocks]);

  /**
   * Anuncia por voz el bloque actual en cuanto la sesion arranca o cambia
   * de fase. Usa announcedIndexRef como guard para no repetir el anuncio
   * al pausar/reanudar la misma fase.
   */
  useEffect(() => {
    if (!isRunning || isCompleted) return;
    if (announcedIndexRef.current === currentIndex) return;
    announcedIndexRef.current = currentIndex;
    if (!effectiveVoiceEnabled || currentBlock === undefined) return;
    tts.speak(buildPhaseAnnouncement(currentBlock, sport));
  }, [isRunning, isCompleted, currentIndex, currentBlock, effectiveVoiceEnabled, sport]);

  /**
   * Cleanup al desmontar el modo TV (Esc, ruta cambia, etc): detener la
   * voz y liberar el wake lock. Sin esto, la voz puede seguir hablando
   * despues de cerrar la pantalla, y el lock queda colgado hasta el
   * siguiente release implicito del navegador.
   */
  useEffect(() => {
    return () => {
      tts.cancel();
      void wakeLock.release();
    };
  }, []);

  // Timer principal
  useEffect(() => {
    if (!isRunning || isCompleted) return;
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // El cambio de fase se gestiona en el siguiente render via efecto
          return 0;
        }
        if (WARNING_BEEP_TIMES.has(prev - 1)) {
          playWarning();
        }
        return prev - 1;
      });
      setTotalElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isCompleted, playWarning]);

  // Avanzar de fase cuando el timer llega a 0
  useEffect(() => {
    if (isRunning && !isCompleted && timeRemaining === 0 && currentBlock !== undefined) {
      goToNextPhase();
    }
  }, [timeRemaining, isRunning, isCompleted, currentBlock, goToNextPhase]);

  /**
   * Persiste el toggle de voz en cadenciaStore (sincroniza con Drive si
   * el usuario tiene Drive conectado). El default cuando nunca se ha
   * tocado es true, asi que el primer toggle escribe `false`.
   */
  const toggleVoice = useCallback((): void => {
    const next = !voiceEnabledStored;
    updateSection('tvModePrefs', { voiceEnabled: next });
    if (!next) {
      // Si el usuario silencia la voz mientras un anuncio esta sonando,
      // cortarlo en el acto en vez de esperar a que termine la frase.
      tts.cancel();
    }
  }, [voiceEnabledStored]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          toggleRunning();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextPhase();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevPhase();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setSoundEnabled((prev) => !prev);
          break;
        case 'v':
        case 'V':
          if (!ttsSupported) break;
          e.preventDefault();
          toggleVoice();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          restart();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRunning, goToNextPhase, goToPrevPhase, onClose, restart, toggleVoice, ttsSupported]);

  if (blocks.length === 0 || currentBlock === undefined) {
    return (
      <div className="min-h-[100dvh] bg-gris-900 text-white flex items-center justify-center p-8">
        <p className="text-xl">No hay bloques en la sesión.</p>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <>
        <CompletionScreen
          sessionName={plan.name}
          totalElapsedSec={totalElapsed}
          phaseCount={blocks.length}
          blocks={blocks}
          onRestart={restart}
          onClose={onClose}
        />
        {testProtocol !== undefined &&
          activeTemplate !== undefined &&
          !testResultDismissed && (
            <TestResultDialog
              templateName={activeTemplate.name}
              testProtocol={testProtocol}
              user={cadenciaData.userInputs ?? EMPTY_USER_INPUTS}
              onSaved={(delta) => {
                const current = cadenciaData.userInputs ?? EMPTY_USER_INPUTS;
                updateSection('userInputs', { ...current, ...delta });
                setTestResultDismissed(true);
              }}
              onSkipped={() => setTestResultDismissed(true)}
            />
          )}
      </>
    );
  }

  const phaseProgressPct =
    currentBlock.durationSec > 0
      ? ((currentBlock.durationSec - timeRemaining) / currentBlock.durationSec) * 100
      : 0;
  const totalProgressPct = totalDurationSec > 0 ? (totalElapsed / totalDurationSec) * 100 : 0;

  return (
    <div className="min-h-[100dvh] bg-gris-900 text-white flex flex-col">
      <header className="bg-black/50 px-3 sm:px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 min-w-0 flex-1 basis-full sm:basis-auto">
          <Logo
            variant="brand"
            size="sm"
            tone="dark"
            className="flex-shrink-0"
          />
          <div className="min-w-0 border-l border-white/20 pl-3">
            <h1 className="text-base md:text-xl font-bold truncate">{plan.name}</h1>
            <p className="text-xs md:text-sm opacity-70">
              Bloque {currentIndex + 1} de {blocks.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <ControlButton
            label="Fase anterior"
            icon="skip_previous"
            onClick={goToPrevPhase}
            disabled={currentIndex === 0}
          />
          <ControlButton
            label={isRunning ? 'Pausar' : 'Iniciar'}
            icon={isRunning ? 'pause' : 'play_arrow'}
            onClick={toggleRunning}
            highlight={isRunning}
          />
          <ControlButton
            label="Fase siguiente"
            icon="skip_next"
            onClick={goToNextPhase}
            disabled={currentIndex >= blocks.length - 1}
          />
          <ControlButton
            label={soundEnabled ? 'Silenciar beeps' : 'Activar beeps'}
            icon={soundEnabled ? 'volume_up' : 'volume_off'}
            onClick={() => setSoundEnabled((prev) => !prev)}
          />
          {ttsSupported && (
            <ControlButton
              label={voiceEnabledStored ? 'Silenciar voz del entrenador' : 'Activar voz del entrenador'}
              icon={voiceEnabledStored ? 'record_voice_over' : 'voice_over_off'}
              onClick={toggleVoice}
            />
          )}
          {vibrationSupported && (
            <ControlButton
              label={vibrationEnabled ? 'Desactivar vibración' : 'Activar vibración'}
              icon={vibrationEnabled ? 'vibration' : 'phone_android'}
              onClick={() => setVibrationEnabled((prev) => !prev)}
            />
          )}
          <ControlButton label="Reiniciar" icon="replay" onClick={restart} />
          <ControlButton label="Cerrar modo TV" icon="close" onClick={onClose} variant="danger" />
        </div>
      </header>

      {spotify !== undefined && (
        <MusicControlBar
          playerState={spotifyTV.playerState}
          lastError={spotifyTV.lastError}
          hasActiveDevice={spotifyTV.hasActiveDevice}
          onTogglePlay={() => void spotifyTV.togglePlay()}
          onSkipNext={() => void spotifyTV.skipNext()}
        />
      )}

      <div className="h-1.5 bg-black/40">
        <div
          className={`h-full ${ZONE_BG_DARK[currentBlock.zone]} transition-all duration-1000`}
          style={{ width: `${totalProgressPct}%` }}
        />
      </div>

      <PhaseTimeline
        blocks={blocks}
        currentIndex={currentIndex}
        onSelect={(i) => {
          setCurrentIndex(i);
          setTimeRemaining(blocks[i]?.durationSec ?? 0);
        }}
      />

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div
          className={`w-full max-w-4xl rounded-2xl md:rounded-3xl border-4 overflow-hidden shadow-2xl bg-black/50 ${zoneToBorder(currentBlock.zone)}`}
        >
          <div className={`${ZONE_BG_DARK[currentBlock.zone]} ${zoneTextColor(currentBlock.zone)} px-4 md:px-8 py-4 md:py-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-3 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <span className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl bg-white/30 flex-shrink-0">
                  <MaterialIcon
                    name={getPhaseIcon(currentBlock.phase, sport)}
                    size="large"
                    className="text-white"
                  />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl md:text-4xl font-bold leading-tight">
                    {PHASE_LABELS[currentBlock.phase] ?? currentBlock.phase.toUpperCase()}
                  </h2>
                  <p className="font-display text-2xl sm:text-3xl md:text-5xl leading-tight mt-1">
                    Zona {currentBlock.zone}
                    {!isRun && ` · ${CADENCE_PROFILE_LABELS[currentBlock.cadenceProfile]}`}
                  </p>
                  {(() => {
                    // Bike: rpm via getRecommendedCadence (zona+profile, Coggan/Dunst).
                    // Run: spm via filtro musical de running (rangos por zona, alineados
                    // con el matcher para no divergir entre lo que se muestra y lo que
                    // selecciona la musica).
                    const cadenceRange = isRun
                      ? (() => {
                          const c = getZoneCriteria(currentBlock.zone, 'flat', 'run');
                          return { min: c.cadenceMin, max: c.cadenceMax };
                        })()
                      : getRecommendedCadence(currentBlock.zone, currentBlock.cadenceProfile);
                    const unit = isRun ? 'spm' : 'rpm';
                    return (
                      <p className="text-sm sm:text-base md:text-xl opacity-90 mt-1 flex items-center gap-1.5">
                        <MaterialIcon name="speed" size="small" />
                        Cadencia: {cadenceRange.min}-{cadenceRange.max} {unit}
                      </p>
                    );
                  })()}
                  {(() => {
                    const feeling = getZoneFeeling(currentBlock.zone);
                    return (
                      <p className="text-sm sm:text-base md:text-xl opacity-90 mt-1 flex items-center gap-1.5">
                        <MaterialIcon name="psychology" size="small" />
                        {formatRpeRange(feeling)} · «{feeling.sensation}»
                      </p>
                    );
                  })()}
                </div>
              </div>
              {currentZoneFc !== null ? (
                <div className="text-left sm:text-right flex-shrink-0">
                  <div className="flex items-center sm:justify-end gap-1.5 md:gap-2 text-xl sm:text-2xl md:text-4xl font-bold">
                    <MaterialIcon
                      name="favorite"
                      size="medium"
                      className="motion-safe:animate-pulse"
                    />
                    <span className="tabular-nums">
                      {Math.round(currentZoneFc.minBpm)}-{Math.round(currentZoneFc.maxBpm)}
                    </span>
                    <span className="text-sm sm:text-base md:text-2xl opacity-70">bpm</span>
                  </div>
                  <p className="text-sm sm:text-base md:text-xl font-semibold mt-0.5 opacity-90">
                    {ZONE_PERCENT_FCR[currentBlock.zone]}
                  </p>
                </div>
              ) : (
                // Sin Karvonen: el modo TV se queda mudo respecto a "qué pulso buscar".
                // El flujo normal exige FC en sesion, pero defensive-by-default por si
                // se entra al modo TV con datos parciales (FC max sin reposo, FTP solo).
                <div
                  className="text-left sm:text-right flex-shrink-0 text-xs md:text-sm opacity-70 max-w-[16rem]"
                  title="Añade FC máxima y FC en reposo en «Datos» para ver pulsaciones objetivo."
                >
                  <p className="flex items-center sm:justify-end gap-1.5">
                    <MaterialIcon name="info" size="small" />
                    Sin pulsaciones objetivo
                  </p>
                  <p className="opacity-80">
                    Completa FC máx y reposo en «Datos».
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 md:p-8">
            <div className="text-center mb-4 md:mb-8">
              <p className="text-6xl sm:text-7xl md:text-9xl font-bold tabular-nums tracking-wider font-mono">
                {formatTime(timeRemaining)}
              </p>
              <p className="text-sm md:text-xl opacity-70 mt-1 md:mt-2">
                de {formatTime(currentBlock.durationSec)}
              </p>
            </div>

            <div className="h-3 md:h-4 bg-white/10 rounded-full overflow-hidden mb-4 md:mb-6">
              <div
                className={`h-full ${ZONE_BG_DARK[currentBlock.zone]} transition-all duration-1000`}
                style={{ width: `${phaseProgressPct}%` }}
              />
            </div>

            {currentBlock.description !== undefined && (
              <p className="text-lg md:text-2xl text-center opacity-90">
                {currentBlock.description}
              </p>
            )}

            {!isRunning && !isCompleted && timeRemaining === currentBlock.durationSec && (
              <p className="text-center text-sm md:text-base opacity-70 mt-4 md:mt-6">
                Pulsa Espacio para empezar
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-black/40 px-4 md:px-6 py-2 md:py-3 flex items-center justify-between gap-3 text-[11px] md:text-xs">
        <div className="flex-shrink-0">
          <Logo
            variant="full"
            size="sm"
            orientation="horizontal"
            tone="dark"
            className="hidden sm:flex"
          />
          <Logo
            variant="brand"
            size="sm"
            orientation="horizontal"
            tone="dark"
            className="flex sm:hidden"
          />
        </div>
        <span className="hidden md:inline opacity-60 flex-1 text-center">
          Espacio: pausa · Flechas: saltar fase · S: sonido · V: voz · R: reiniciar · Esc: cerrar
        </span>
        <span className="md:hidden opacity-60 flex-shrink-0 tabular-nums">
          Total {formatTime(totalElapsed)} · {Math.round(totalProgressPct)}%
        </span>
      </footer>
    </div>
  );
}

function zoneToBorder(zone: HeartRateZone): string {
  const map: Record<HeartRateZone, string> = {
    1: 'border-zone-1',
    2: 'border-zone-2',
    3: 'border-zone-3',
    4: 'border-zone-4',
    5: 'border-zone-5',
    6: 'border-zone-6',
  };
  return map[zone];
}

interface ControlButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  variant?: 'default' | 'danger';
}

function ControlButton({
  label,
  icon,
  onClick,
  disabled = false,
  highlight = false,
  variant = 'default',
}: ControlButtonProps): JSX.Element {
  const baseClasses =
    'w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  const variantClasses =
    variant === 'danger'
      ? 'bg-rosa-600/20 text-rosa-300 hover:bg-rosa-600/40'
      : highlight
        ? 'bg-white/30 text-white'
        : 'bg-white/10 text-white hover:bg-white/20';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${baseClasses} ${variantClasses}`}
    >
      <MaterialIcon name={icon} size="small" decorative />
    </button>
  );
}

interface PhaseTimelineProps {
  blocks: readonly SessionBlock[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

function PhaseTimeline({ blocks, currentIndex, onSelect }: PhaseTimelineProps): JSX.Element {
  const totalDuration = blocks.reduce((acc, b) => acc + b.durationSec, 0);
  return (
    <div className="bg-black/30 px-2 py-3 overflow-x-auto">
      <div className="flex gap-1 min-w-min justify-center">
        {blocks.map((block, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;
          // Bloques futuros: opacidad creciente (1 por delante mas opaco que 5 por delante)
          const stepsAhead = idx - currentIndex;
          const futureOpacity =
            isActive || isPast ? '' : stepsAhead <= 1 ? '' : stepsAhead <= 3 ? 'opacity-80' : 'opacity-60';
          const widthPct = totalDuration > 0 ? (block.durationSec / totalDuration) * 100 : 0;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelect(idx)}
              aria-label={`Saltar al bloque ${idx + 1}: ${PHASE_LABELS[block.phase] ?? block.phase}, zona ${block.zone}, ${formatTime(block.durationSec)}`}
              className={`flex-shrink-0 px-2 py-3 min-w-[40px] rounded transition-all ${
                isActive
                  ? `${ZONE_BG_DARK[block.zone]} ${zoneTextColor(block.zone)} ring-2 ring-white scale-105`
                  : isPast
                    ? `bg-white/5 opacity-40 hover:opacity-60 ${ZONE_TEXT[block.zone]}`
                    : `bg-white/10 hover:bg-white/20 ${ZONE_TEXT[block.zone]} ${futureOpacity}`
              }`}
              style={{ minWidth: `${Math.max(40, Math.min(120, widthPct * 4))}px` }}
            >
              <span className="text-base font-bold">Z{block.zone}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CompletionScreenProps {
  sessionName: string;
  totalElapsedSec: number;
  phaseCount: number;
  blocks: readonly SessionBlock[];
  onRestart: () => void;
  onClose: () => void;
}

function CompletionScreen({
  sessionName,
  totalElapsedSec,
  phaseCount,
  blocks,
  onRestart,
  onClose,
}: CompletionScreenProps): JSX.Element {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');

  // Count-up animado: arranca a 0 y avanza a los valores reales con un
  // requestAnimationFrame loop (CSS-only no permite count-up con tabular-nums).
  const elapsedDisplay = useCountUp(totalElapsedSec, 1200);
  const phaseDisplay = useCountUp(phaseCount, 1200);

  // % por zona: cuanto tiempo se invirtio en cada zona Z1..Z6.
  const zoneShare = useMemo(() => {
    const totals: Record<HeartRateZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sum = 0;
    for (const b of blocks) {
      totals[b.zone] += b.durationSec;
      sum += b.durationSec;
    }
    if (sum === 0) return [] as { zone: HeartRateZone; pct: number }[];
    const zones: HeartRateZone[] = [1, 2, 3, 4, 5, 6];
    return zones
      .map((z) => ({ zone: z, pct: (totals[z] / sum) * 100 }))
      .filter((entry) => entry.pct > 0);
  }, [blocks]);

  const handleShare = (): void => {
    const text = `He completado «${sessionName}» en Cadencia: ${formatTime(totalElapsedSec)} en ${phaseCount} bloques.`;
    if (typeof navigator.share === 'function') {
      navigator
        .share({ title: 'Cadencia', text })
        .then(() => setShareState('shared'))
        .catch(() => {
          // El usuario cerró el sheet o el navegador rechazó: degradamos a copiar.
          void writeClipboard(text).then(() => setShareState('copied'));
        });
      return;
    }
    void writeClipboard(text).then(() => setShareState('copied'));
  };

  const shareLabel =
    shareState === 'copied'
      ? 'Texto copiado'
      : shareState === 'shared'
        ? 'Compartido'
        : 'Compartir';
  const shareIcon = shareState === 'idle' ? 'share' : 'check';

  return (
    <div className="relative overflow-hidden min-h-[100dvh] bg-gradient-to-br from-turquesa-700 via-turquesa-600 to-turquesa-800 text-white flex items-center justify-center p-6 md:p-8">
      <Confetti />
      <div className="relative text-center max-w-2xl w-full">
        <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 md:mb-8 rounded-full bg-white/20 flex items-center justify-center">
          <MaterialIcon name="emoji_events" size="xlarge" className="text-tulipTree-300" />
        </div>
        <h1 className="font-display text-3xl md:text-5xl mb-2 md:mb-4">¡Sesión completada!</h1>
        <p className="text-lg md:text-2xl opacity-90 mb-6 md:mb-10">{sessionName}</p>

        <div className="grid grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
            <p className="text-xs md:text-base opacity-70 mb-1">Tiempo total</p>
            <p className="text-2xl md:text-4xl font-bold tabular-nums">
              {formatTime(elapsedDisplay)}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
            <p className="text-xs md:text-base opacity-70 mb-1">Bloques completados</p>
            <p className="text-2xl md:text-4xl font-bold tabular-nums">{phaseDisplay}</p>
          </div>
        </div>

        {zoneShare.length > 0 && (
          <div className="mb-8 md:mb-12">
            <p className="text-xs md:text-sm opacity-70 mb-2 text-left">
              Tiempo por zona trabajada
            </p>
            <div
              className="flex h-3 md:h-4 w-full rounded-full overflow-hidden bg-white/10"
              role="img"
              aria-label="Distribución del tiempo por zona"
            >
              {zoneShare.map(({ zone, pct }) => (
                <div
                  key={zone}
                  className={`${ZONE_BG_DARK[zone]} h-full`}
                  style={{ width: `${pct}%` }}
                  title={`Zona ${zone}: ${pct.toFixed(0)}%`}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs md:text-sm opacity-90 justify-center">
              {zoneShare.map(({ zone, pct }) => (
                <li key={zone} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-sm ${ZONE_BG_DARK[zone]}`}
                    aria-hidden
                  />
                  Z{zone}: {pct.toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <button
            type="button"
            onClick={handleShare}
            className="px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-base md:text-lg font-semibold inline-flex items-center justify-center gap-2 min-h-[48px]"
          >
            <MaterialIcon name={shareIcon} size="small" />
            {shareLabel}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-base md:text-lg font-semibold inline-flex items-center justify-center gap-2 min-h-[48px]"
          >
            <MaterialIcon name="replay" size="small" />
            Repetir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-white text-turquesa-800 hover:bg-white/90 transition-colors text-base md:text-lg font-bold inline-flex items-center justify-center gap-2 min-h-[48px]"
          >
            <MaterialIcon name="check" size="small" />
            Finalizar
          </button>
        </div>

        <footer className="mt-10 md:mt-14 pt-6 md:pt-8 border-t border-white/15 flex flex-col items-center gap-2">
          <Logo variant="full" size="sm" tone="dark" orientation="horizontal" />
          <p className="text-[11px] md:text-xs text-white/60 tracking-wide">
            Creado por Elena Cruces · © 2026 Movimiento Funcional
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * Hook util: anima un valor numerico de 0 al target en `durationMs`.
 * Respeta `prefers-reduced-motion`: salta directo al target sin animar.
 */
function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      // Easing out-cubic: rapido al inicio, suaviza al final
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Algunos navegadores rechazan clipboard sin gesto reciente: degradamos
      // silenciosamente para no romper la pantalla de completado.
    }
  }
}

/**
 * Confeti CSS-only: 8 piezas absolutas con animacion `fall` definida en
 * index.css. Respeta prefers-reduced-motion (devuelve null).
 */
function Confetti(): JSX.Element | null {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
  }, []);
  if (reduced) return null;
  const PIECES: ReadonlyArray<{ left: string; delay: string; color: string; rotate: string }> = [
    { left: '8%', delay: '0s', color: 'bg-turquesa-400', rotate: '15deg' },
    { left: '18%', delay: '0.2s', color: 'bg-tulipTree-400', rotate: '-30deg' },
    { left: '32%', delay: '0.4s', color: 'bg-rosa-400', rotate: '40deg' },
    { left: '46%', delay: '0.1s', color: 'bg-turquesa-200', rotate: '-15deg' },
    { left: '58%', delay: '0.5s', color: 'bg-tulipTree-500', rotate: '20deg' },
    { left: '70%', delay: '0.3s', color: 'bg-rosa-500', rotate: '-45deg' },
    { left: '84%', delay: '0.05s', color: 'bg-turquesa-400', rotate: '10deg' },
    { left: '92%', delay: '0.45s', color: 'bg-tulipTree-400', rotate: '-25deg' },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`absolute top-[-10%] w-2 h-3 rounded-sm ${piece.color} animate-confetti-fall`}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
