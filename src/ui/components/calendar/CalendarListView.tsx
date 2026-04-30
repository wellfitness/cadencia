import { useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../MaterialIcon';
import {
  expandRecurrences,
  markInstanceSkipped,
  type EventInstance,
  type PlannedEvent,
} from '@core/calendar';
import { listSavedSessions } from '@core/sessions/saved';
import type { SavedSession } from '@core/sync/types';

export interface CalendarListViewProps {
  events: readonly PlannedEvent[];
  onEdit: (event: PlannedEvent) => void;
  onCreate: (initialDate: string) => void;
  onLoadEvent: (event: PlannedEvent | EventInstance) => void;
}

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function todayLocalISO(): string {
  const d = new Date();
  return formatLocalISO(d);
}

function formatLocalISO(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, delta: number): string {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d + delta);
  return formatLocalISO(date);
}

function daysOfWeekLabel(dow: readonly number[]): string {
  return dow
    .slice()
    .sort()
    .map((d) => DAY_LETTERS[d])
    .join('+');
}

function formatDateHeader(dateISO: string): string {
  const parts = dateISO.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Vista lista cronologica del calendario. Default: proximos 60 dias.
 * Permite extender con "Cargar mas".
 *
 * Resuelve los nombres de SavedSession para entradas indoor. Si la sesion
 * fue borrada (sync de otro device), muestra "Sesion borrada" y el item
 * solo permite editar o eliminar (no cargar al wizard).
 */
export function CalendarListView({
  events,
  onEdit,
  onCreate,
  onLoadEvent,
}: CalendarListViewProps): JSX.Element {
  const [horizonDays, setHorizonDays] = useState<number>(60);
  const [sessions, setSessions] = useState<SavedSession[]>(() => listSavedSessions());

  useEffect(() => {
    const handler = (): void => setSessions(listSavedSessions());
    window.addEventListener('cadencia-data-saved', handler);
    return () => window.removeEventListener('cadencia-data-saved', handler);
  }, []);

  const sessionsById = useMemo(() => {
    const m = new Map<string, SavedSession>();
    for (const s of sessions) m.set(s.id, s);
    return m;
  }, [sessions]);

  const today = todayLocalISO();
  const horizonEnd = addDaysISO(today, horizonDays);
  const instances = expandRecurrences(events, today, horizonEnd);

  // Agrupar por fecha.
  const byDate = useMemo(() => {
    const groups = new Map<string, EventInstance[]>();
    for (const inst of instances) {
      const list = groups.get(inst.date) ?? [];
      list.push(inst);
      groups.set(inst.date, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [instances]);

  if (byDate.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gris-300 bg-gris-50 p-6 text-center">
        <MaterialIcon name="event_available" size="large" className="text-gris-400 mb-2" />
        <p className="text-sm text-gris-600 mb-3">
          No hay entrenamientos planificados en los próximos {horizonDays} días.
        </p>
        <button
          type="button"
          onClick={() => onCreate(today)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-turquesa-600 text-white text-sm font-semibold hover:bg-turquesa-700 min-h-[44px]"
        >
          <MaterialIcon name="add" size="small" />
          Planificar el primero
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byDate.map(([dateISO, list]) => (
        <DayGroup
          key={dateISO}
          dateISO={dateISO}
          isToday={dateISO === today}
          instances={list}
          sessionsById={sessionsById}
          onEdit={onEdit}
          onLoadEvent={onLoadEvent}
        />
      ))}
      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setHorizonDays((d) => d + 60)}
          className="text-sm text-turquesa-700 hover:underline px-3 py-2 min-h-[36px]"
        >
          Cargar más días
        </button>
      </div>
    </div>
  );
}

function DayGroup({
  dateISO,
  isToday,
  instances,
  sessionsById,
  onEdit,
  onLoadEvent,
}: {
  dateISO: string;
  isToday: boolean;
  instances: EventInstance[];
  sessionsById: Map<string, SavedSession>;
  onEdit: (event: PlannedEvent) => void;
  onLoadEvent: (event: PlannedEvent | EventInstance) => void;
}): JSX.Element {
  return (
    <section aria-labelledby={`day-${dateISO}`}>
      <h3
        id={`day-${dateISO}`}
        className={`text-sm font-semibold mb-2 ${
          isToday ? 'text-turquesa-700' : 'text-gris-700'
        }`}
      >
        {isToday ? 'HOY · ' : ''}
        {formatDateHeader(dateISO)}
      </h3>
      <div className="space-y-2">
        {instances.map((inst) => (
          <EventInstanceRow
            key={`${inst.event.id}-${inst.date}`}
            instance={inst}
            sessionsById={sessionsById}
            onEdit={onEdit}
            onLoadEvent={onLoadEvent}
          />
        ))}
      </div>
    </section>
  );
}

function EventInstanceRow({
  instance,
  sessionsById,
  onEdit,
  onLoadEvent,
}: {
  instance: EventInstance;
  sessionsById: Map<string, SavedSession>;
  onEdit: (event: PlannedEvent) => void;
  onLoadEvent: (event: PlannedEvent | EventInstance) => void;
}): JSX.Element {
  const { event, date, isRecurringInstance } = instance;
  const isIndoor = event.type === 'indoor';
  const session = isIndoor ? sessionsById.get(event.savedSessionId) : null;
  const sessionDeleted = isIndoor && !session;

  const title = isIndoor ? (sessionDeleted ? 'Sesión borrada' : (session?.name ?? '')) : event.name;

  const handleSkip = (): void => {
    if (
      window.confirm(
        '¿Saltar esta instancia? Solo desaparece este día; la serie sigue activa.',
      )
    ) {
      markInstanceSkipped(event.id, date);
    }
  };

  return (
    <div
      className={`rounded-lg border-2 p-3 bg-white transition-colors ${
        sessionDeleted ? 'border-rosa-200' : 'border-gris-200 hover:border-turquesa-400'
      }`}
    >
      <div className="flex items-start gap-3">
        <MaterialIcon
          name={isIndoor ? 'directions_bike' : 'map'}
          size="small"
          className={isIndoor ? 'text-turquesa-600 mt-0.5' : 'text-tulipTree-600 mt-0.5'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`font-display font-semibold text-sm leading-tight ${
                sessionDeleted ? 'text-rosa-700' : 'text-gris-800'
              }`}
            >
              {title}
            </h4>
            {isRecurringInstance && event.recurrence !== null && (
              <span className="text-[11px] text-tulipTree-700 bg-tulipTree-50 border border-tulipTree-200 rounded px-1.5 py-0.5 font-medium">
                <MaterialIcon name="repeat" size="small" className="inline" />{' '}
                {daysOfWeekLabel(event.recurrence.daysOfWeek)}
              </span>
            )}
          </div>
          {event.notes !== undefined && event.notes.length > 0 && (
            <p className="text-xs text-gris-600 mt-1 line-clamp-2">{event.notes}</p>
          )}
          {event.type === 'outdoor' && event.externalUrl !== undefined && (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-turquesa-700 hover:underline mt-1"
            >
              <MaterialIcon name="open_in_new" size="small" />
              Abrir en navegador
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mt-2">
        {!sessionDeleted && (
          <button
            type="button"
            onClick={() => onLoadEvent(instance)}
            className="flex-1 px-3 py-1.5 rounded-md bg-turquesa-600 text-white text-xs font-medium hover:bg-turquesa-700 min-h-[40px] inline-flex items-center justify-center gap-1"
          >
            <MaterialIcon name="play_arrow" size="small" />
            Cargar
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label="Editar entrada"
          className="px-3 py-1.5 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[40px]"
        >
          <MaterialIcon name="edit" size="small" />
        </button>
        {isRecurringInstance && (
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Saltar esta instancia"
            title="Saltar esta instancia"
            className="px-3 py-1.5 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[40px]"
          >
            <MaterialIcon name="skip_next" size="small" />
          </button>
        )}
      </div>

      {sessionDeleted && (
        <p className="mt-2 text-xs text-rosa-700">
          La sesión guardada que esta entrada referenciaba fue borrada. Edita la entrada para
          enlazarla con otra sesión, o elimínala.
        </p>
      )}
    </div>
  );
}

