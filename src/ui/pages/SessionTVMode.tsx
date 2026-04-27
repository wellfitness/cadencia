import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getZoneCriteria } from '@core/matching';
import {
  calculateKarvonenZones,
  type HeartRateZone,
  type KarvonenZoneRange,
} from '@core/physiology/karvonen';
import {
  expandSessionPlan,
  type CadenceProfile,
  type EditableSessionPlan,
  type SessionBlock,
} from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user/userInputs';
import { MaterialIcon } from '@ui/components/MaterialIcon';

const CADENCE_PROFILE_LABELS: Record<CadenceProfile, string> = {
  flat: 'Llano',
  climb: 'Escalada',
  sprint: 'Sprint',
};

export interface SessionTVModeProps {
  plan: EditableSessionPlan;
  validatedInputs: ValidatedUserInputs;
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

const PHASE_ICONS: Record<string, string> = {
  warmup: 'whatshot',
  work: 'fitness_center',
  recovery: 'self_improvement',
  rest: 'pause_circle',
  cooldown: 'ac_unit',
  main: 'directions_bike',
};

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
 * Modo TV: cronometro fase a fase con beeps de aviso, atajos de teclado
 * y feedback visual prominente. Pensado para usar mientras suena la
 * playlist de Spotify en otra app (la app no controla audio externo).
 *
 * Atajos: Space (play/pause), Flechas (saltar fase), Esc (cerrar),
 *         S (sonido), R (reiniciar).
 */
export function SessionTVMode({
  plan,
  validatedInputs,
  onClose,
}: SessionTVModeProps): JSX.Element {
  const expanded = useMemo(() => expandSessionPlan(plan), [plan]);
  const blocks = expanded.blocks;
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Web Audio API: lazy init en el primer beep (gesto del usuario)
  const playBeep = useCallback(
    (frequency: number, durationMs: number, volume = 0.3): void => {
      if (!soundEnabled) return;
      try {
        if (audioContextRef.current === null) {
          const Ctx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx === undefined) return;
          audioContextRef.current = new Ctx();
        }
        const ctx = audioContextRef.current;
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
    [soundEnabled],
  );

  const playWarning = useCallback((): void => {
    playBeep(660, 100, 0.25);
  }, [playBeep]);

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
  }, [playBeep]);

  const goToNextPhase = useCallback((): void => {
    if (currentIndex < blocks.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextBlock = blocks[nextIndex];
      setCurrentIndex(nextIndex);
      setTimeRemaining(nextBlock?.durationSec ?? 0);
      playPhaseChange();
    } else {
      setIsCompleted(true);
      setIsRunning(false);
      playCompletion();
    }
  }, [currentIndex, blocks, playPhaseChange, playCompletion]);

  const goToPrevPhase = useCallback((): void => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevBlock = blocks[prevIndex];
      setCurrentIndex(prevIndex);
      setTimeRemaining(prevBlock?.durationSec ?? 0);
    }
  }, [currentIndex, blocks]);

  const toggleRunning = useCallback((): void => {
    setIsRunning((prev) => !prev);
  }, []);

  const restart = useCallback((): void => {
    setCurrentIndex(0);
    setTimeRemaining(blocks[0]?.durationSec ?? 0);
    setTotalElapsed(0);
    setIsCompleted(false);
    setIsRunning(false);
  }, [blocks]);

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
        case 'r':
        case 'R':
          e.preventDefault();
          restart();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRunning, goToNextPhase, goToPrevPhase, onClose, restart]);

  if (blocks.length === 0 || currentBlock === undefined) {
    return (
      <div className="min-h-screen bg-gris-900 text-white flex items-center justify-center p-8">
        <p className="text-xl">No hay bloques en la sesión.</p>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <CompletionScreen
        sessionName={plan.name}
        totalElapsedSec={totalElapsed}
        phaseCount={blocks.length}
        onRestart={restart}
        onClose={onClose}
      />
    );
  }

  const phaseProgressPct =
    currentBlock.durationSec > 0
      ? ((currentBlock.durationSec - timeRemaining) / currentBlock.durationSec) * 100
      : 0;
  const totalProgressPct = totalDurationSec > 0 ? (totalElapsed / totalDurationSec) * 100 : 0;

  return (
    <div className="min-h-screen bg-gris-900 text-white flex flex-col">
      <header className="bg-black/50 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-xl font-bold truncate">{plan.name}</h1>
          <p className="text-xs md:text-sm opacity-70">
            Bloque {currentIndex + 1} de {blocks.length}
          </p>
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
            label={soundEnabled ? 'Silenciar' : 'Activar sonido'}
            icon={soundEnabled ? 'volume_up' : 'volume_off'}
            onClick={() => setSoundEnabled((prev) => !prev)}
          />
          <ControlButton label="Reiniciar" icon="replay" onClick={restart} />
          <ControlButton label="Cerrar modo TV" icon="close" onClick={onClose} variant="danger" />
        </div>
      </header>

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
          <div className={`${ZONE_BG_DARK[currentBlock.zone]} px-4 md:px-8 py-4 md:py-6`}>
            <div className="flex items-center justify-between gap-3 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <span className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl bg-white/30 flex-shrink-0">
                  <MaterialIcon
                    name={PHASE_ICONS[currentBlock.phase] ?? 'fitness_center'}
                    size="large"
                    className="text-white"
                  />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl md:text-4xl font-bold leading-tight">
                    {PHASE_LABELS[currentBlock.phase] ?? currentBlock.phase.toUpperCase()}
                  </h2>
                  <p className="text-base md:text-xl opacity-90">
                    Zona {currentBlock.zone} · {CADENCE_PROFILE_LABELS[currentBlock.cadenceProfile]}
                  </p>
                  {(() => {
                    const c = getZoneCriteria(currentBlock.zone, currentBlock.cadenceProfile);
                    return (
                      <p className="text-sm md:text-base opacity-80 mt-0.5 flex items-center gap-1.5">
                        <MaterialIcon name="speed" size="small" />
                        Cadencia: {c.cadenceMin}-{c.cadenceMax} rpm
                      </p>
                    );
                  })()}
                </div>
              </div>
              {currentZoneFc !== null && (
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center justify-end gap-1.5 md:gap-2 text-xl md:text-3xl font-bold">
                    <MaterialIcon name="favorite" size="medium" className="animate-pulse" />
                    <span className="tabular-nums">
                      {Math.round(currentZoneFc.minBpm)}-{Math.round(currentZoneFc.maxBpm)}
                    </span>
                    <span className="text-sm md:text-xl opacity-70">bpm</span>
                  </div>
                  <p className="text-sm md:text-lg font-semibold mt-0.5 opacity-90">
                    {ZONE_PERCENT_FCR[currentBlock.zone]}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 md:p-8">
            <div className="text-center mb-4 md:mb-8">
              <p className="text-7xl md:text-9xl font-bold tabular-nums tracking-wider font-mono">
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

      <footer className="bg-black/40 px-4 md:px-6 py-2 md:py-3 text-center text-[11px] md:text-xs opacity-60">
        <span className="hidden md:inline">
          Espacio: pausa · Flechas: saltar fase · S: sonido · R: reiniciar · Esc: cerrar
        </span>
        <span className="md:hidden">
          Tiempo total: {formatTime(totalElapsed)} · {Math.round(totalProgressPct)}%
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
    <div className="bg-black/30 px-2 py-2 overflow-x-auto">
      <div className="flex gap-1 min-w-min justify-center">
        {blocks.map((block, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;
          const widthPct = totalDuration > 0 ? (block.durationSec / totalDuration) * 100 : 0;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelect(idx)}
              aria-label={`Saltar al bloque ${idx + 1}`}
              className={`flex-shrink-0 px-2 py-1 rounded transition-all ${
                isActive
                  ? `${ZONE_BG_DARK[block.zone]} text-white ring-2 ring-white scale-105`
                  : isPast
                    ? 'bg-white/5 opacity-40 hover:opacity-60'
                    : 'bg-white/5 hover:bg-white/15'
              }`}
              style={{ minWidth: `${Math.max(28, Math.min(120, widthPct * 4))}px` }}
            >
              <span className={`text-[10px] md:text-xs font-semibold ${ZONE_TEXT[block.zone]}`}>
                Z{block.zone}
              </span>
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
  onRestart: () => void;
  onClose: () => void;
}

function CompletionScreen({
  sessionName,
  totalElapsedSec,
  phaseCount,
  onRestart,
  onClose,
}: CompletionScreenProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-turquesa-700 via-turquesa-600 to-turquesa-800 text-white flex items-center justify-center p-6 md:p-8">
      <div className="text-center max-w-2xl w-full">
        <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 md:mb-8 rounded-full bg-white/20 flex items-center justify-center">
          <MaterialIcon name="emoji_events" size="xlarge" className="text-tulipTree-300" />
        </div>
        <h1 className="font-display text-3xl md:text-5xl mb-2 md:mb-4">¡Sesión completada!</h1>
        <p className="text-lg md:text-2xl opacity-90 mb-6 md:mb-10">{sessionName}</p>

        <div className="grid grid-cols-2 gap-3 md:gap-6 mb-8 md:mb-12">
          <div className="bg-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
            <p className="text-xs md:text-base opacity-70 mb-1">Tiempo total</p>
            <p className="text-2xl md:text-4xl font-bold tabular-nums">
              {formatTime(totalElapsedSec)}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl md:rounded-2xl p-4 md:p-6">
            <p className="text-xs md:text-base opacity-70 mb-1">Bloques completados</p>
            <p className="text-2xl md:text-4xl font-bold tabular-nums">{phaseCount}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
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
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
