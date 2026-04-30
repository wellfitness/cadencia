import { useMemo, useState } from 'react';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { GoogleSyncCard } from '@ui/components/sync/GoogleSyncCard';
import { useCadenciaData, clearCadenciaData } from '@ui/state/cadenciaStore';
import { hydrateUploadedCsvs } from '@ui/state/uploadedCsv';
import { loadNativeTracks, type Track } from '@core/tracks';
import { listSavedSessions, deleteSavedSession } from '@core/sessions/saved';
import { removeDismissedUri, clearAllDismissed } from '@core/csvs/dismissed';
import { calculateTotalDurationSec } from '@core/segmentation';
import { navigateInApp } from '@ui/utils/navigation';
import { BIKE_TYPE_LABELS } from '@core/power';

export interface MyAccountPageProps {
  onClose: () => void;
}

/**
 * Pagina "Mi cuenta": vista consolidada de todo lo que Cadencia recuerda
 * sobre el usuario. Accesible via /cuenta.
 *
 * Reactivo: usa useCadenciaData() para refrescarse cuando llegan cambios
 * via sync de Drive desde otro dispositivo.
 *
 * No tiene cuentas ni login — la "cuenta" aqui es el conjunto de datos
 * locales (cadenciaStore en localStorage), opcionalmente sincronizados
 * con Google Drive del usuario via opt-in.
 */
export function MyAccountPage({ onClose }: MyAccountPageProps): JSX.Element {
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
            Mi cuenta
          </h1>
          <span className="w-12" aria-hidden /> {/* spacer */}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6 space-y-4 md:space-y-5">
          <Card title="Sincronización entre dispositivos" titleIcon="cloud_sync">
            <GoogleSyncCard />
          </Card>

          <UserDataSection data={data} />

          <MusicPreferencesSection data={data} />

          <SavedSessionsSection />

          <UploadedCsvsSection data={data} />

          <DismissedTracksSection data={data} />

          <NativeCatalogSection data={data} />

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
              dispositivo: datos físicos, preferencias musicales, sesiones
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

function UserDataSection({ data }: SectionProps): JSX.Element {
  const u = data.userInputs;
  const isEmpty = u === null || Object.values(u).every((v) => v === null);
  return (
    <Card title="Mis datos físicos" titleIcon="person">
      {isEmpty ? (
        <EmptyHint
          icon="info"
          text="No has guardado ningún dato físico todavía. Rellénalos en el primer paso del wizard."
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
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          iconLeft="edit"
          onClick={() => navigateInApp('/')}
        >
          Editar en el wizard
        </Button>
      </div>
    </Card>
  );
}

function MusicPreferencesSection({ data }: SectionProps): JSX.Element {
  const p = data.musicPreferences;
  const isEmpty =
    p === null ||
    (p.preferredGenres.length === 0 &&
      p.allEnergetic === false &&
      p.seed === undefined);
  return (
    <Card title="Mis preferencias musicales" titleIcon="music_note">
      {isEmpty ? (
        <EmptyHint
          icon="info"
          text="Aún no has fijado preferencias musicales. Las verás aquí cuando elijas géneros en el paso «Música»."
        />
      ) : (
        <div className="space-y-2 text-sm text-gris-700">
          <p>
            <strong>Géneros preferidos:</strong>{' '}
            {p.preferredGenres.length > 0 ? (
              <span className="inline-flex flex-wrap gap-1 align-middle">
                {p.preferredGenres.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-turquesa-100 text-turquesa-800"
                  >
                    {g}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-gris-500">ninguno</span>
            )}
          </p>
          <p>
            <strong>Todo con energía:</strong>{' '}
            {p.allEnergetic ? 'sí' : 'no'}
          </p>
          {p.seed !== undefined && (
            <p>
              <strong>Semilla actual:</strong>{' '}
              <code className="text-xs">{p.seed}</code>
              <span className="text-gris-500 text-xs ml-1">
                · cambia con el botón "🎲 Regenerar lista"
              </span>
            </p>
          )}
        </div>
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

function UploadedCsvsSection({ data }: SectionProps): JSX.Element {
  const lists = useMemo(
    () => hydrateUploadedCsvs(data.uploadedCsvs),
    [data.uploadedCsvs],
  );
  return (
    <Card title="Mis listas de música" titleIcon="library_music">
      {lists.length === 0 ? (
        <EmptyHint
          icon="upload_file"
          text="No has subido ninguna lista. Súbelas desde el editor de catálogo o el paso «Música» del wizard."
        />
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-gris-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gris-800 truncate">
                  {l.name}
                </p>
                <p className="text-xs text-gris-500">
                  {l.trackCount} {l.trackCount === 1 ? 'canción' : 'canciones'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          iconRight="arrow_forward"
          onClick={() => navigateInApp('/catalogo?tab=mine')}
        >
          Gestionar mis listas
        </Button>
      </div>
    </Card>
  );
}

function DismissedTracksSection({ data }: SectionProps): JSX.Element {
  // Resolvemos cada URI descartada a su Track (cruzando native + uploaded
  // hidratado) para mostrar nombre+artistas. Si no se encuentra (track
  // borrado del catalogo), mostramos solo la URI con nota.
  const native = useMemo(() => loadNativeTracks(), []);
  const uploaded = useMemo(
    () => hydrateUploadedCsvs(data.uploadedCsvs),
    [data.uploadedCsvs],
  );
  const trackByUri = useMemo<Map<string, Track>>(() => {
    const m = new Map<string, Track>();
    for (const t of native) m.set(t.uri, t);
    for (const list of uploaded) for (const t of list.tracks) m.set(t.uri, t);
    return m;
  }, [native, uploaded]);

  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const dismissed = data.dismissedTrackUris;

  return (
    <Card title="Canciones descartadas" titleIcon="block">
      {dismissed.length === 0 ? (
        <EmptyHint
          icon="check_circle"
          text="No has descartado ninguna canción todavía. Si una canción no te gusta, puedes descartarla desde el paso «A pedalear»."
        />
      ) : (
        <>
          <p className="text-xs text-gris-500 mb-2">
            {dismissed.length}{' '}
            {dismissed.length === 1 ? 'canción' : 'canciones'} no aparecerán en
            futuras playlists. Pulsa «Recuperar» para devolverla al catálogo.
          </p>
          <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {dismissed.map((uri) => {
              const t = trackByUri.get(uri);
              return (
                <li
                  key={uri}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border border-gris-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gris-800 truncate">
                      {t?.name ?? <span className="italic text-gris-500">Track no encontrado</span>}
                    </p>
                    <p className="text-xs text-gris-500 truncate">
                      {t ? t.artists.join(', ') : uri}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDismissedUri(uri)}
                    aria-label={`Recuperar ${t?.name ?? uri}`}
                    className="px-2 py-1 rounded-md border border-turquesa-300 text-turquesa-700 hover:bg-turquesa-50 text-xs font-semibold min-h-[36px] inline-flex items-center gap-1"
                  >
                    <MaterialIcon name="undo" size="small" />
                    Recuperar
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              iconLeft="undo"
              onClick={() => setConfirmClearAll(true)}
            >
              Recuperar todas
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmClearAll}
        title="Recuperar todas las canciones descartadas"
        icon="undo"
        confirmLabel="Sí, recuperar todas"
        confirmVariant="primary"
        onConfirm={() => {
          clearAllDismissed();
          setConfirmClearAll(false);
        }}
        onCancel={() => setConfirmClearAll(false)}
        message={
          <p>
            Las {dismissed.length}{' '}
            {dismissed.length === 1 ? 'canción' : 'canciones'} que descartaste
            volverán al catálogo y podrán aparecer en futuras playlists.
          </p>
        }
      />
    </Card>
  );
}

function NativeCatalogSection({ data }: SectionProps): JSX.Element {
  const excludedCount = data.nativeCatalogPrefs?.excludedUris.length ?? 0;
  return (
    <Card title="Personalización del catálogo nativo" titleIcon="tune">
      <p className="text-sm text-gris-700">
        {excludedCount === 0 ? (
          <span className="text-gris-500">
            No has personalizado el catálogo nativo. Todas sus canciones están
            disponibles para tus playlists.
          </span>
        ) : (
          <>
            Has descartado <strong>{excludedCount}</strong> canciones del
            catálogo nativo en el editor.
          </>
        )}
      </p>
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
