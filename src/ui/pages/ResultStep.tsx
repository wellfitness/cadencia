import { useEffect, useMemo, useState, type Dispatch } from 'react';
import {
  matchTracksToSegments,
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
import { getTopGenres, loadNativeTracks } from '@core/tracks';
import type { UserInputsRaw, ValidatedUserInputs, ValidationResult } from '@core/user';
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
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { EditDataPanel } from '@ui/components/EditDataPanel';
import { Input } from '@ui/components/Input';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { MusicPreferencesPanel } from '@ui/components/MusicPreferencesPanel';
import { PlaylistTrackRow } from '@ui/components/PlaylistTrackRow';
import type { UserInputsAction } from '@ui/state/userInputsReducer';

export interface ResultStepProps {
  inputs: UserInputsRaw;
  dispatch: Dispatch<UserInputsAction>;
  validation: ValidationResult;
  validatedInputs: ValidatedUserInputs;
  currentYear: number;
  routeSegments: readonly ClassifiedSegment[];
  routeMeta: RouteMeta;
  matched: readonly MatchedSegment[];
  preferences: MatchPreferences;
  /** Callback al cambiar matched o preferences (App.tsx persiste). */
  onMatchedChange: (matched: MatchedSegment[], preferences: MatchPreferences) => void;
  onBack: () => void;
  /** Si la ruta vino de una sesion indoor, callback para abrir el modo TV. */
  onEnterTVMode?: () => void;
  /** Modo del formulario de "Ajustar mis datos": gpx (default) o session. */
  mode?: 'gpx' | 'session';
  /** Modo de matching: overlap (GPX, default) o discrete (sesion indoor). */
  crossZoneMode?: CrossZoneMode;
}

type Phase = 'idle' | 'authorizing' | 'exchanging' | 'creating' | 'done' | 'error';

export function ResultStep({
  inputs,
  dispatch,
  validation,
  validatedInputs,
  currentYear,
  routeSegments,
  routeMeta,
  matched,
  preferences,
  onMatchedChange,
  onBack,
  onEnterTVMode,
  mode = 'gpx',
  crossZoneMode = 'overlap',
}: ResultStepProps): JSX.Element {
  const clientId = getSpotifyClientId();
  const tracks = useMemo(() => loadNativeTracks(), []);
  const topGenres = useMemo(() => getTopGenres(tracks, 12), [tracks]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPlaylist | null>(null);
  const [playlistName, setPlaylistName] = useState(() =>
    buildPlaylistName(routeMeta.name, new Date()),
  );
  const [replacedIndices, setReplacedIndices] = useState<ReadonlySet<number>>(new Set());
  const [hasSpotifySession, setHasSpotifySession] = useState<boolean>(() => loadTokens() !== null);

  // Si los inputs cambian (edit-in-place), recalculamos matching desde cero.
  // El indice de "reemplazados manualmente" se reinicia.
  useEffect(() => {
    if (!validation.ok) return;
    const fresh = matchTracksToSegments(routeSegments, tracks, preferences, {
      crossZoneMode,
    });
    if (
      fresh.length !== matched.length ||
      fresh.some((m, i) => m.track?.uri !== matched[i]?.track?.uri)
    ) {
      onMatchedChange(fresh, preferences);
      setReplacedIndices(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: recalculamos solo al cambiar inputs validados o ruta
  }, [validatedInputs, routeSegments, preferences, crossZoneMode]);

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

  const handleReplace = (index: number): void => {
    const result = replaceTrackInSegment(matched, index, tracks, preferences);
    if (!result.replaced) return;
    onMatchedChange(result.matched, preferences);
    setReplacedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handlePreferencesChange = (next: MatchPreferences): void => {
    const fresh = matchTracksToSegments(routeSegments, tracks, next, { crossZoneMode });
    onMatchedChange(fresh, next);
    setReplacedIndices(new Set());
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
        name: playlistName.trim() || buildPlaylistName(routeMeta.name, new Date()),
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

  if (phase === 'done' && created !== null) {
    return <DonePanel playlist={created} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10">
      {onEnterTVMode !== undefined && (
        <Card variant="tip" title="Modo sesión" titleIcon="cast">
          <p className="text-sm text-gris-700 mb-3">
            Tu sesión tiene fases con duración programada. Activa el modo sesión para
            seguirla con cronómetro y avisos sonoros mientras suena la lista en Spotify.
          </p>
          <Button variant="primary" iconLeft="play_circle" onClick={onEnterTVMode}>
            Iniciar modo sesión
          </Button>
        </Card>
      )}
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
                  onReplace={() => handleReplace(i)}
                  replaced={replacedIndices.has(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EditDataPanel
        inputs={inputs}
        dispatch={dispatch}
        validation={validation}
        currentYear={currentYear}
        mode={mode}
      />

      <MusicPreferencesPanel
        topGenres={topGenres}
        preferences={preferences}
        onChange={handlePreferencesChange}
      />

      <Card title="Crear en Spotify" titleIcon="playlist_add">
        <div className="space-y-3">
          <Input
            label="Nombre de la lista"
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            helper="Aparecerá tal cual en tu Spotify (puedes cambiarlo después)."
          />
          {error !== null && (
            <p
              role="alert"
              className="text-sm text-error font-medium flex items-center gap-2"
            >
              <MaterialIcon name="error_outline" size="small" className="text-error" />
              {error}
            </p>
          )}
          <p className="text-xs text-gris-500">
            Se creará una lista en tu cuenta de Spotify. Si la quieres privada, márcala
            como tal desde la propia app de Spotify (Spotify exige permiso de listas
            públicas para añadir canciones, aunque solo las usemos para tu ruta).
          </p>
          {hasSpotifySession && (
            <div className="pt-3 mt-1 border-t border-gris-100 flex items-center justify-between gap-2">
              <span className="text-xs text-gris-500 flex items-center gap-1">
                <MaterialIcon name="check_circle" size="small" className="text-success" />
                Sesión activa con Spotify
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
        canCreate={validUriCount > 0 && playlistName.trim() !== ''}
      />
    </div>
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
}

function FooterActions({ onBack, onCreate, creating, canCreate }: FooterActionsProps): JSX.Element {
  const label = creating ? 'Creando…' : 'Crear en Spotify';
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 py-3 flex items-center justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="open_in_new"
          disabled={!canCreate || creating}
          loading={creating}
          onClick={onCreate}
          fullWidth
        >
          {label}
        </Button>
      </div>
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="open_in_new"
          disabled={!canCreate || creating}
          loading={creating}
          onClick={onCreate}
        >
          {label}
        </Button>
      </div>
    </>
  );
}

interface DonePanelProps {
  playlist: CreatedPlaylist;
}

function DonePanel({ playlist }: DonePanelProps): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 md:py-12 space-y-4">
      <Card variant="tip" title="¡Lista creada en Spotify!" titleIcon="check_circle">
        <p className="text-gris-700 mb-4">
          Tu lista <strong>"{playlist.name}"</strong> con{' '}
          <strong>{playlist.trackCount} temas</strong> está lista en tu cuenta.
        </p>
        <a
          href={playlist.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-turquesa-600 text-white border-2 border-turquesa-700 hover:bg-turquesa-700 font-semibold rounded-lg px-4 py-2.5 min-h-[44px] md:min-h-[48px] transition-all duration-200 ease-out"
        >
          <MaterialIcon name="open_in_new" size="small" />
          Abrir en Spotify
        </a>
      </Card>
    </div>
  );
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
