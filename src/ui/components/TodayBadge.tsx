import { useMemo, useState } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { useCadenciaData } from '@ui/state/cadenciaStore';
import { listSavedSessions } from '@core/sessions/saved';
import { getEventsForDate, type EventInstance } from '@core/calendar';
import { loadPlannedEventToWizard } from '@ui/lib/loadPlannedEvent';
import { hasUnsavedWizardProgress } from '@ui/state/wizardStorage';
import { ConfirmDialog } from './ConfirmDialog';

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Badge "Hoy: {nombre}" que aparece en el Header cuando hay entradas
 * planificadas para hoy. Pulsarlo carga la entrada al wizard (si hay
 * una sola) o abre un mini-popover con todas (si hay varias).
 *
 * Recalcula `todayLocalISO()` solo en el primer mount: si la pestana
 * cruza la medianoche, el usuario hara reload o el sync forzara un
 * re-render. No vale la pena un timer.
 */
export function TodayBadge(): JSX.Element | null {
  const data = useCadenciaData();
  const today = useMemo(() => todayLocalISO(), []);
  // listSavedSessions() lee del cadenciaStore; useCadenciaData garantiza
  // que cuando savedSessions cambie nos re-rendericemos. La lista en si
  // se recalcula en cada render, suficiente para los pocos items que hay.
  const sessions = listSavedSessions();

  const todaysInstances = useMemo(
    () => getEventsForDate(data.plannedEvents, today),
    [data.plannedEvents, today],
  );

  const [open, setOpen] = useState<boolean>(false);
  const [pendingLoad, setPendingLoad] = useState<EventInstance | null>(null);

  if (todaysInstances.length === 0) return null;

  const sessionsById = new Map(sessions.map((s) => [s.id, s]));

  function resolveTitle(inst: EventInstance): string {
    if (inst.event.type === 'indoor') {
      const s = sessionsById.get(inst.event.savedSessionId);
      return s?.name ?? 'Sesión borrada';
    }
    return inst.event.name;
  }

  const first = todaysInstances[0]!;
  const firstTitle = resolveTitle(first);
  const moreCount = todaysInstances.length - 1;

  function handleClick(inst: EventInstance): void {
    if (hasUnsavedWizardProgress()) {
      setPendingLoad(inst);
      setOpen(false);
      return;
    }
    loadPlannedEventToWizard(inst);
  }

  function confirmLoad(): void {
    if (pendingLoad === null) return;
    loadPlannedEventToWizard(pendingLoad);
    setPendingLoad(null);
  }

  // Caso 1 evento: el badge ejecuta directamente.
  if (todaysInstances.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => handleClick(first)}
          aria-label={`Hoy toca ${firstTitle}. Cargar al wizard.`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-tulipTree-300 bg-tulipTree-50 text-tulipTree-700 text-xs md:text-sm font-medium hover:bg-tulipTree-100 min-h-[36px] max-w-[180px] md:max-w-[260px]"
          title={`Hoy: ${firstTitle}`}
        >
          <MaterialIcon name="today" size="small" />
          <span className="hidden sm:inline truncate">Hoy:</span>
          <span className="truncate">{firstTitle}</span>
        </button>
        <ConfirmDialog
          open={pendingLoad !== null}
          title="Descartar plan en curso"
          icon="warning"
          confirmLabel="Sí, cargar este"
          cancelLabel="Mantener el actual"
          onConfirm={confirmLoad}
          onCancel={() => setPendingLoad(null)}
          message={
            <p>
              Tienes un plan en curso. Si cargas la entrada de hoy, perderás el progreso actual.
            </p>
          }
        />
      </>
    );
  }

  // ≥2 eventos: popover con los items.
  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Hoy hay ${todaysInstances.length} entrenamientos planificados`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-tulipTree-300 bg-tulipTree-50 text-tulipTree-700 text-xs md:text-sm font-medium hover:bg-tulipTree-100 min-h-[36px]"
        >
          <MaterialIcon name="today" size="small" />
          <span className="hidden sm:inline">Hoy:</span>
          <span className="truncate max-w-[100px]">{firstTitle}</span>
          <span className="text-[11px] opacity-80">+{moreCount}</span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-40 w-64 rounded-lg border border-gris-200 bg-white shadow-lg p-1.5"
            >
              <p className="text-xs text-gris-500 px-2 py-1">Hoy:</p>
              {todaysInstances.map((inst) => (
                <button
                  key={`${inst.event.id}-${inst.date}`}
                  type="button"
                  role="menuitem"
                  onClick={() => handleClick(inst)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left text-gris-800 hover:bg-turquesa-50 min-h-[40px]"
                >
                  <MaterialIcon
                    name={inst.event.type === 'indoor' ? 'directions_bike' : 'map'}
                    size="small"
                    className={
                      inst.event.type === 'indoor' ? 'text-turquesa-600' : 'text-tulipTree-600'
                    }
                  />
                  <span className="truncate flex-1">{resolveTitle(inst)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={pendingLoad !== null}
        title="Descartar plan en curso"
        icon="warning"
        confirmLabel="Sí, cargar este"
        cancelLabel="Mantener el actual"
        onConfirm={confirmLoad}
        onCancel={() => setPendingLoad(null)}
        message={
          <p>
            Tienes un plan en curso. Si cargas la entrada de hoy, perderás el progreso actual.
          </p>
        }
      />
    </>
  );
}
