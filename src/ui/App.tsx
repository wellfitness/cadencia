import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  EMPTY_USER_INPUTS,
  loadUserInputs,
  saveUserInputs,
  validateUserInputs,
  type UserInputsRaw,
} from '@core/user';
import { findTemplate, segmentInto60SecondBlocks } from '@core/segmentation';
import type {
  ClassifiedSegment,
  EditableSessionPlan,
  RouteMeta,
  SessionTemplate,
} from '@core/segmentation';
import type { GpxTrack } from '@core/gpx/types';
import { TestSetupDialog } from '@ui/components/session-builder/TestSetupDialog';
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
import { TodayBadge } from '@ui/components/TodayBadge';
import type { TypeChoice } from '@ui/components/SourceSelector';
import { Landing } from '@ui/pages/Landing';
import { SourceTypeStep } from '@ui/pages/SourceTypeStep';
import { UserDataStep } from '@ui/pages/UserDataStep';
import { RouteStep } from '@ui/pages/RouteStep';
import { MusicStep } from '@ui/pages/MusicStep';
import { ResultStep } from '@ui/pages/ResultStep';

// Paginas que viven fuera del wizard principal: cargan en chunks separados
// para que el bundle inicial sea mas ligero. El usuario solo paga el coste
// de descargar /ayuda, /calendario, /catalogo, /preferencias, /tv cuando
// navega ahi.
const CalendarPage = lazy(() =>
  import('@ui/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const CatalogEditorPage = lazy(() =>
  import('@ui/pages/CatalogEditorPage').then((m) => ({ default: m.CatalogEditorPage })),
);
const HelpRouter = lazy(() =>
  import('@ui/pages/help/HelpRouter').then((m) => ({ default: m.HelpRouter })),
);
const MyPreferencesPage = lazy(() =>
  import('@ui/pages/MyPreferencesPage').then((m) => ({ default: m.MyPreferencesPage })),
);
const TVModeRoute = lazy(() =>
  import('@ui/pages/TVModeRoute').then((m) => ({ default: m.TVModeRoute })),
);
import { writeHandoff } from '@core/tv/tvHandoff';
import { buildSpotifyTVHandoff } from '@ui/lib/spotifyTVHandoff';
import { userInputsReducer } from '@ui/state/userInputsReducer';
import { hydrateUploadedCsvs, type UploadedCsv } from '@ui/state/uploadedCsv';
import { navigateBack, navigateInApp, usePathname } from '@ui/utils/navigation';
import {
  loadWizardState,
  saveWizardState,
  type MusicSourceMode,
  type RouteSourceType,
} from '@ui/state/wizardStorage';
import { loadCadenciaData, updateSection, useCadenciaData } from '@ui/state/cadenciaStore';
import { createUploadedCsv, deleteUploadedCsv } from '@core/csvs/uploadedCsvs';

const STEPS: readonly StepperStep[] = [
  { label: 'Tipo', icon: 'tune' },
  { label: 'Datos', icon: 'person' },
  { label: 'Plan', icon: 'list_alt' },
  { label: 'Música', icon: 'music_note' },
  { label: '¡A pedalear!', icon: 'playlist_play' },
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
  // Las paginas lazy se envuelven en Suspense con un fallback minimo. La
  // expectativa de Cadencia es navegacion full-page (no SPA fluida tipo
  // dashboard), asi que un placeholder neutro durante 100-300ms es
  // aceptable. Bundle principal del wizard ~30% mas ligero.
  if (pathname === '/tv') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <TVModeRoute />
      </Suspense>
    );
  }
  if (pathname === '/catalogo') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <CatalogEditorPage onClose={() => navigateBack('/')} />
      </Suspense>
    );
  }
  if (pathname === '/preferencias' || pathname === '/cuenta') {
    // /cuenta queda como alias retrocompatible por si algun link antiguo
    // (Drive consent screen, marcadores) lleva ahi.
    return (
      <Suspense fallback={<LazyFallback />}>
        <MyPreferencesPage onClose={() => navigateBack('/')} />
      </Suspense>
    );
  }
  if (pathname === '/calendario') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <CalendarPage onClose={() => navigateBack('/')} />
      </Suspense>
    );
  }
  if (pathname.startsWith('/ayuda')) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <HelpRouter pathname={pathname} />
      </Suspense>
    );
  }
  return <WizardApp />;
}

/**
 * Placeholder para Suspense durante la carga de un chunk lazy. Min-height
 * iguala al header del wizard para evitar layout shift.
 */
function LazyFallback(): JSX.Element {
  return (
    <div
      className="flex items-center justify-center min-h-[50vh] text-gris-500"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando…</span>
    </div>
  );
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

  // Lectura lazy del query param "?plantilla=" en el primer render. Si llega
  // una plantilla valida, configura los estados iniciales para abrir directo
  // el constructor con la sesion cargada — flujo de "Cargar en constructor"
  // desde el centro de ayuda. La URL se limpia tras consumirlo para que un
  // refresh manual no sobrescriba el progreso del usuario.
  const pendingTemplate = useState(() => {
    if (typeof window === 'undefined') return null;
    const id = new URLSearchParams(window.location.search).get('plantilla');
    if (id === null) return null;
    return findTemplate(id) ?? null;
  })[0];
  const hasPendingTemplate = pendingTemplate !== null;

  useEffect(() => {
    if (!hasPendingTemplate) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('plantilla');
    const search = url.search.length > 0 ? url.search : '';
    window.history.replaceState({}, '', url.pathname + search + url.hash);
  }, [hasPendingTemplate]);

  // Vista activa: la landing es la pantalla de inicio para usuarios nuevos
  // o sesiones limpias. Si hay progreso persistido (vuelta de OAuth Spotify
  // o refresh a media tarea) o plantilla pendiente del centro de ayuda
  // saltamos directos al wizard para no interrumpir.
  const hasPersistedProgress =
    persisted !== null &&
    (persisted.currentStep > 0 ||
      persisted.completedSteps.length > 0 ||
      persisted.sourceType !== undefined);
  const [view, setView] = useState<'landing' | 'wizard'>(
    hasPersistedProgress || hasPendingTemplate ? 'wizard' : 'landing',
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

  const [currentStep, setCurrentStep] = useState<number>(
    hasPendingTemplate ? STEP_ROUTE : (persisted?.currentStep ?? STEP_TYPE),
  );
  const [completedSteps, setCompletedSteps] = useState<readonly number[]>(
    hasPendingTemplate ? [STEP_TYPE] : (persisted?.completedSteps ?? []),
  );

  // State del usuario lifteado aqui para que pasos posteriores (Ruta, Resultado)
  // puedan leerlo y, en el caso de Resultado, editarlo en linea sin volver atras.
  // Estrategia de hidratacion: cadenciaStore (nuevo SoT con sync Drive) primero,
  // legacy storage despues. La migracion one-shot en main.tsx asegura que los
  // datos antiguos viajen al cadenciaStore en el primer arranque tras el deploy.
  const [inputs, dispatch] = useReducer(
    userInputsReducer,
    null,
    (): UserInputsRaw =>
      loadCadenciaData().userInputs ?? loadUserInputs() ?? EMPTY_USER_INPUTS,
  );

  // currentYear cacheado en una sesion (no cambia significativamente durante el uso normal).
  const [currentYear] = useState(() => new Date().getFullYear());

  // Persistencia derivada: true cuando hay userInputs en cadenciaStore.
  // El usuario lo activa/desactiva desde /preferencias (no en el wizard).
  // Reactivo via useCadenciaData mas abajo, pero aqui leemos el snapshot
  // mas reciente para el efecto de guardado. La migracion one-shot del
  // legacy localStorage ya copio cualquier dato antiguo al cadenciaStore.
  const cadenciaSnapshot = loadCadenciaData();
  const persistentStorage = cadenciaSnapshot.userInputs !== null;

  // Persistencia debounceada. sessionStorage se actualiza siempre (necesario
  // para sobrevivir al OAuth de Spotify); cadenciaStore (y localStorage
  // legacy mientras dure la migracion) solo si la persistencia esta activa.
  // cadenciaStore es el SoT que el motor de Drive sync observa.
  useEffect(() => {
    const id = setTimeout(() => {
      saveUserInputs(inputs, persistentStorage);
      if (persistentStorage) {
        updateSection('userInputs', inputs);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [inputs, persistentStorage]);

  // Origen de la ruta y plan de sesion editable (rama indoor cycling).
  const [sourceType, setSourceType] = useState<RouteSourceType | null>(
    hasPendingTemplate ? 'session' : (persisted?.sourceType ?? null),
  );
  const [sessionPlan, setSessionPlan] = useState<EditableSessionPlan | null>(
    pendingTemplate !== null
      ? { name: pendingTemplate.name, items: [...pendingTemplate.items] }
      : (persisted?.sessionPlan ?? null),
  );
  // Plantilla activa de la SessionBuilder (null si edita desde cero).
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    pendingTemplate !== null ? pendingTemplate.id : (persisted?.activeTemplateId ?? null),
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

  // GpxTrack parseado del archivo subido por el usuario. Vive solo en memoria
  // (no en sessionStorage: serializado pesa cientos de KB para rutas largas).
  // Lo guardamos para reprocesar la zonificacion sin pedirle al usuario que
  // re-suba el archivo cuando cambie campos que afectan al calculo de zonas
  // bike+gpx (bikeType, ftpWatts, weightKg). Tras un OAuth full-reload se
  // pierde, pero los segments cacheados en sessionStorage siguen ahi: si el
  // usuario quisiera re-zonificar tras volver del OAuth tendra que re-subir.
  const [gpxTrack, setGpxTrack] = useState<GpxTrack | null>(null);

  // Estado de la lista de musica generada (preferencias + segmentos casados).
  const [matchedList, setMatchedList] = useState<readonly MatchedSegment[] | null>(
    persisted?.matchedList ?? null,
  );
  const [musicPreferences, setMusicPreferences] = useState<MatchPreferences>(() => {
    // Estrategia de hidratacion: cadenciaStore (SoT con sync Drive) primero,
    // wizardStorage (sessionStorage) despues, EMPTY al final. Esto permite
    // que las preferencias musicales sobrevivan al cierre de pestana, no
    // solo al redirect OAuth de Spotify.
    const fromCadencia = loadCadenciaData().musicPreferences;
    const base = fromCadencia ?? persisted?.musicPreferences ?? EMPTY_PREFERENCES;
    // Auto-seed la primera vez. La semilla se persiste con el resto de
    // musicPreferences, asi el OAuth callback de Spotify (full reload)
    // reproduce exactamente la misma playlist al volver.
    return base.seed === undefined ? { ...base, seed: makeRandomSeed() } : base;
  });

  // Sync musicPreferences -> cadenciaStore en cada cambio. cadenciaStore
  // es el SoT que el motor de Drive sync observa para propagar entre
  // dispositivos.
  useEffect(() => {
    updateSection('musicPreferences', musicPreferences);
  }, [musicPreferences]);

  const handleRegenerateSeed = useCallback((): void => {
    // Cambiar la semilla regenera la playlist completa con elecciones nuevas:
    // los índices reemplazados manualmente por el usuario en la lista anterior
    // dejan de ser aplicables (la lista nueva es otra). Limpiar evita un
    // estado fantasma donde el badge "Sustituido" se queda colgado en filas
    // que el usuario nunca tocó en la lista regenerada.
    setMusicPreferences((prev) => ({ ...prev, seed: makeRandomSeed() }));
    setReplacedIndices(new Set());
  }, []);

  // Indices del matching reemplazados manualmente por el usuario via "Otro tema".
  // Se levanta a App para sobrevivir a remountajes de Music/Result al volver atras.
  const [replacedIndices, setReplacedIndices] = useState<ReadonlySet<number>>(
    () => new Set(persisted?.replacedIndices ?? []),
  );

  // Fuente del catalogo en MusicStep: solo lo subido por el usuario o ambos
  // combinados (predefinido + uploads). Default 'both' — el catalogo nativo
  // viaja siempre como base; "Solo predefinida" se retiro del UI porque era
  // redundante con "Combinar ambas" sin CSVs subidos.
  const [musicSourceMode, setMusicSourceMode] = useState<MusicSourceMode>(
    persisted?.musicSourceMode ?? 'both',
  );

  // CSVs subidos por el usuario. Desde Fase E viven persistidos en
  // cadenciaStore (csvText raw) y se sincronizan con Drive si esta
  // conectado. Aqui los hidratamos al view-model con tracks parseados.
  // El hook useCadenciaData re-renderiza cuando llega un push remoto o
  // un cambio local, manteniendo el livePool reactivo.
  const cadenciaData = useCadenciaData();
  const uploadedCsvs = useMemo<readonly UploadedCsv[]>(
    () => hydrateUploadedCsvs(cadenciaData.uploadedCsvs),
    [cadenciaData.uploadedCsvs],
  );

  // Nombre custom de la playlist tecleado en ResultStep. Persistido para que
  // el usuario no tenga que reescribirlo si vuelve a Datos/Musica y vuelve.
  const [playlistName, setPlaylistName] = useState<string>(persisted?.playlistName ?? '');

  // Catalogo activo del paso Musica (solo CSVs propios o ambos combinados).
  // Filtra dismissedTrackUris (descartes globales desde ResultStep) y
  // excludedUris del nativo (denylist del editor de catalogo). Una sola
  // fuente de verdad que alimenta tanto el matching como el dropdown de
  // "Otro tema" en Result.
  const livePool = useMemo<readonly Track[]>(() => {
    const dismissed = new Set(cadenciaData.dismissedTrackUris);
    const excludedNative = new Set(cadenciaData.nativeCatalogPrefs?.excludedUris ?? []);
    const userTracks: Track[] = uploadedCsvs.flatMap((c) => [...c.tracks]);
    const native = loadNativeTracks().filter((t) => !excludedNative.has(t.uri));
    const merged =
      musicSourceMode === 'mine'
        ? dedupeByUri(userTracks)
        : dedupeByUri([...native, ...userTracks]);
    return merged.filter((t) => !dismissed.has(t.uri));
  }, [
    musicSourceMode,
    uploadedCsvs,
    cadenciaData.dismissedTrackUris,
    cadenciaData.nativeCatalogPrefs,
  ]);

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

  const handleRouteProcessed = (
    segments: ClassifiedSegment[],
    meta: RouteMeta,
    track: GpxTrack | null,
  ): void => {
    setRouteSegments(segments);
    setRouteMeta(meta);
    setGpxTrack(track);
  };

  // Re-segmenta el GPX cuando el usuario edita campos que afectan a la
  // zonificacion bike+gpx (bikeType cambia el floor por pendiente y los
  // presets Crr/CdA; ftpWatts cambia los thresholds Coggan; weightKg cambia
  // la masa total que entra en la ecuacion de potencia). Sin este efecto el
  // usuario que sube el GPX en gravel y luego cambia a MTB veria la misma
  // distribucion de zonas porque los segments quedan cacheados desde el
  // procesado original. Solo aplica al sub-flujo bike+gpx (sport='bike',
  // sourceType='gpx', track !== null).
  //
  // Extraemos los campos relevantes de validation a primitivas locales para
  // que el array de deps sea estaticamente analizable por react-hooks/
  // exhaustive-deps (no acepta expresiones ternarias inline).
  const validatedForReseg = validation.ok ? validation.data : null;
  const resegBikeType = validatedForReseg?.bikeType ?? null;
  const resegFtpWatts = validatedForReseg?.ftpWatts ?? null;
  const resegHasFtp = validatedForReseg?.hasFtp ?? false;
  const resegWeightKg = validatedForReseg?.weightKg ?? null;
  const resegBikeWeightKg = validatedForReseg?.bikeWeightKg ?? null;
  useEffect(() => {
    if (gpxTrack === null) return;
    if (sourceType !== 'gpx') return;
    if ((inputs.sport ?? 'bike') !== 'bike') return;
    if (validatedForReseg === null) return;
    const result = segmentInto60SecondBlocks(gpxTrack, validatedForReseg);
    setRouteSegments(result.segments);
    setRouteMeta(result.meta);
  }, [
    gpxTrack,
    sourceType,
    inputs.sport,
    validatedForReseg,
    resegBikeType,
    resegFtpWatts,
    resegHasFtp,
    resegWeightKg,
    resegBikeWeightKg,
  ]);

  const handleSourceTypeSelect = (choice: TypeChoice): void => {
    const { sport, source } = choice;
    // Cambio de deporte: refrescamos el reducer del usuario para que la
    // validacion del paso Datos use la rama correcta (peso opcional + FTP
    // ignorado en run, peso obligatorio en bike).
    if (inputs.sport !== sport) {
      dispatch({ type: 'SET_SPORT', value: sport });
    }
    if (sourceType !== source) {
      // Si cambia la rama, limpiamos los datos derivados de la rama anterior.
      // NOTA: uploadedCsvs YA NO se limpia aqui — son persistentes en
      // cadenciaStore desde Fase E y deben sobrevivir a cambios de rama.
      setRouteSegments(null);
      setRouteMeta(null);
      setGpxTrack(null);
      setMatchedList(null);
      setReplacedIndices(new Set());
      setPlaylistName('');
      // Si dejamos la rama indoor, limpiamos el plan y la plantilla activa
      if (source !== 'session') {
        setSessionPlan(null);
        setActiveTemplateId(null);
      }
    }
    setSourceType(source);
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
    setGpxTrack(null);
    setMatchedList(null);
    setMusicPreferences({ ...EMPTY_PREFERENCES, seed: makeRandomSeed() });
    setReplacedIndices(new Set());
    // uploadedCsvs persiste deliberadamente: las listas del usuario son
    // del usuario, no de la sesion — sobreviven a "Crear otra playlist".
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
  //
  // Si la sesion proviene de una plantilla-test con `hardwareDisclaimer`,
  // mostramos el TestSetupDialog antes de abrir la pestaña de Modo TV — el
  // usuario debe leer el aviso (e.g., "rodillo en SLOPE no ERG" para 3MT)
  // antes de empezar para que el resultado del test sea valido.
  const [pendingTestSetup, setPendingTestSetup] = useState<SessionTemplate | null>(null);

  const openTVModeNow = (): void => {
    if (sessionPlan === null || !validation.ok) return;
    // Adjuntar tokens y URIs solo si TODAS las precondiciones se cumplen
    // (Premium + scopes + playlist casada). Si falta cualquier cosa, el
    // Modo TV se abre en su modo legacy sin controles integrados.
    const spotifyHandoff = buildSpotifyTVHandoff(matchedList);
    writeHandoff({
      plan: sessionPlan,
      validatedInputs: validation.data,
      ...(activeTemplateId !== null ? { templateId: activeTemplateId } : {}),
      ...(spotifyHandoff !== null ? { spotify: spotifyHandoff } : {}),
    });
    window.open('/tv', '_blank', 'noopener');
  };

  const handleEnterTVMode = (): void => {
    if (sessionPlan === null || !validation.ok) return;
    if (activeTemplateId !== null) {
      const template = findTemplate(activeTemplateId);
      if (
        template?.kind === 'test' &&
        template.testProtocol?.hardwareDisclaimer !== undefined
      ) {
        setPendingTestSetup(template);
        return;
      }
    }
    openTVModeNow();
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
      {pendingTestSetup !== null && pendingTestSetup.testProtocol !== undefined && (
        <TestSetupDialog
          templateName={pendingTestSetup.name}
          testProtocol={pendingTestSetup.testProtocol}
          onConfirm={() => {
            setPendingTestSetup(null);
            openTVModeNow();
          }}
          onCancel={() => setPendingTestSetup(null)}
        />
      )}
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
          <SourceTypeStep
            {...(inputs.sport !== undefined ? { defaultSport: inputs.sport } : {})}
            onSelect={handleSourceTypeSelect}
          />
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
            sport={inputs.sport ?? 'bike'}
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
            {...(persisted?.plannedRouteContext !== undefined
              ? { plannedRouteContext: persisted.plannedRouteContext }
              : {})}
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
            sourceMode={musicSourceMode}
            onSourceModeChange={setMusicSourceMode}
            uploadedCsvs={uploadedCsvs}
            onCsvUploaded={(csvText, name) => {
              createUploadedCsv({ csvText, name });
              // El cambio en cadenciaStore dispara 'cadencia-data-saved',
              // useCadenciaData re-renderiza, livePool se recalcula.
            }}
            onCsvRemoved={(id) => deleteUploadedCsv(id)}
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
              sourceType={sourceType ?? 'gpx'}
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
          Vuelve al paso de Plan para subir un GPX o construir una sesión indoor.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-turquesa-700 font-semibold hover:underline"
        >
          <MaterialIcon name="arrow_back" size="small" />
          Volver al paso de Plan
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
      <div className="mx-auto w-full max-w-4xl px-4 py-4 flex items-center justify-between gap-3">
        <Logo variant="full" size="md" />
        <div className="flex items-center gap-2">
          <TodayBadge />
          <a
            href="/calendario"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/calendario');
            }}
            className="inline-flex items-center gap-1.5 text-sm text-gris-700 hover:text-turquesa-700 hover:bg-turquesa-50 rounded-md px-2 py-1.5 min-h-[36px] transition-colors"
            aria-label="Calendario"
            title="Calendario"
          >
            <MaterialIcon name="calendar_month" size="small" className="text-gris-500" />
            <span className="hidden sm:inline">Calendario</span>
          </a>
          <a
            href="/preferencias"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/preferencias');
            }}
            className="inline-flex items-center gap-1.5 text-sm text-gris-700 hover:text-turquesa-700 hover:bg-turquesa-50 rounded-md px-2 py-1.5 min-h-[36px] transition-colors"
            aria-label="Mis preferencias"
            title="Mis preferencias"
          >
            <MaterialIcon name="manage_accounts" size="small" className="text-gris-500" />
            <span className="hidden sm:inline">Mis preferencias</span>
          </a>
        </div>
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
            Sin registros, sin cookies, sin servidores. Todo corre en tu dispositivo.
          </p>
          <p className="text-xs text-gris-400 pl-5">
            Tus datos se guardan en el navegador hasta que cierres la pestaña.
          </p>
        </div>
        <nav className="flex items-center gap-3">
          <a
            href="/ayuda"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda');
            }}
            className="flex items-center gap-1 text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            <MaterialIcon name="help_outline" size="small" />
            Ayuda
          </a>
          <span aria-hidden className="text-gris-300">·</span>
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
            href="https://opensource.org/licenses/MIT"
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
