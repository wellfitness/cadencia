import { useEffect, useMemo, useState } from 'react';
import {
  getAlternativesForSegment,
  replaceTrackInSegment,
  type CrossZoneMode,
  type MatchPreferences,
  type MatchedSegment,
} from '@core/matching';
import {
  buildPlaylistDescription,
  buildPlaylistName,
  extractUris,
} from '@core/playlist';
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
import { loadNativeTracks, type Track } from '@core/tracks';
import type { ValidatedUserInputs, ValidationResult } from '@core/user';
import {
  clearAuthFlow,
  clearTokens,
  computeCodeChallenge,
  createPlaylistWithTracks,
  exchangeCodeForTokens,
  generateCodeVerifier,
  generateState,
  getAuthorizationUrl,
  getRedirectUri,
  getSpotifyClientId,
  loadAuthFlow,
  loadTokens,
  refreshAccessToken,
  saveAuthFlow,
  saveTokens,
  tokensAreFresh,
  SPOTIFY_SCOPES,
  type CreatedPlaylist,
} from '@integrations/spotify';
import { BestEffortBanner } from '@ui/components/BestEffortBanner';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { Input } from '@ui/components/Input';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { PlaylistTrackRow } from '@ui/components/PlaylistTrackRow';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';

export interface ResultStepProps {
  validation: ValidationResult;
  validatedInputs: ValidatedUserInputs;
  routeSegments: readonly ClassifiedSegment[];
  routeMeta: RouteMeta;
  matched: readonly MatchedSegment[];
  preferences: MatchPreferences;
  /**
   * Catalogo activo del paso Musica (predefinido, propio o ambos). Si es
   * null o ausente cae al subset de nativos. Necesario para que el dropdown
   * de "Otro tema" busque alternativas en el mismo pool con el que se generó
   * el matching original.
   */
  tracks?: readonly Track[] | null;
  /** Indices reemplazados manualmente. Controlled desde App para sobrevivir remountajes. */
  replacedIndices: ReadonlySet<number>;
  onReplacedIndicesChange: (next: ReadonlySet<number>) => void;
  /** Nombre de la playlist tecleado por el usuario. Controlled desde App. */
  playlistName: string;
  onPlaylistNameChange: (next: string) => void;
  /** Callback al cambiar matched (App.tsx persiste y propaga). */
  onMatchedChange: (matched: MatchedSegment[]) => void;
  onBack: () => void;
  /** Si la ruta vino de una sesion indoor, callback para abrir el modo TV. */
  onEnterTVMode?: () => void;
  /**
   * Callback para volver al primer paso del wizard ("crear otra playlist").
   * Solo se ofrece desde el DonePanel; opcional para no romper compatibilidad.
   */
  onResetWizard?: () => void;
  /** Vuelve al paso «Datos» para que el usuario ajuste sus inputs fisiologicos. */
  onGoToDataStep?: () => void;
  /** Vuelve al paso «Música» para subir mas listas o ajustar preferencias. */
  onGoToMusicStep?: () => void;
  /**
   * Genera una nueva semilla aleatoria → recalcula la playlist con la misma
   * ruta/sesión y catálogo pero con elecciones de tracks distintas (entre
   * los top-K de cada slot). Pensado para variedad en sesiones recurrentes.
   */
  onRegenerateSeed?: () => void;
  /** Modo de matching: overlap (GPX, default) o discrete (sesion indoor). */
  crossZoneMode?: CrossZoneMode;
}

type Phase = 'idle' | 'authorizing' | 'exchanging' | 'creating' | 'done' | 'error';

export function ResultStep({
  validation,
  validatedInputs,
  routeSegments: _routeSegments,
  routeMeta,
  matched,
  preferences,
  tracks: providedTracks,
  replacedIndices,
  onReplacedIndicesChange,
  playlistName,
  onPlaylistNameChange,
  onMatchedChange,
  onBack,
  onEnterTVMode,
  onResetWizard,
  onGoToDataStep,
  onGoToMusicStep,
  onRegenerateSeed,
  crossZoneMode = 'overlap',
}: ResultStepProps): JSX.Element {
  void validation;
  void validatedInputs;
  void _routeSegments;
  const clientId = getSpotifyClientId();
  // Catalogo activo: el que viene del paso Musica (incluye uploads del
  // usuario). Si no hay (refresh de pestaña, callback OAuth), fallback a
  // los CSVs nativos para no quedarnos sin pool.
  const tracks = useMemo(
    () => (providedTracks && providedTracks.length > 0 ? providedTracks : loadNativeTracks()),
    [providedTracks],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPlaylist | null>(null);
  const [hasSpotifySession, setHasSpotifySession] = useState<boolean>(() => loadTokens() !== null);

  // Si el usuario aun no ha tecleado un nombre custom para la playlist,
  // sugerimos uno basado en la ruta y la fecha actual. Esto solo se aplica
  // cuando el playlistName de App esta vacio (primer mount despues de
  // procesar la ruta) — si el usuario edito y borro a propio, lo respetamos.
  const effectivePlaylistName =
    playlistName.length > 0 ? playlistName : buildPlaylistName(routeMeta.name, new Date());

  // Alternativas validas por fila (excluye URIs ya en la playlist). Se
  // recalculan al cambiar la lista o las preferencias para que el dropdown
  // refleje en tiempo real las opciones disponibles.
  const alternativesByIndex = useMemo(
    () =>
      matched.map((_, i) =>
        getAlternativesForSegment(matched, i, tracks, preferences),
      ),
    [matched, tracks, preferences],
  );

  // Detecta `?code=...&state=...` en URL al volver del callback web.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code === null || state === null || clientId === null) return;
    setPhase('exchanging');
    void completeAuth(clientId, code, state)
      .then(() => {
        // Limpia los params del URL bar
        window.history.replaceState({}, '', window.location.pathname);
        setPhase('idle');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error inesperado al autorizar');
        setPhase('error');
      });
  }, [clientId]);

  if (clientId === null) {
    return <MissingClientIdMessage onBack={onBack} />;
  }

  const handleReplaceWith = (index: number, uri: string): void => {
    const result = replaceTrackInSegment(matched, index, tracks, preferences, uri);
    if (!result.replaced) return;
    onMatchedChange(result.matched);
    const next = new Set(replacedIndices);
    next.add(index);
    onReplacedIndicesChange(next);
  };

  const handleCreatePlaylist = async (): Promise<void> => {
    setError(null);
    let tokens = loadTokens();
    if (!tokens) {
      // Inicia el flow OAuth
      setPhase('authorizing');
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);
      const state = generateState();
      saveAuthFlow({ codeVerifier: verifier, state });
      const url = getAuthorizationUrl({
        clientId,
        redirectUri: getRedirectUri(),
        codeChallenge: challenge,
        state,
        scopes: SPOTIFY_SCOPES,
      });
      window.location.assign(url);
      return;
    }
    if (!tokensAreFresh(tokens)) {
      try {
        tokens = await refreshAccessToken({
          clientId,
          refreshToken: tokens.refreshToken,
        });
        saveTokens(tokens);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No pudimos refrescar tu sesión de Spotify');
        setPhase('error');
        return;
      }
    }
    setPhase('creating');
    try {
      const uris = extractUris(matched);
      const description = buildPlaylistDescription(routeMeta);
      const playlist = await createPlaylistWithTracks({
        accessToken: tokens.accessToken,
        name: effectivePlaylistName.trim() || buildPlaylistName(routeMeta.name, new Date()),
        description,
        uris,
      });
      setCreated(playlist);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al crear la lista');
      setPhase('error');
    }
  };

  const handleSpotifyLogout = (): void => {
    clearTokens();
    clearAuthFlow();
    setHasSpotifySession(false);
    setError(null);
    setPhase('idle');
  };

  const totalMinutes = Math.round(routeMeta.totalDurationSec / 60);
  const validUriCount = matched.filter((m) => m.track !== null).length;
  const replacedCount = replacedIndices.size;
  const repeatedCount = matched.filter((m) => m.matchQuality === 'repeated').length;
  const insufficientCount = matched.filter(
    (m) => m.track === null && m.matchQuality === 'insufficient',
  ).length;
  const bestEffortCount = matched.filter((m) => m.matchQuality === 'best-effort').length;

  if (phase === 'done' && created !== null) {
    return (
      <DonePanel
        playlist={created}
        matched={matched}
        {...(onEnterTVMode !== undefined ? { onEnterTVMode } : {})}
        {...(onResetWizard !== undefined ? { onResetWizard } : {})}
      />
    );
  }

  return (
    <WizardStep maxWidth="max-w-3xl">
      <WizardStepHeading
        title="Tu playlist"
        subtitle="Revisa la lista, ajusta lo que quieras y créala en tu cuenta de Spotify."
      />
      {repeatedCount > 0 && (
        <div
          role="status"
          className="rounded-2xl border-2 border-tulipTree-300 bg-tulipTree-50 p-4 md:p-5 flex items-start gap-3"
        >
          <MaterialIcon
            name="lightbulb"
            size="medium"
            className="text-tulipTree-600 flex-shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-display font-semibold text-gris-900">
              {repeatedCount === 1
                ? '1 canción se repite en la playlist'
                : `${repeatedCount} canciones se repiten en la playlist`}
            </h2>
            <p className="text-sm text-gris-700 mt-1">
              No había candidatos únicos suficientes en tu catálogo. Subiendo
              más listas tendrás mejor variedad sin repeticiones.
            </p>
          </div>
        </div>
      )}
      {insufficientCount > 0 && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-rosa-600 bg-rosa-100/40 p-4 md:p-5 flex items-start gap-3"
        >
          <MaterialIcon
            name="error_outline"
            size="medium"
            className="text-rosa-600 flex-shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-display font-semibold text-gris-900">
              {insufficientCount === 1
                ? '1 zona sin canciones disponibles en el catálogo'
                : `${insufficientCount} zonas sin canciones disponibles`}
            </h2>
            <p className="text-sm text-gris-700 mt-1">
              Tu catálogo no tiene tracks con la cadencia adecuada. Vuelve a
              «Música» y sube más listas para cubrir esas zonas.
            </p>
          </div>
        </div>
      )}
      {bestEffortCount > 0 && <BestEffortBanner count={bestEffortCount} />}
      <Card title="Tu lista" titleIcon="queue_music">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="text-sm text-gris-600">
            <strong className="text-gris-800 tabular-nums">{validUriCount}</strong> temas para{' '}
            <strong className="text-gris-800 tabular-nums">{totalMinutes} min</strong> de ruta
          </p>
          {replacedCount > 0 && (
            <span className="text-xs text-turquesa-700 flex items-center gap-1">
              <MaterialIcon name="edit" size="small" className="text-turquesa-600" />
              {replacedCount} cambio{replacedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {matched.length === 0 ? (
          <p className="text-sm text-gris-500 italic">Sin temas que mostrar.</p>
        ) : (
          <ul className="space-y-2 md:max-h-[55vh] md:overflow-y-auto md:pr-1">
            {matched.map((m, i) => (
              <li key={`${m.startSec}-${i}`}>
                <PlaylistTrackRow
                  matched={m}
                  index={i + 1}
                  alternatives={alternativesByIndex[i] ?? []}
                  onReplaceWith={(uri) => handleReplaceWith(i, uri)}
                  replaced={replacedIndices.has(i)}
                  showSlope={crossZoneMode === 'overlap'}
                  {...(onGoToMusicStep !== undefined ? { onGoToMusicStep } : {})}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(onGoToDataStep !== undefined ||
        onGoToMusicStep !== undefined ||
        onRegenerateSeed !== undefined) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onRegenerateSeed !== undefined && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="casino"
              onClick={onRegenerateSeed}
              title="Genera una playlist nueva con la misma ruta y catálogo, eligiendo tracks distintos entre los mejores candidatos de cada tramo."
            >
              Regenerar lista
            </Button>
          )}
          {onGoToDataStep !== undefined && (
            <Button variant="secondary" size="sm" iconLeft="tune" onClick={onGoToDataStep}>
              Ajustar mis datos
            </Button>
          )}
          {onGoToMusicStep !== undefined && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="library_music"
              onClick={onGoToMusicStep}
            >
              Ajustar música
            </Button>
          )}
        </div>
      )}

      <Card title="Crear en Spotify" titleIcon="playlist_add">
        <div className="space-y-3">
          <Input
            label="Nombre de la lista"
            type="text"
            value={effectivePlaylistName}
            onChange={(e) => onPlaylistNameChange(e.target.value)}
            helper="Aparecerá tal cual en tu Spotify (puedes cambiarlo después)."
          />
          {error !== null && (
            <p
              role="alert"
              className="text-sm text-rosa-600 font-medium flex items-center gap-2"
            >
              <MaterialIcon name="error_outline" size="small" className="text-rosa-600" />
              {error}
            </p>
          )}
          {!hasSpotifySession && (
            <p className="text-xs text-gris-500">
              Se creará una lista en tu cuenta de Spotify. Si la quieres privada, márcala
              como tal desde la propia app de Spotify (Spotify exige permiso de listas
              públicas para añadir canciones, aunque solo las usemos para tu ruta).
            </p>
          )}
          {hasSpotifySession && (
            <div className="pt-3 mt-1 border-t border-gris-100 flex items-center justify-between gap-2">
              <span className="text-xs text-gris-700 flex items-center gap-1.5 font-medium">
                <MaterialIcon name="check_circle" size="small" className="text-success" />
                Cuenta de Spotify conectada
              </span>
              <button
                type="button"
                onClick={handleSpotifyLogout}
                className="text-xs text-rosa-600 hover:text-rosa-700 hover:underline font-medium"
              >
                Cerrar sesión y volver a autorizar
              </button>
            </div>
          )}
        </div>
      </Card>

      <FooterActions
        onBack={onBack}
        onCreate={() => void handleCreatePlaylist()}
        creating={phase === 'authorizing' || phase === 'exchanging' || phase === 'creating'}
        canCreate={
          validUriCount > 0 && effectivePlaylistName.trim() !== '' && insufficientCount === 0
        }
        hasSpotifySession={hasSpotifySession}
        {...(onEnterTVMode !== undefined ? { onEnterTVMode } : {})}
      />
    </WizardStep>
  );
}

async function completeAuth(clientId: string, code: string, state: string): Promise<void> {
  const flow = loadAuthFlow();
  if (!flow || flow.state !== state) {
    throw new Error('La autorización falló (estado CSRF inválido). Vuelve a intentarlo.');
  }
  const tokens = await exchangeCodeForTokens({
    clientId,
    redirectUri: getRedirectUri(),
    code,
    codeVerifier: flow.codeVerifier,
  });
  saveTokens(tokens);
}

interface FooterActionsProps {
  onBack: () => void;
  onCreate: () => void;
  creating: boolean;
  canCreate: boolean;
  hasSpotifySession: boolean;
  /**
   * Solo presente en sesiones indoor. Si esta, renderizamos un segundo boton
   * primario "Abrir Modo TV" en paralelo a "Crear en Spotify". El boton es
   * visualmente igual de prominente — son dos acciones complementarias, no
   * jerarquicas: la usuaria suele hacer ambas.
   */
  onEnterTVMode?: () => void;
}

function FooterActions({
  onBack,
  onCreate,
  creating,
  canCreate,
  hasSpotifySession,
  onEnterTVMode,
}: FooterActionsProps): JSX.Element {
  const idleLabel = hasSpotifySession ? 'Crear lista' : 'Crear en Spotify';
  const createLabel = creating ? 'Creando…' : idleLabel;
  const tvAriaLabel = 'Abrir Modo TV (se abrirá en una pestaña nueva)';
  return (
    <WizardStepFooter
      mobile={
        <div className="flex flex-col gap-2 w-full">
          {/* En movil: TV arriba (acción "ahora"), Crear debajo, Atrás al pie. */}
          {onEnterTVMode !== undefined && (
            <Button
              variant="primary"
              iconLeft="cast"
              iconRight="open_in_new"
              onClick={onEnterTVMode}
              fullWidth
              aria-label={tvAriaLabel}
              title={tvAriaLabel}
            >
              Abrir Modo TV
            </Button>
          )}
          <Button
            variant="primary"
            iconRight="open_in_new"
            disabled={!canCreate || creating}
            loading={creating}
            onClick={onCreate}
            fullWidth
          >
            {createLabel}
          </Button>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack} fullWidth>
            Atrás
          </Button>
        </div>
      }
      desktop={
        <>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          {onEnterTVMode !== undefined && (
            <Button
              variant="primary"
              iconLeft="cast"
              iconRight="open_in_new"
              onClick={onEnterTVMode}
              aria-label={tvAriaLabel}
              title={tvAriaLabel}
            >
              Abrir Modo TV
            </Button>
          )}
          <Button
            variant="primary"
            iconRight="open_in_new"
            disabled={!canCreate || creating}
            loading={creating}
            onClick={onCreate}
          >
            {createLabel}
          </Button>
        </>
      }
    />
  );
}

interface DonePanelProps {
  playlist: CreatedPlaylist;
  matched: readonly MatchedSegment[];
  onEnterTVMode?: () => void;
  onResetWizard?: () => void;
}

function DonePanel({
  playlist,
  matched,
  onEnterTVMode,
  onResetWizard,
}: DonePanelProps): JSX.Element {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const previewTracks = matched
    .map((m) => m.track)
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .slice(0, 8);

  const handleShare = (): void => {
    const text = `Escucha mi playlist «${playlist.name}» creada con Cadencia: ${playlist.externalUrl}`;
    if (typeof navigator.share === 'function') {
      navigator
        .share({ title: playlist.name, text, url: playlist.externalUrl })
        .then(() => setShareState('shared'))
        .catch(() => {
          void copyShareToClipboard(text).then(() => setShareState('copied'));
        });
      return;
    }
    void copyShareToClipboard(text).then(() => setShareState('copied'));
  };

  const shareLabel =
    shareState === 'copied'
      ? 'Enlace copiado'
      : shareState === 'shared'
        ? 'Compartido'
        : 'Compartir enlace';

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 md:py-12 space-y-4 animate-fade-up">
      <Card variant="tip" title="¡Lista creada en Spotify!" titleIcon="check_circle">
        <p className="text-gris-700 mb-4">
          Tu lista <strong>«{playlist.name}»</strong> con{' '}
          <strong>{playlist.trackCount} temas</strong> está lista en tu cuenta.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={playlist.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-turquesa-600 text-white border-2 border-turquesa-700 hover:bg-turquesa-700 font-semibold rounded-lg px-4 py-2.5 min-h-[44px] md:min-h-[48px] transition-all duration-200 ease-out"
          >
            <MaterialIcon name="open_in_new" size="small" />
            Abrir en Spotify
          </a>
          <Button
            variant="secondary"
            iconLeft={shareState === 'idle' ? 'share' : 'check'}
            onClick={handleShare}
          >
            {shareLabel}
          </Button>
        </div>
      </Card>

      {onEnterTVMode !== undefined && (
        <Card variant="info" title="Sigue tu sesión a pantalla completa" titleIcon="cast">
          <p className="text-gris-700 mb-3">
            Activa el modo sesión para ver el cronómetro y avisos sonoros mientras suena
            la lista en Spotify. Se abrirá en una pestaña nueva.
          </p>
          <Button
            variant="primary"
            iconLeft="cast"
            iconRight="open_in_new"
            onClick={onEnterTVMode}
          >
            Abrir Modo TV
          </Button>
        </Card>
      )}

      {previewTracks.length > 0 && (
        <Card title="Primeros temas de la lista" titleIcon="queue_music">
          <ol className="space-y-1.5">
            {previewTracks.map((t, i) => (
              <li
                key={t.uri}
                className="flex items-center gap-3 px-2 py-1.5 rounded-md odd:bg-gris-50"
              >
                <span className="text-xs font-semibold text-gris-500 tabular-nums w-6 text-right">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gris-800 truncate">{t.name}</p>
                  <p className="text-xs text-gris-500 truncate">{t.artists.join(', ')}</p>
                </div>
                <span className="text-xs text-gris-500 tabular-nums whitespace-nowrap">
                  {Math.round(t.tempoBpm)} BPM
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {onResetWizard !== undefined && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" iconLeft="refresh" onClick={onResetWizard}>
            Crear otra playlist
          </Button>
        </div>
      )}
    </div>
  );
}

async function copyShareToClipboard(text: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback silencioso si el navegador rechaza sin gesto reciente.
    }
  }
}

interface MissingClientIdMessageProps {
  onBack: () => void;
}

function MissingClientIdMessage({ onBack }: MissingClientIdMessageProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 md:py-12 space-y-4">
      <Card variant="info" title="Configura tu Client ID de Spotify" titleIcon="settings">
        <p className="text-gris-700 mb-3">
          Para crear listas en tu cuenta necesitas registrar la app en Spotify (gratis,
          5 minutos):
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-gris-700">
          <li>
            Entra en{' '}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-turquesa-700 hover:underline"
            >
              developer.spotify.com/dashboard
            </a>
          </li>
          <li>Pulsa "Create an App" e introduce un nombre cualquiera.</li>
          <li>
            En "Redirect URIs" añade exactamente:{' '}
            <code className="bg-gris-100 px-1 py-0.5 rounded text-xs">
              {`${window.location.origin}/callback`}
            </code>
          </li>
          <li>Marca "Web API" y acepta los términos.</li>
          <li>Copia el "Client ID" que aparece en el dashboard de tu app.</li>
          <li>
            Crea o edita el fichero{' '}
            <code className="bg-gris-100 px-1 py-0.5 rounded text-xs">.env.local</code>{' '}
            en la raíz del proyecto con esta línea:
          </li>
        </ol>
        <pre className="bg-gris-900 text-turquesa-100 text-xs rounded-lg p-3 mt-2 overflow-x-auto">
          VITE_SPOTIFY_CLIENT_ID=tu-client-id-aquí
        </pre>
        <p className="text-xs text-gris-500 mt-2">
          Reinicia <code className="bg-gris-100 px-1 rounded">pnpm dev</code> y vuelve aquí.
        </p>
        <div className="mt-4">
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Volver atrás
          </Button>
        </div>
      </Card>
    </div>
  );
}
