import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  clearAuthFlow,
  clearStoredClientId,
  clearTokens,
  getStoredClientId,
  loadTokens,
  resolveActiveClientId,
} from '@integrations/spotify';
import { ByocTutorialDialog } from '@ui/components/ByocTutorialDialog';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { ExternalLink } from '@ui/components/ExternalLink';
import { GenrePills } from '@ui/components/GenrePills';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { GoogleSyncCard } from '@ui/components/sync/GoogleSyncCard';
import { useCadenciaData, clearCadenciaData, usePlaylistHistory } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';
import { listSavedSessions, deleteSavedSession } from '@core/sessions/saved';
import { calculateTotalDurationSec } from '@core/segmentation';
import { expandRecurrences, type EventInstance } from '@core/calendar';
import type { SavedSession } from '@core/sync/types';
import { navigateInApp } from '@ui/utils/navigation';
import { BIKE_TYPE_LABELS } from '@core/power';
import { getTopMacroGenres, loadNativeTracks, migrateLegacyGenres } from '@core/tracks';
import { EMPTY_PREFERENCES, type MatchPreferences } from '@core/matching';
import { useGenreCoverage } from '@ui/hooks/useGenreCoverage';
import {
  isPersistentStorageEnabled,
  loadUserInputsFromSession,
  saveUserInputsToLocal,
  clearUserInputsFromLocal,
  EMPTY_USER_INPUTS,
} from '@core/user';
import { updateSection } from '@ui/state/cadenciaStore';

export interface MyPreferencesPageProps {
  onClose: () => void;
}

/**
 * Pagina "Mis preferencias": vista consolidada de todo lo que Cadencia
 * recuerda sobre el usuario. Accesible via /preferencias.
 *
 * Reactivo: usa useCadenciaData() para refrescarse cuando llegan cambios
 * via sync de Drive desde otro dispositivo.
 *
 * Deliberadamente NO se llama "Mi cuenta" para no sugerir que existe un
 * sistema de registro/login: Cadencia no tiene cuentas. Estas son tus
 * preferencias locales, opcionalmente sincronizadas con tu propio Drive.
 */
export function MyPreferencesPage({ onClose }: MyPreferencesPageProps): JSX.Element {
  const data = useCadenciaData();
  const [confirmWipe, setConfirmWipe] = useState<boolean>(false);

  return (
    <div className="min-h-full flex flex-col bg-gris-50">
      <header className="sticky top-0 z-30 border-b border-gris-200 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm text-turquesa-700 font-semibold rounded-md px-2 py-1 -mx-2 hover:text-turquesa-800 hover:bg-turquesa-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-400 min-h-[36px]"
          >
            <MaterialIcon name="arrow_back" size="small" />
            <span>Volver</span>
          </button>
          <h1 className="text-lg md:text-xl font-display font-bold text-gris-900">
            Mis preferencias
          </h1>
          <span className="w-12" aria-hidden /> {/* spacer */}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6 space-y-4 md:space-y-5">
          <UserDataSection data={data} />

          <SavedSessionsSection />

          <PlannedEventsSection />

          <CatalogSection data={data} />

          <SpotifyConnectionSection />

          <SpotifyClientIdSection />

          <TvModeSection data={data} />

          <PersistenceSection data={data} />

          <Card title="Sincronización entre dispositivos" titleIcon="cloud_sync">
            <GoogleSyncCard />
          </Card>

          <DangerZoneSection
            onWipe={() => setConfirmWipe(true)}
            hasAnyData={hasAnyData(data)}
          />
        </div>
      </main>

      <ConfirmDialog
        open={confirmWipe}
        title="Borrar todos mis datos de Cadencia"
        icon="warning"
        confirmLabel="Sí, borrar todo"
        confirmVariant="critical"
        cancelLabel="Cancelar"
        onConfirm={() => {
          clearCadenciaData();
          setConfirmWipe(false);
        }}
        onCancel={() => setConfirmWipe(false)}
        message={
          <>
            <p>
              Se borrarán <strong>todos tus datos de Cadencia</strong> en este
              dispositivo: peso, FTP, FC, preferencias musicales, sesiones
              guardadas, listas subidas, canciones descartadas y personalizaciones
              del catálogo.
            </p>
            <p className="mt-2 text-gris-600">
              Si tienes Drive conectado, los datos en tu Drive{' '}
              <strong>NO</strong> se borran automáticamente — son tuyos. Para
              borrarlos también desde Drive, ve a{' '}
              <a
                href="https://drive.google.com/drive/u/0/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-turquesa-700 hover:underline"
              >
                drive.google.com → Configuración → Administrar aplicaciones
              </a>
              .
            </p>
          </>
        }
      />
    </div>
  );
}

// ============================================================================
// Secciones
// ============================================================================

interface SectionProps {
  data: ReturnType<typeof useCadenciaData>;
}

/**
 * Persistencia local de los datos del usuario en este dispositivo. Es el
 * antiguo «Recordar mis datos» del wizard, movido aqui porque es ajuste
 * de preferencias, no algo que el usuario tenga que tocar cada vez que
 * inicie una sesion.
 *
 * Estados:
 *  - Activado (data.userInputs !== null): los datos sobreviven al cierre
 *    de la pestana. El usuario puede pulsar «Olvidar mis datos» para
 *    borrarlos del almacenamiento.
 *  - Desactivado: los datos solo viven en sessionStorage durante la
 *    pestana actual. Si hay datos en session, ofrece «Recordar» que los
 *    copia al cadenciaStore.
 *  - Sin datos en absoluto: hint informativo, sin botones.
 */
function PersistenceSection({ data }: SectionProps): JSX.Element {
  const enabled = isPersistentStorageEnabled() || data.userInputs !== null;
  const sessionInputs = useMemo(() => loadUserInputsFromSession(), []);
  const hasSessionData =
    sessionInputs !== null &&
    Object.values(sessionInputs).some((v) => v !== null);

  const [confirmForget, setConfirmForget] = useState<boolean>(false);

  const handleEnable = (): void => {
    const inputs = sessionInputs ?? EMPTY_USER_INPUTS;
    saveUserInputsToLocal(inputs);
    updateSection('userInputs', inputs);
  };

  const handleForget = (): void => {
    clearUserInputsFromLocal();
    updateSection('userInputs', null);
    setConfirmForget(false);
  };

  return (
    <Card title="Datos en este dispositivo" titleIcon="save">
      {enabled ? (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="check_circle"
              size="small"
              className="text-turquesa-600 mt-0.5 shrink-0"
            />
            <span>
              <strong>Tus datos se guardan en este navegador.</strong>{' '}
              <span className="text-gris-500">
                Sobreviven al cierre de la pestaña y al reinicio del dispositivo.
                No salen de aquí salvo que actives la sincronización con Drive.
              </span>
            </span>
          </p>
          <p className="text-xs text-gris-500 mt-2">
            ⚠ No actives esto si compartes el ordenador.
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="critical"
              size="sm"
              iconLeft="delete_outline"
              onClick={() => setConfirmForget(true)}
            >
              Olvidar mis datos
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="info"
              size="small"
              className="text-gris-500 mt-0.5 shrink-0"
            />
            <span>
              <strong>Tus datos solo viven en esta pestaña.</strong>{' '}
              <span className="text-gris-500">
                Se borrarán al cerrar el navegador. Para recordarlos en este
                dispositivo, pulsa el botón de abajo.
              </span>
            </span>
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              iconLeft="save"
              onClick={handleEnable}
              disabled={!hasSessionData}
              title={
                hasSessionData
                  ? 'Guardar los datos actuales en este navegador'
                  : 'Rellena tus datos en una sesión primero'
              }
            >
              Recordar mis datos en este dispositivo
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmForget}
        title="Olvidar mis datos guardados"
        icon="delete_outline"
        confirmLabel="Sí, olvidar"
        confirmVariant="critical"
        cancelLabel="Cancelar"
        onConfirm={handleForget}
        onCancel={() => setConfirmForget(false)}
        message={
          <p>
            Se borrarán tus datos guardados en este navegador (peso, FTP, FC,
            etc.). Tu Drive no se ve afectado. Podrás volver a guardarlos en
            cualquier momento.
          </p>
        }
      />
    </Card>
  );
}

/**
 * Estado de la conexion con Spotify y boton de desconexion explicito.
 * Spotify Developer Policy I exige que cualquier app de terceros ofrezca
 * un mecanismo facilmente accesible para desconectar la cuenta y borrar
 * los datos asociados. Tenemos un boton de desconexion en el paso final
 * del wizard (ResultStep), pero tiene que estar tambien aqui para que
 * sea hallable sin tener que generar una lista primero.
 *
 * El token de Spotify vive en sessionStorage, asi que «conectado» es
 * efimero por diseño: muere al cerrar la pestaña. Aun asi, mientras la
 * pestana este abierta, el usuario debe poder desconectar a voluntad.
 */
function SpotifyConnectionSection(): JSX.Element {
  // sessionStorage no dispara eventos React; sondeamos al montar y tras
  // pulsar desconectar. Lo suficiente — el usuario no se conecta/
  // desconecta en otra pestana mientras esta en /preferencias.
  const [hasSession, setHasSession] = useState<boolean>(false);

  useEffect(() => {
    setHasSession(loadTokens() !== null);
  }, []);

  const handleDisconnect = (): void => {
    clearTokens();
    clearAuthFlow();
    setHasSession(false);
  };

  return (
    <Card title="Conexión con Spotify" titleIcon="link">
      {hasSession ? (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="check_circle"
              size="small"
              className="text-turquesa-600 mt-0.5 shrink-0"
            />
            <span>
              <strong>Tu cuenta de Spotify está conectada en esta pestaña.</strong>{' '}
              <span className="text-gris-500">
                Cadencia solo usa el permiso de modificar listas privadas (
                <code className="font-mono text-[11px]">playlist-modify-private</code>
                ). El token vive en{' '}
                <code className="font-mono text-[11px]">sessionStorage</code> y
                se borra al cerrar la pestaña.
              </span>
            </span>
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="critical"
              size="sm"
              iconLeft="logout"
              onClick={handleDisconnect}
            >
              Desconectar Spotify
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-gris-700 flex items-start gap-2">
          <MaterialIcon
            name="info"
            size="small"
            className="text-gris-500 mt-0.5 shrink-0"
          />
          <span>
            <strong>Sin sesión Spotify activa en esta pestaña.</strong>{' '}
            <span className="text-gris-500">
              Cadencia solo se conecta a Spotify cuando pulsas «Crear lista»
              en el último paso del asistente. Para revocar el permiso desde
              tu cuenta de Spotify (más allá de esta pestaña), ve a{' '}
              <ExternalLink
                href="https://www.spotify.com/account/apps/"
                className="text-turquesa-700 hover:underline"
              >
                spotify.com → Apps
              </ExternalLink>
              .
            </span>
          </span>
        </p>
      )}
    </Card>
  );
}

/**
 * Gestion del Client ID custom (BYOC). Permite ver el origen del Client ID
 * activo (custom del usuario o fallback compartido), configurar uno propio
 * via ByocTutorialDialog, o borrarlo para volver al fallback.
 *
 * Por que aparece como seccion permanente y no solo via modal lazy: el
 * usuario que ya configuro el suyo necesita un sitio donde ver el estado y
 * cambiarlo (caso real: cambia de cuenta de Spotify y necesita rotar el
 * Client ID). Este es el "panel de gestion" del feature.
 */
function SpotifyClientIdSection(): JSX.Element {
  const [byocOpen, setByocOpen] = useState<boolean>(false);
  // Refresh trigger: localStorage no dispara eventos React. Lo bumpeamos
  // tras guardar/borrar para forzar re-render de la card.
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // ESLint marca refreshTick como innecesario porque las funciones leen de
  // localStorage (efecto fuera del modelo React), pero precisamente eso es
  // lo que hace falta: cuando bumpeamos el tick tras guardar/borrar, queremos
  // re-leer aunque las funciones sean tecnicamente "estables" para React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customId = useMemo(() => getStoredClientId(), [refreshTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolved = useMemo(() => resolveActiveClientId(), [refreshTick]);

  const hasCustom = customId !== null;
  const hasFallback = resolved !== null && resolved.source === 'default';
  const hasNothing = resolved === null;

  // Mostramos solo los 4 ultimos chars del id por privacidad visual: si el
  // usuario hace screen-share del panel, no expone su id entero.
  const customIdPreview = hasCustom ? `${'•'.repeat(28)}${customId.slice(-4)}` : null;

  const handleClear = (): void => {
    clearStoredClientId();
    setRefreshTick((n) => n + 1);
    setConfirmClear(false);
  };

  return (
    <Card title="Client ID de Spotify" titleIcon="vpn_key">
      {hasCustom && (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="check_circle"
              size="small"
              className="text-turquesa-600 mt-0.5 shrink-0"
            />
            <span>
              <strong>Estás usando tu propio Client ID.</strong>{' '}
              <span className="text-gris-500">
                Cadencia usa la app de Spotify que tú creaste. Los 5 huecos
                de testers están a tu nombre.
              </span>
            </span>
          </p>
          <p className="mt-3 text-xs text-gris-500 font-mono break-all">
            {customIdPreview}
          </p>
          <div className="mt-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="critical"
              size="sm"
              iconLeft="delete"
              onClick={() => setConfirmClear(true)}
            >
              Borrar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft="edit"
              onClick={() => setByocOpen(true)}
            >
              Cambiar
            </Button>
          </div>
        </>
      )}

      {!hasCustom && hasFallback && (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="info"
              size="small"
              className="text-tulipTree-600 mt-0.5 shrink-0"
            />
            <span>
              <strong>Estás usando el Client ID compartido de Cadencia.</strong>{' '}
              <span className="text-gris-500">
                Si tu cuenta no está en mi lista de testers (5 cuentas máx),
                Spotify rechazará la creación de listas. Configura el tuyo
                propio en 3 minutos para usar Cadencia sin límites.
              </span>
            </span>
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              iconLeft="vpn_key"
              onClick={() => setByocOpen(true)}
            >
              Configurar el mío
            </Button>
          </div>
        </>
      )}

      {hasNothing && (
        <>
          <p className="text-sm text-gris-700 flex items-start gap-2">
            <MaterialIcon
              name="error_outline"
              size="small"
              className="text-rosa-600 mt-0.5 shrink-0"
            />
            <span>
              <strong>No hay Client ID configurado.</strong>{' '}
              <span className="text-gris-500">
                Sin él, Cadencia no puede crear listas en tu cuenta de Spotify.
                Configura el tuyo en 3 minutos (es gratis).
              </span>
            </span>
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              iconLeft="vpn_key"
              onClick={() => setByocOpen(true)}
            >
              Configurar el mío
            </Button>
          </div>
        </>
      )}

      <ByocTutorialDialog
        open={byocOpen}
        onClose={() => setByocOpen(false)}
        onSaved={() => setRefreshTick((n) => n + 1)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Borrar tu Client ID"
        icon="warning"
        message={
          hasFallback
            ? 'Volverás al Client ID compartido de Cadencia. Si tu cuenta no está en su lista de testers, no podrás crear listas hasta que vuelvas a configurar el tuyo.'
            : 'Sin Client ID Cadencia no podrá crear listas en tu Spotify hasta que configures uno nuevo.'
        }
        confirmLabel="Borrar"
        confirmVariant="critical"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </Card>
  );
}

/**
 * Modo TV: solo se usa en sesiones indoor. Por ahora una unica preferencia
 * (voz on/off); si manana añadimos slider de velocidad o seleccion de voz
 * concreta, todo cabe aqui sin reestructurar la pagina.
 */
function TvModeSection({ data }: SectionProps): JSX.Element {
  // null = nunca se ha tocado el toggle, comportamiento default = on.
  const voiceEnabled = data.tvModePrefs?.voiceEnabled ?? true;
  const ttsAvailable =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleToggle = (e: ChangeEvent<HTMLInputElement>): void => {
    updateSection('tvModePrefs', { voiceEnabled: e.target.checked });
  };

  return (
    <Card title="Modo TV" titleIcon="cast">
      {ttsAvailable ? (
        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={handleToggle}
            className="mt-1 w-5 h-5 accent-turquesa-600 cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-gris-700">
              Voz del entrenador
            </p>
            <p className="text-xs text-gris-500">
              En cada nuevo bloque de la sesión indoor, una voz anuncia la
              zona, sensación, cadencia objetivo y duración. Puedes también
              activarla/silenciarla en el modo TV con la tecla «V» o el
              botón del altavoz.
            </p>
          </div>
        </label>
      ) : (
        <EmptyHint
          icon="info"
          text="Tu navegador no soporta síntesis de voz. El modo TV seguirá funcionando con beeps y vibración."
        />
      )}
    </Card>
  );
}

function UserDataSection({ data }: SectionProps): JSX.Element {
  const u = data.userInputs;
  const isEmpty = u === null || Object.values(u).every((v) => v === null);
  return (
    <Card title="Mis datos" titleIcon="person">
      {isEmpty ? (
        <EmptyHint
          icon="info"
          text="No has guardado ningún dato todavía. Rellénalos al empezar una sesión, en el paso «Datos»."
        />
      ) : (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
          <DataField label="Peso" value={u.weightKg !== null ? `${u.weightKg} kg` : '—'} />
          <DataField label="FTP" value={u.ftpWatts !== null ? `${u.ftpWatts} W` : '—'} />
          <DataField label="FC máx" value={u.maxHeartRate !== null ? `${u.maxHeartRate} bpm` : '—'} />
          <DataField label="FC reposo" value={u.restingHeartRate !== null ? `${u.restingHeartRate} bpm` : '—'} />
          <DataField label="Año nac." value={u.birthYear !== null ? String(u.birthYear) : '—'} />
          <DataField label="Sexo" value={u.sex === 'female' ? 'Femenino' : u.sex === 'male' ? 'Masculino' : '—'} />
          <DataField
            label="Tipo bici"
            value={u.bikeType !== null ? BIKE_TYPE_LABELS[u.bikeType] : '—'}
          />
          <DataField
            label="Peso bici"
            value={u.bikeWeightKg !== null ? `${u.bikeWeightKg} kg` : '—'}
          />
        </dl>
      )}
    </Card>
  );
}

function SavedSessionsSection(): JSX.Element {
  const data = useCadenciaData();
  // Re-deriva al cambiar el store
  const sessions = useMemo(
    () => listSavedSessions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.savedSessions],
  );
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
    null,
  );
  return (
    <Card title="Mis sesiones guardadas" titleIcon="bookmark">
      {sessions.length === 0 ? (
        <EmptyHint
          icon="bookmark_border"
          text="No tienes sesiones guardadas. Cuando construyas una sesión indoor, podrás guardarla con un nombre."
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const totalSec = calculateTotalDurationSec(s.plan);
            const totalMin = Math.round(totalSec / 60);
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-gris-200 hover:border-turquesa-300"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gris-800 truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-gris-500">
                    ≈ {totalMin} min · guardada{' '}
                    {new Date(s.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: s.id, name: s.name })}
                  aria-label={`Borrar sesión ${s.name}`}
                  className="px-2 py-1 rounded-md border border-gris-300 text-gris-600 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 min-h-[36px]"
                >
                  <MaterialIcon name="delete_outline" size="small" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Borrar sesión guardada"
        icon="delete_outline"
        confirmLabel="Borrar"
        confirmVariant="critical"
        onConfirm={() => {
          if (pendingDelete) deleteSavedSession(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
        message={
          <p>
            <strong>"{pendingDelete?.name ?? ''}"</strong> se eliminará. Esta
            acción se sincroniza con tus otros dispositivos si tienes Drive
            conectado.
          </p>
        }
      />
    </Card>
  );
}

/**
 * Resumen del calendario de planificacion: muestra las proximas N
 * instancias (incluyendo recurrentes expandidas) con un link a
 * `/calendario` para gestion completa.
 *
 * Esta seccion es informativa: la edicion / creacion / borrado de
 * eventos vive en `/calendario`. Aqui solo damos visibilidad rapida
 * desde el hub de preferencias.
 */
function PlannedEventsSection(): JSX.Element {
  const data = useCadenciaData();
  // Re-deriva al cambiar el store (otros dispositivos via sync, o crear/
  // editar/borrar en este mismo dispositivo desde /calendario).
  const sessions = useMemo(
    () => listSavedSessions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.savedSessions],
  );

  // Proximos 60 dias, primeras 5 instancias.
  const upcoming = useMemo<EventInstance[]>(() => {
    const today = todayLocalISOForPrefs();
    const horizon = addDaysISOForPrefs(today, 60);
    return expandRecurrences(data.plannedEvents, today, horizon).slice(0, 5);
  }, [data.plannedEvents]);

  const sessionsById = useMemo(() => {
    const m = new Map<string, SavedSession>();
    for (const s of sessions) m.set(s.id, s);
    return m;
  }, [sessions]);

  return (
    <Card title="Mi calendario" titleIcon="calendar_month">
      {upcoming.length === 0 ? (
        <EmptyHint
          icon="event_available"
          text="Sin entrenamientos planificados. Abre el calendario para añadir tu primera entrada."
        />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((inst) => (
            <UpcomingEventRow
              key={`${inst.event.id}-${inst.date}`}
              instance={inst}
              sessionsById={sessionsById}
            />
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          iconLeft="open_in_new"
          onClick={() => navigateInApp('/calendario')}
        >
          Abrir calendario
        </Button>
      </div>
    </Card>
  );
}

function UpcomingEventRow({
  instance,
  sessionsById,
}: {
  instance: EventInstance;
  sessionsById: Map<string, SavedSession>;
}): JSX.Element {
  const { event, date, isRecurringInstance } = instance;
  const isIndoor = event.type === 'indoor';
  const session = isIndoor ? sessionsById.get(event.savedSessionId) : null;
  const sessionDeleted = isIndoor && !session;
  const title = isIndoor ? (sessionDeleted ? 'Sesión borrada' : (session?.name ?? '')) : event.name;
  const dateLabel = formatShortDateForPrefs(date);

  return (
    <li className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-gris-200">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <MaterialIcon
          name={isIndoor ? 'directions_bike' : 'map'}
          size="small"
          className={`${isIndoor ? 'text-turquesa-600' : 'text-tulipTree-600'} mt-0.5 shrink-0`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold truncate ${
              sessionDeleted ? 'text-rosa-700' : 'text-gris-800'
            }`}
          >
            {title}
            {isRecurringInstance && (
              <MaterialIcon
                name="repeat"
                size="small"
                className="inline ml-1 text-tulipTree-600"
              />
            )}
          </p>
          <p className="text-xs text-gris-500">{dateLabel}</p>
        </div>
      </div>
    </li>
  );
}

function todayLocalISOForPrefs(): string {
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISOForPrefs(iso: string, delta: number): string {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d + delta);
  const yy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatShortDateForPrefs(iso: string): string {
  const today = todayLocalISOForPrefs();
  if (iso === today) return 'Hoy';
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Resumen único del catálogo de música del usuario:
 *   - Listas propias subidas (uploadedCsvs)
 *   - Canciones descartadas globalmente (dismissedTrackUris)
 *   - Personalizaciones del catálogo nativo (nativeCatalogPrefs)
 *
 * Todo gestionable desde un único botón «Editar catálogo» que abre
 * el editor con sus tres pestañas.
 */
function CatalogSection({ data }: SectionProps): JSX.Element {
  const uploadedLists = useMemo(
    () => hydrateUploadedCsvs(data.uploadedCsvs),
    [data.uploadedCsvs],
  );
  const dismissedCount = data.dismissedTrackUris.length;
  const excludedCount = data.nativeCatalogPrefs?.excludedUris.length ?? 0;

  // Pool unificado para el calculo de generos y cobertura. Memo unico por
  // mount: loadNativeTracks esta cacheado a nivel modulo y los uploaded ya
  // estan hidratados.
  const allTracks = useMemo(
    () => [
      ...loadNativeTracks(),
      ...uploadedLists.flatMap((l) => [...l.tracks]),
    ],
    [uploadedLists],
  );
  const topGenres = useMemo(() => getTopMacroGenres(allTracks), [allTracks]);
  // Sin sesion activa, usamos la rejilla canonica de bike (8 combos).
  // En run la cobertura se mostraria igual pero la pagina /preferencias
  // sirve a ambos deportes y bike es el caso mas comun. Trade-off aceptado.
  const genreCoverage = useGenreCoverage(allTracks, undefined, 'bike', 12);

  const prefs: MatchPreferences = data.musicPreferences ?? EMPTY_PREFERENCES;

  const handleGenresChange = (preferredGenres: string[]): void => {
    updateSection('musicPreferences', { ...prefs, preferredGenres });
  };
  const handleAllEnergeticChange = (e: ChangeEvent<HTMLInputElement>): void => {
    updateSection('musicPreferences', { ...prefs, allEnergetic: e.target.checked });
  };

  return (
    <Card title="Catálogo de música" titleIcon="library_music">
      {/* Bloque editable: generos preferidos + "todo con energia". Al
          cambiar, se persiste inmediatamente en cadenciaStore (y a Drive
          si esta conectado). */}
      <div className="space-y-3 pb-3 border-b border-gris-100">
        <div>
          <p className="text-sm font-semibold text-gris-700 mb-1">
            Géneros que te van
          </p>
          <p className="text-xs text-gris-500 mb-2">
            Marca los que te gusten. Si no marcas ninguno, usamos todo el catálogo.
          </p>
          <GenrePills
            availableGenres={topGenres}
            selectedGenres={migrateLegacyGenres(prefs.preferredGenres)}
            onChange={handleGenresChange}
            coverage={genreCoverage}
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={prefs.allEnergetic}
            onChange={handleAllEnergeticChange}
            className="mt-1 w-5 h-5 accent-turquesa-600 cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-gris-700">Todo con energía</p>
            <p className="text-xs text-gris-500">
              Sube el listón en zonas suaves (Z1-Z2) para que ningún tramo se
              sienta blando.
            </p>
          </div>
        </label>
      </div>

      {/* Resumen de tu catalogo: listas, descartes, personalizaciones. */}
      <div className="pt-3">
        {uploadedLists.length === 0 && dismissedCount === 0 && excludedCount === 0 ? (
          <p className="text-sm text-gris-500">
            Aún no has subido listas propias ni personalizado el catálogo predefinido.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-gris-700">
            {uploadedLists.length > 0 && (
              <li className="flex items-start gap-2">
                <MaterialIcon
                  name="upload_file"
                  size="small"
                  className="text-turquesa-600 mt-0.5 shrink-0"
                />
                <span>
                  <strong>
                    {uploadedLists.length}{' '}
                    {uploadedLists.length === 1 ? 'lista subida' : 'listas subidas'}
                  </strong>
                  {': '}
                  <span className="text-gris-500">
                    {uploadedLists
                      .slice(0, 3)
                      .map((l) => l.name)
                      .join(', ')}
                    {uploadedLists.length > 3 && ` y ${uploadedLists.length - 3} más`}
                  </span>
                </span>
              </li>
            )}
            {dismissedCount > 0 && (
              <li className="flex items-start gap-2">
                <MaterialIcon
                  name="block"
                  size="small"
                  className="text-rosa-600 mt-0.5 shrink-0"
                />
                <span>
                  <strong>
                    {dismissedCount}{' '}
                    {dismissedCount === 1 ? 'canción descartada' : 'canciones descartadas'}
                  </strong>
                  <span className="text-gris-500"> · no aparecerán en futuras listas</span>
                </span>
              </li>
            )}
            {excludedCount > 0 && (
              <li className="flex items-start gap-2">
                <MaterialIcon
                  name="tune"
                  size="small"
                  className="text-tulipTree-600 mt-0.5 shrink-0"
                />
                <span>
                  <strong>
                    {excludedCount}{' '}
                    {excludedCount === 1
                      ? 'canción desmarcada'
                      : 'canciones desmarcadas'}{' '}
                    del catálogo predefinido
                  </strong>
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
      <PlaylistHistoryStat />
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          iconRight="arrow_forward"
          onClick={() => navigateInApp('/catalogo')}
        >
          Editar catálogo
        </Button>
      </div>
    </Card>
  );
}

/**
 * Mini-stat: nº de listas creadas en Spotify desde Cadencia. Si N=0,
 * el componente no renderiza nada (el onboarding ya vive en /catalogo
 * pestana Estadisticas).
 */
function PlaylistHistoryStat(): JSX.Element | null {
  const history = usePlaylistHistory();
  if (history.length === 0) return null;
  return (
    <div className="pt-3 mt-3 border-t border-gris-100">
      <button
        type="button"
        onClick={() => navigateInApp('/catalogo?tab=stats')}
        className="text-sm text-turquesa-700 hover:text-turquesa-800 hover:underline inline-flex items-center gap-1.5"
      >
        <MaterialIcon name="auto_stories" size="small" />
        <span>
          Has creado <strong className="tabular-nums">{history.length}</strong>{' '}
          {history.length === 1 ? 'lista' : 'listas'} en Spotify desde Cadencia ·
          abrir mi diario
        </span>
      </button>
    </div>
  );
}

interface DangerZoneSectionProps {
  onWipe: () => void;
  hasAnyData: boolean;
}

function DangerZoneSection({ onWipe, hasAnyData }: DangerZoneSectionProps): JSX.Element {
  return (
    <div className="rounded-xl border-2 border-rosa-200 bg-rosa-50/30 p-4 md:p-5">
      <h2 className="font-display text-base text-rosa-700 flex items-center gap-2 mb-2">
        <MaterialIcon name="warning" size="small" className="text-rosa-600" />
        Zona de peligro
      </h2>
      <p className="text-sm text-gris-700 mb-3">
        Borra todos tus datos guardados de Cadencia en este dispositivo. Si
        tienes Drive conectado, los datos en tu Drive permanecerán intactos
        (son tuyos).
      </p>
      <Button
        variant="critical"
        iconLeft="delete_forever"
        onClick={onWipe}
        disabled={!hasAnyData}
      >
        Borrar todos mis datos
      </Button>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

interface DataFieldProps {
  label: string;
  value: string;
}

function DataField({ label, value }: DataFieldProps): JSX.Element {
  return (
    <div>
      <dt className="text-xs text-gris-500">{label}</dt>
      <dd className="text-sm font-semibold text-gris-800 tabular-nums">{value}</dd>
    </div>
  );
}

interface EmptyHintProps {
  icon: string;
  text: string;
}

function EmptyHint({ icon, text }: EmptyHintProps): JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm text-gris-600">
      <MaterialIcon name={icon} size="small" className="text-gris-400 mt-0.5 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

function hasAnyData(data: ReturnType<typeof useCadenciaData>): boolean {
  if (data.userInputs && Object.values(data.userInputs).some((v) => v !== null)) return true;
  if (data.musicPreferences) return true;
  if (data.savedSessions.some((s) => !s.deletedAt)) return true;
  if (data.uploadedCsvs.some((c) => !c.deletedAt)) return true;
  if (data.nativeCatalogPrefs?.excludedUris.length) return true;
  if (data.dismissedTrackUris.length) return true;
  return false;
}
