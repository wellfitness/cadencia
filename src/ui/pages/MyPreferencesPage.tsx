import { useMemo, useState } from 'react';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { GoogleSyncCard } from '@ui/components/sync/GoogleSyncCard';
import { useCadenciaData, clearCadenciaData } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';
import { listSavedSessions, deleteSavedSession } from '@core/sessions/saved';
import { calculateTotalDurationSec } from '@core/segmentation';
import { navigateInApp } from '@ui/utils/navigation';
import { BIKE_TYPE_LABELS } from '@core/power';
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
          <PersistenceSection data={data} />

          <Card title="Sincronización entre dispositivos" titleIcon="cloud_sync">
            <GoogleSyncCard />
          </Card>

          <UserDataSection data={data} />

          <SavedSessionsSection />

          <CatalogSection data={data} />

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
 * Resumen único del catálogo de música del usuario:
 *   - Listas propias subidas (uploadedCsvs)
 *   - Canciones descartadas globalmente (dismissedTrackUris)
 *   - Personalizaciones del catálogo nativo (nativeCatalogPrefs)
 *
 * Todo gestionable desde un único botón «Editar catálogo» que abre
 * el editor con sus tres pestañas.
 */
function CatalogSection({ data }: SectionProps): JSX.Element {
  const lists = useMemo(
    () => hydrateUploadedCsvs(data.uploadedCsvs),
    [data.uploadedCsvs],
  );
  const dismissedCount = data.dismissedTrackUris.length;
  const excludedCount = data.nativeCatalogPrefs?.excludedUris.length ?? 0;
  const prefs = data.musicPreferences;
  const hasPrefs =
    prefs !== null &&
    (prefs.preferredGenres.length > 0 || prefs.allEnergetic === true);
  const nothingAtAll =
    lists.length === 0 &&
    dismissedCount === 0 &&
    excludedCount === 0 &&
    !hasPrefs;

  return (
    <Card title="Catálogo de música" titleIcon="library_music">
      {nothingAtAll ? (
        <EmptyHint
          icon="info"
          text="Aún no has personalizado tu música. En el paso «Música» de una sesión eliges géneros y subes tus listas; en el editor del catálogo decides qué canciones del catálogo predefinido quieres conservar."
        />
      ) : (
        <ul className="space-y-2 text-sm text-gris-700">
          {hasPrefs && prefs !== null && (
            <li className="flex items-start gap-2">
              <MaterialIcon
                name="music_note"
                size="small"
                className="text-turquesa-600 mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                {prefs.preferredGenres.length > 0 && (
                  <p>
                    <strong>Géneros preferidos:</strong>{' '}
                    <span className="inline-flex flex-wrap gap-1 align-middle">
                      {prefs.preferredGenres.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-turquesa-100 text-turquesa-800"
                        >
                          {g}
                        </span>
                      ))}
                    </span>
                  </p>
                )}
                {prefs.allEnergetic && (
                  <p className="text-xs text-gris-600">
                    «Todo con energía» activado
                  </p>
                )}
              </div>
            </li>
          )}
          {lists.length > 0 && (
            <li className="flex items-start gap-2">
              <MaterialIcon
                name="upload_file"
                size="small"
                className="text-turquesa-600 mt-0.5 shrink-0"
              />
              <span>
                <strong>
                  {lists.length} {lists.length === 1 ? 'lista subida' : 'listas subidas'}
                </strong>
                {': '}
                <span className="text-gris-500">
                  {lists
                    .slice(0, 3)
                    .map((l) => l.name)
                    .join(', ')}
                  {lists.length > 3 && ` y ${lists.length - 3} más`}
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
