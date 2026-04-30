import { useMemo, useState } from 'react';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { useCadenciaData } from '@ui/state/cadenciaStore';
import { CalendarListView } from '@ui/components/calendar/CalendarListView';
import { CalendarMonthView } from '@ui/components/calendar/CalendarMonthView';
import { EventEditorDialog } from '@ui/components/calendar/EventEditorDialog';
import { loadPlannedEventToWizard } from '@ui/lib/loadPlannedEvent';
import { hasUnsavedWizardProgress } from '@ui/state/wizardStorage';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { navigateBack } from '@ui/utils/navigation';
import type { PlannedEvent, EventInstance } from '@core/calendar';

type Tab = 'list' | 'month';

export interface CalendarPageProps {
  onClose: () => void;
}

/**
 * Pagina /calendario: dos tabs (Lista y Mes) sobre el mismo conjunto de
 * eventos. Crea/edita entradas via dialog. Reactivo via useCadenciaData
 * para reflejar cambios desde otros dispositivos via sync.
 *
 * Si el usuario tiene wizard en curso al pulsar "Cargar" sobre una
 * entrada, primero le pedimos confirmacion antes de sobrescribir el
 * progreso.
 */
export function CalendarPage({ onClose }: CalendarPageProps): JSX.Element {
  const data = useCadenciaData();
  const events = useMemo(() => data.plannedEvents, [data.plannedEvents]);

  const [tab, setTab] = useState<Tab>('list');
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editorEvent, setEditorEvent] = useState<PlannedEvent | null>(null);
  const [editorInitialDate, setEditorInitialDate] = useState<string | undefined>(undefined);

  // Estado del dialog de descarte previo a cargar un evento al wizard.
  const [pendingLoad, setPendingLoad] = useState<PlannedEvent | EventInstance | null>(null);

  function openCreate(initialDate?: string): void {
    setEditorEvent(null);
    setEditorInitialDate(initialDate);
    setEditorOpen(true);
  }

  function openEdit(ev: PlannedEvent): void {
    setEditorEvent(ev);
    setEditorInitialDate(undefined);
    setEditorOpen(true);
  }

  function handleLoadEvent(ev: PlannedEvent | EventInstance): void {
    if (hasUnsavedWizardProgress()) {
      setPendingLoad(ev);
      return;
    }
    loadPlannedEventToWizard(ev);
  }

  function confirmLoad(): void {
    if (pendingLoad === null) return;
    loadPlannedEventToWizard(pendingLoad);
    setPendingLoad(null);
  }

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
            Calendario
          </h1>
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Nueva entrada"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-turquesa-600 text-white text-sm font-semibold hover:bg-turquesa-700 min-h-[36px]"
          >
            <MaterialIcon name="add" size="small" />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6 space-y-4">
          <div
            role="tablist"
            aria-label="Vista del calendario"
            className="inline-flex rounded-lg border border-gris-200 bg-white p-0.5"
          >
            <TabButton active={tab === 'list'} onClick={() => setTab('list')}>
              <MaterialIcon name="view_list" size="small" />
              Lista
            </TabButton>
            <TabButton active={tab === 'month'} onClick={() => setTab('month')}>
              <MaterialIcon name="calendar_month" size="small" />
              Mes
            </TabButton>
          </div>

          <Card>
            {tab === 'list' ? (
              <CalendarListView
                events={events}
                onEdit={openEdit}
                onCreate={openCreate}
                onLoadEvent={handleLoadEvent}
              />
            ) : (
              <CalendarMonthView
                events={events}
                onEdit={openEdit}
                onCreate={openCreate}
                onLoadEvent={handleLoadEvent}
              />
            )}
          </Card>

          <p className="text-xs text-gris-500 text-center px-4">
            Las entradas se guardan en este dispositivo. Si has conectado Google Drive en{' '}
            <a
              href="/preferencias"
              onClick={(e) => {
                e.preventDefault();
                navigateBack('/preferencias');
              }}
              className="text-turquesa-700 underline"
            >
              Mis preferencias
            </a>
            , se sincronizan automáticamente con tu otra app.
          </p>
        </div>
      </main>

      <EventEditorDialog
        open={editorOpen}
        event={editorEvent}
        {...(editorInitialDate !== undefined ? { initialDate: editorInitialDate } : {})}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setEditorOpen(false)}
      />

      <ConfirmDialog
        open={pendingLoad !== null}
        title="Descartar plan en curso"
        icon="warning"
        confirmLabel="Sí, cargar este"
        cancelLabel="Mantener el actual"
        confirmVariant="primary"
        onConfirm={confirmLoad}
        onCancel={() => setPendingLoad(null)}
        message={
          <p>
            Tienes un plan en curso en el wizard. Si cargas esta entrada, perderás el progreso
            actual.
          </p>
        }
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium min-h-[40px] transition-colors ${
        active
          ? 'bg-turquesa-600 text-white'
          : 'text-gris-700 hover:bg-gris-100'
      }`}
    >
      {children}
    </button>
  );
}
