import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  EMPTY_USER_INPUTS,
  loadUserInputsFromSession,
  saveUserInputsToSession,
  validateUserInputs,
  type UserInputsRaw,
} from '@core/user';
import type { ClassifiedSegment, EditableSessionPlan, RouteMeta } from '@core/segmentation';
import {
  EMPTY_PREFERENCES,
  matchTracksToSegments,
  type CrossZoneMode,
  type MatchPreferences,
  type MatchedSegment,
} from '@core/matching';
import { dedupeByUri, loadNativeTracks, type Track } from '@core/tracks';
import { Stepper, type StepperStep } from '@ui/components/Stepper';
import { Card } from '@ui/components/Card';
import { Logo } from '@ui/components/Logo';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import type { RouteSourceChoice } from '@ui/components/SourceSelector';
import { CatalogEditorPage } from '@ui/pages/CatalogEditorPage';
import { Landing } from '@ui/pages/Landing';
import { SourceTypeStep } from '@ui/pages/SourceTypeStep';
import { UserDataStep } from '@ui/pages/UserDataStep';
import { RouteStep } from '@ui/pages/RouteStep';
import { MusicStep } from '@ui/pages/MusicStep';
import { ResultStep } from '@ui/pages/ResultStep';
import { TVModeRoute } from '@ui/pages/TVModeRoute';
import { writeHandoff } from '@core/tv/tvHandoff';
import { userInputsReducer } from '@ui/state/userInputsReducer';
import type { UploadedCsv } from '@ui/state/uploadedCsv';
import { navigateBack, usePathname } from '@ui/utils/navigation';
import {
  loadWizardState,
  saveWizardState,
  type MusicSourceMode,
  type RouteSourceType,
} from '@ui/state/wizardStorage';

const STEPS: readonly StepperStep[] = [
  { label: 'Tipo', icon: 'tune' },
  { label: 'Datos', icon: 'person' },
  { label: 'Ruta', icon: 'route' },
  { label: 'Música', icon: 'music_note' },
  { label: 'Resultado', icon: 'playlist_play' },
] as const;

const STEP_TYPE = 0;
const STEP_DATA = 1;
const STEP_ROUTE = 2;
const STEP_MUSIC = 3;
const STEP_RESULT = 4;

export function App(): JSX.Element {
  // Bifurcacion reactiva por pathname. Cada rama retorna un componente
  // distinto para no romper rules-of-hooks (cada componente tiene su propio
  // orden de hooks estable).
  // - /tv: pestaña independiente que ejecuta SessionTVMode con el plan
  //   escrito en localStorage por la pestaña origen.
  // - /catalogo: editor del catalogo nativo, accesible desde MusicStep para
  //   curar tracks y descargar el resultado como CSV propio.
  const pathname = usePathname();
  if (pathname === '/tv') {
    return <TVModeRoute />;
  }
  if (pathname === '/catalogo') {
    return <CatalogEditorPage onClose={() => navigateBack('/')} />;
  }
  return <WizardApp />;
}

/**
 * Genera una semilla aleatoria entera positiva (32 bits). Usada para
 * sembrar el motor de matching y conseguir variedad entre sesiones.
 */
function makeRandomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function WizardApp(): JSX.Element {
  // Carga lazy del state del wizard desde sessionStorage. Necesario para
  // sobrevivir al redirect de Spotify en /callback (full page navigation).
  const persisted = useState(() => loadWizardState())[0];

  // Vista activa: la landing es la pantalla de inicio para usuarios nuevos
  // o sesiones limpias. Si hay progreso persistido (vuelta de OAuth Spotify
  // o refresh a media tarea) saltamos directos al wizard para no interrumpir.
  const hasPersistedProgress =
    persisted !== null &&
    (persisted.currentStep > 0 ||
      persisted.completedSteps.length > 0 ||
      persisted.sourceType !== undefined);
  const [view, setView] = useState<'landing' | 'wizard'>(
    hasPersistedProgress ? 'wizard' : 'landing',
  );

  // Banner de "datos restaurados" tras un refresh / vuelta de OAuth: solo se
  // muestra si el usuario llega al wizard con progreso ya hecho. Auto-oculta
  // a los 4s para no interrumpir.
  const [showRestoredToast, setShowRestoredToast] = useState<boolean>(hasPersistedProgress);
  useEffect(() => {
    if (!showRestoredToast) return;
    const id = setTimeout(() => setShowRestoredToast(false), 4000);
    return () => clearTimeout(id);
  }, [showRestoredToast]);

  const [currentStep, setCurrentStep] = useState<number>(persisted?.currentStep ?? STEP_TYPE);
  const [completedSteps, setCompletedSteps] = useState<readonly number[]>(
    persisted?.completedSteps ?? [],
  );

  // State del usuario lifteado aqui para que pasos posteriores (Ruta, Resultado)
  // puedan leerlo y, en el caso de Resultado, editarlo en linea sin volver atras.
  const [inputs, dispatch] = useReducer(
    userInputsReducer,
    null,
    (): UserInputsRaw => loadUserInputsFromSession() ?? EMPTY_USER_INPUTS,
  );

  // currentYear cacheado en una sesion (no cambia significativamente durante el uso normal).
  const [currentYear] = useState(() => new Date().getFullYear());

  // Persistencia debounceada en sessionStorage
  useEffect(() => {
    const id = setTimeout(() => {
      saveUserInputsToSession(inputs);
    }, 300);
    return () => clearTimeout(id);
  }, [inputs]);

  // Origen de la ruta y plan de sesion editable (rama indoor cycling).
  const [sourceType, setSourceType] = useState<RouteSourceType | null>(
    persisted?.sourceType ?? null,
  );
  const [sessionPlan, setSessionPlan] = useState<EditableSessionPlan | null>(
    persisted?.sessionPlan ?? null,
  );
  // Plantilla activa de la SessionBuilder (null si edita desde cero).
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    persisted?.activeTemplateId ?? null,
  );

  // La validacion depende del sourceType: en modo 'session' relajamos las
  // reglas (peso/bici opcionales, sin requisito de FTP/FC/birthYear).
  const validationMode = sourceType === 'session' ? 'session' : 'gpx';
  const validation = useMemo(
    () => validateUserInputs(inputs, currentYear, validationMode),
    [inputs, currentYear, validationMode],
  );

  // Estado de la ruta procesada (vive en App para que la fase 4 "Resultado"
  // pueda leerlo sin volver atras). Inicializado desde sessionStorage si el
  // usuario vuelve del OAuth de Spotify.
  const [routeSegments, setRouteSegments] = useState<readonly ClassifiedSegment[] | null>(
    persisted?.routeSegments ?? null,
  );
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(persisted?.routeMeta ?? null);

  // Estado de la lista de musica generada (preferencias + segmentos casados).
  const [matchedList, setMatchedList] = useState<readonly MatchedSegment[] | null>(
    persisted?.matchedList ?? null,
  );
  const [musicPreferences, setMusicPreferences] = useState<MatchPreferences>(() => {
    const base = persisted?.musicPreferences ?? EMPTY_PREFERENCES;
    // Auto-seed la primera vez. La semilla se persiste con el resto de
    // musicPreferences en sessionStorage, asi el OAuth callback de Spotify
    // (full reload) reproduce exactamente la misma playlist al volver.
    return base.seed === undefined ? { ...base, seed: makeRandomSeed() } : base;
  });

  const handleRegenerateSeed = useCallback((): void => {
    setMusicPreferences((prev) => ({ ...prev, seed: makeRandomSeed() }));
  }, []);

  // Indices del matching reemplazados manualmente por el usuario via "Otro tema".
  // Se levanta a App para sobrevivir a remountajes de Music/Result al volver atras.
  const [replacedIndices, setReplacedIndices] = useState<ReadonlySet<number>>(
    () => new Set(persisted?.replacedIndices ?? []),
  );

  // Fuente del catalogo en MusicStep: predefinido (CSVs embebidos), solo lo
  // subido por el usuario, o ambos combinados. Default 'both'.
  const [musicSourceMode, setMusicSourceMode] = useState<MusicSourceMode>(
    persisted?.musicSourceMode ?? 'both',
  );

  // CSVs subidos por el usuario en runtime. Vive solo en memoria — no se
  // persiste en sessionStorage para no inflarlo con tracks parseados (varios
  // MB). Sobrevive a remountajes del paso Musica pero no a un refresh.
  const [uploadedCsvs, setUploadedCsvs] = useState<readonly UploadedCsv[]>([]);

  // Nombre custom de la playlist tecleado en ResultStep. Persistido para que
  // el usuario no tenga que reescribirlo si vuelve a Datos/Musica y vuelve.
  const [playlistName, setPlaylistName] = useState<string>(persisted?.playlistName ?? '');

  // Catalogo activo del paso Musica (predefinido, propio o ambos combinados).
  // Memoizado a partir del modo y los CSVs subidos: una sola fuente de verdad
  // que alimenta tanto el matching como el dropdown de "Otro tema" en Result.
  const livePool = useMemo<readonly Track[]>(() => {
    const userTracks: Track[] = uploadedCsvs.flatMap((c) => [...c.tracks]);
    if (musicSourceMode === 'predefined') return loadNativeTracks();
    if (musicSourceMode === 'mine') return dedupeByUri(userTracks);
    return dedupeByUri([...loadNativeTracks(), ...userTracks]);
  }, [musicSourceMode, uploadedCsvs]);

  // crossZoneMode derivado del sourceType: GPX usa solapamiento (un track
  // cubre tramos consecutivos de la misma zona), sesion indoor usa discreto
  // (un track por bloque). Se calcula aqui porque tanto el matching como
  // los dropdowns de "Otro tema" necesitan el mismo modo coherente.
  const crossZoneMode: CrossZoneMode = sourceType === 'session' ? 'discrete' : 'overlap';

  // Matching base: se calcula cuando cambian inputs reales del matching
  // (ruta, pool, preferencias, sourceType). Se omite en el primer render
  // para preservar matchedList persistido en sessionStorage tras un refresh.
  // Cuando se recalcula, los cambios manuales (replacedIndices) se pierden
  // porque la base cambio — el usuario debera reaplicarlos si los queria.
  const isFirstMatchEffectRef = useRef(true);
  useEffect(() => {
    if (isFirstMatchEffectRef.current) {
      isFirstMatchEffectRef.current = false;
      return;
    }
    if (routeSegments === null) {
      setMatchedList(null);
      setReplacedIndices(new Set());
      return;
    }
    const fresh = matchTracksToSegments(routeSegments, livePool, musicPreferences, {
      crossZoneMode,
    });
    setMatchedList(fresh);
    setReplacedIndices(new Set());
  }, [routeSegments, livePool, musicPreferences, crossZoneMode]);

  // Paso al que volver tras "Ajustar mis datos" / "Ajustar musica" desde el
  // Resultado. Solo en memoria — semantica efimera de "estoy haciendo un
  // detour, devuelveme a donde estaba". Se limpia al usar handleBack/Next.
  const [returnTarget, setReturnTarget] = useState<number | null>(null);

  // Persistir el wizard state en sessionStorage en cada cambio.
  useEffect(() => {
    saveWizardState({
      currentStep,
      completedSteps,
      routeSegments,
      routeMeta,
      matchedList,
      musicPreferences,
      replacedIndices: Array.from(replacedIndices),
      musicSourceMode,
      playlistName,
      activeTemplateId,
      ...(sourceType !== null ? { sourceType } : {}),
      ...(sessionPlan !== null ? { sessionPlan } : {}),
    });
  }, [
    currentStep,
    completedSteps,
    routeSegments,
    routeMeta,
    matchedList,
    musicPreferences,
    replacedIndices,
    musicSourceMode,
    playlistName,
    activeTemplateId,
    sourceType,
    sessionPlan,
  ]);

  const handleNext = useCallback((): void => {
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    // Si veniamos de un detour ("Ajustar mis datos / musica" desde Resultado)
    // y el usuario avanza, le devolvemos al paso de origen en vez de seguir
    // el flujo lineal — evita que tenga que pulsar Siguiente varias veces.
    if (returnTarget !== null) {
      const target = returnTarget;
      setReturnTarget(null);
      setCurrentStep(target);
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep, returnTarget]);

  const handleBack = useCallback((): void => {
    // Mismo retorno inteligente para "Atras": si tenemos un detour activo,
    // volvemos al paso origen en vez de retroceder un paso linealmente.
    if (returnTarget !== null) {
      const target = returnTarget;
      setReturnTarget(null);
      setCurrentStep(target);
      return;
    }
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [returnTarget]);

  const handleStepClick = (index: number): void => {
    if (completedSteps.includes(index) && index !== currentStep) {
      // Click directo en el stepper cancela cualquier detour activo: el
      // usuario decide explicitamente a donde ir.
      setReturnTarget(null);
      setCurrentStep(index);
    }
  };

  const handleRouteProcessed = (segments: ClassifiedSegment[], meta: RouteMeta): void => {
    setRouteSegments(segments);
    setRouteMeta(meta);
  };

  const handleSourceTypeSelect = (next: RouteSourceChoice): void => {
    if (sourceType !== next) {
      // Si cambia la rama, limpiamos los datos derivados de la rama anterior
      setRouteSegments(null);
      setRouteMeta(null);
      setMatchedList(null);
      setReplacedIndices(new Set());
      setUploadedCsvs([]);
      setPlaylistName('');
      // Si dejamos la rama indoor, limpiamos el plan y la plantilla activa
      if (next !== 'session') {
        setSessionPlan(null);
        setActiveTemplateId(null);
      }
    }
    setSourceType(next);
    // Avance automatico al paso Datos: el usuario no necesita un boton extra
    setCompletedSteps((prev) => (prev.includes(STEP_TYPE) ? prev : [...prev, STEP_TYPE]));
    setCurrentStep(STEP_DATA);
  };

  const handleSessionPlanChange = (plan: EditableSessionPlan | null): void => {
    setSessionPlan(plan);
  };

  // Avance de Music a Result: el matching ya esta sincronizado en App via el
  // useEffect base, y replacedIndices viaja por su propio canal. Aqui solo
  // gestionamos la transicion de paso.
  const handleMatchedAdvance = (): void => {
    handleNext();
  };

  const handleMatchedChange = (matched: MatchedSegment[]): void => {
    setMatchedList(matched);
  };

  // Salto desde Resultado para "Ajustar mis datos / musica". Recordamos el
  // origen para que el usuario pueda volver con un solo clic en Siguiente o
  // Atras en vez de re-recorrer el wizard entero.
  const handleGoToDataStep = useCallback((): void => {
    setReturnTarget(STEP_RESULT);
    setCurrentStep(STEP_DATA);
  }, []);

  const handleGoToMusicStep = useCallback((): void => {
    setReturnTarget(STEP_RESULT);
    setCurrentStep(STEP_MUSIC);
  }, []);

  // "Crear otra playlist" desde el DonePanel: vuelve al inicio del wizard
  // limpiando todos los datos derivados, pero conserva los inputs fisiologicos
  // del usuario (peso, FC, etc.) — son los mismos para una segunda sesion.
  const handleResetWizard = (): void => {
    setRouteSegments(null);
    setRouteMeta(null);
    setMatchedList(null);
    setMusicPreferences({ ...EMPTY_PREFERENCES, seed: makeRandomSeed() });
    setReplacedIndices(new Set());
    setUploadedCsvs([]);
    setPlaylistName('');
    setMusicSourceMode('both');
    setSessionPlan(null);
    setActiveTemplateId(null);
    setSourceType(null);
    setReturnTarget(null);
    setCompletedSteps([]);
    setCurrentStep(STEP_TYPE);
  };

  // Modo TV en pestaña nueva: serializa plan+inputs a localStorage y abre /tv.
  // Guard defensivo: si por alguna razon validation.ok cambio entre el render
  // del boton (donde se monta este callback) y su ejecucion, no abrimos la
  // pestaña — la otra alternativa seria abrir y mostrar el placeholder, peor
  // experiencia. El boton del UI tambien se desactiva si !validation.ok.
  const handleEnterTVMode = (): void => {
    if (sessionPlan === null || !validation.ok) return;
    writeHandoff({ plan: sessionPlan, validatedInputs: validation.data });
    window.open('/tv', '_blank', 'noopener');
  };

  // Landing: pantalla de inicio. Al pulsar "Empezar" entramos al wizard
  // por el paso Tipo (STEP_TYPE = 0).
  if (view === 'landing') {
    return <Landing onStart={() => setView('wizard')} />;
  }

  const currentStepLabel = STEPS[currentStep]?.label ?? '';

  return (
    <div className="min-h-full flex flex-col bg-gris-50">
      <Header />
      <div className="md:border-b md:border-gris-200 bg-gris-50/95 backdrop-blur-sm sticky top-0 z-30 md:static md:bg-gris-50 md:backdrop-blur-none border-b border-gris-200">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 md:py-4">
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      <main className="flex-1">
        <h1 className="sr-only">
          Asistente de Cadencia, paso {currentStep + 1} de {STEPS.length}: {currentStepLabel}
        </h1>
        {showRestoredToast && (
          <div
            role="status"
            className="mx-auto w-full max-w-4xl px-4 pt-3"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 rounded-lg border border-turquesa-200 bg-turquesa-50 px-3 py-2 text-sm text-turquesa-800 shadow-sm animate-fade-up">
              <MaterialIcon name="task_alt" size="small" className="text-turquesa-600" />
              <span>Hemos recuperado tus datos de la última sesión.</span>
              <button
                type="button"
                onClick={() => setShowRestoredToast(false)}
                aria-label="Cerrar aviso"
                className="ml-auto text-turquesa-700 hover:text-turquesa-800 min-h-[28px] min-w-[28px] flex items-center justify-center"
              >
                <MaterialIcon name="close" size="small" />
              </button>
            </div>
          </div>
        )}
        {currentStep === STEP_TYPE && (
          <SourceTypeStep onSelect={handleSourceTypeSelect} />
        )}

        {currentStep === STEP_DATA && sourceType !== null && (
          <UserDataStep
            inputs={inputs}
            dispatch={dispatch}
            validation={validation}
            currentYear={currentYear}
            onBack={handleBack}
            onNext={handleNext}
            mode={sourceType === 'session' ? 'session' : 'gpx'}
          />
        )}
        {currentStep === STEP_DATA && sourceType === null && (
          <NeedsTypeMessage onBack={handleBack} />
        )}

        {currentStep === STEP_ROUTE && validation.ok && sourceType !== null && (
          <RouteStep
            validatedInputs={validation.data}
            sourceType={sourceType}
            initialSessionPlan={sessionPlan ?? undefined}
            initialSegments={routeSegments ?? undefined}
            initialMeta={routeMeta ?? undefined}
            initialActiveTemplateId={activeTemplateId}
            onProcessed={handleRouteProcessed}
            onSessionPlanChange={handleSessionPlanChange}
            onActiveTemplateIdChange={setActiveTemplateId}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}
        {currentStep === STEP_ROUTE && (!validation.ok || sourceType === null) && (
          <NeedsDataMessage onBack={handleBack} />
        )}

        {currentStep === STEP_MUSIC && routeSegments !== null && routeMeta !== null && (
          <MusicStep
            segments={routeSegments}
            meta={routeMeta}
            tracks={livePool}
            preferences={musicPreferences}
            onPreferencesChange={setMusicPreferences}
            sourceMode={musicSourceMode}
            onSourceModeChange={setMusicSourceMode}
            uploadedCsvs={uploadedCsvs}
            onUploadedCsvsChange={setUploadedCsvs}
            matched={matchedList}
            onAdvance={handleMatchedAdvance}
            onBack={handleBack}
            crossZoneMode={crossZoneMode}
          />
        )}
        {currentStep === STEP_MUSIC && (routeSegments === null || routeMeta === null) && (
          <NeedsRouteMessage onBack={handleBack} />
        )}

        {currentStep === STEP_RESULT &&
          validation.ok &&
          routeSegments !== null &&
          routeMeta !== null &&
          matchedList !== null && (
            <ResultStep
              validation={validation}
              validatedInputs={validation.data}
              routeSegments={routeSegments}
              routeMeta={routeMeta}
              matched={matchedList}
              preferences={musicPreferences}
              tracks={livePool}
              replacedIndices={replacedIndices}
              onReplacedIndicesChange={setReplacedIndices}
              playlistName={playlistName}
              onPlaylistNameChange={setPlaylistName}
              onMatchedChange={handleMatchedChange}
              onBack={handleBack}
              onResetWizard={handleResetWizard}
              onGoToDataStep={handleGoToDataStep}
              onGoToMusicStep={handleGoToMusicStep}
              onRegenerateSeed={handleRegenerateSeed}
              crossZoneMode={crossZoneMode}
              {...(sourceType === 'session' ? { onEnterTVMode: handleEnterTVMode } : {})}
            />
          )}
        {currentStep === STEP_RESULT &&
          (!validation.ok ||
            routeSegments === null ||
            routeMeta === null ||
            matchedList === null) && <NeedsMusicMessage onBack={handleBack} />}
      </main>

      <Footer />
    </div>
  );
}

function NeedsTypeMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Elige primero el tipo de entrenamiento" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Necesitamos saber si vas a entrenar con una ruta GPX o una sesión indoor para
          adaptarnos a ti.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Tipo
        </button>
      </Card>
    </div>
  );
}

function NeedsDataMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Revisa tus datos" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Vuelve al paso anterior para introducir los datos que necesitamos.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Datos
        </button>
      </Card>
    </div>
  );
}

function NeedsRouteMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Define tu ruta o sesión antes" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Para elegir la música necesitamos saber qué zonas tendrá tu entrenamiento.
          Vuelve al paso de Ruta para subir un GPX o construir una sesión indoor.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Ruta
        </button>
      </Card>
    </div>
  );
}

function NeedsMusicMessage({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card variant="info" title="Genera la lista antes" titleIcon="warning">
        <p className="text-gris-700 mb-4">
          Para crear la lista en Spotify primero tienes que pasar por el paso de música.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Música
        </button>
      </Card>
    </div>
  );
}

function Header(): JSX.Element {
  return (
    <header className="border-b border-gris-200 bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 flex items-center gap-3">
        <Logo variant="full" size="md" />
      </div>
    </header>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="border-t border-gris-200 bg-gris-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs md:text-sm text-gris-500">
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5">
            <MaterialIcon name="lock" size="small" className="text-gris-400" />
            Sin cuentas, sin cookies, sin servidores. Todo corre en tu dispositivo.
          </p>
          <p className="text-xs text-gris-400 pl-5">
            Tus datos se guardan en el navegador hasta que cierres la pestaña.
          </p>
        </div>
        <nav className="flex items-center gap-3">
          <a
            href="/privacy.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Privacidad
          </a>
          <span aria-hidden className="text-gris-300">·</span>
          <a
            href="/terms.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Términos
          </a>
          <span aria-hidden className="text-gris-300">·</span>
          <a
            href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Licencia
          </a>
        </nav>
      </div>
    </footer>
  );
}
