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

export interface CalendarMonthViewProps {
  events: readonly PlannedEvent[];
  onEdit: (event: PlannedEvent) => void;
  onCreate: (initialDate: string) => void;
  onLoadEvent: (event: PlannedEvent | EventInstance) => void;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function todayLocalISO(): string {
  return formatLocalISO(new Date());
}

function formatLocalISO(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Calcula el offset (0..6) desde el lunes para el dia 1 del mes.
 * Si dia 1 cae en domingo (getDay=0), offset = 6. Si lunes, 0.
 */
function mondayOffset(day1Dow: number): number {
  return (day1Dow + 6) % 7;
}

/**
 * Vista mensual del calendario. Grid 7 columnas (lunes a domingo), entre
 * 4 y 6 filas dependiendo del mes. Cada celda muestra el numero de dia y
 * hasta 3 indicadores compactos de entradas (mas un "+N" si hay mas).
 *
 * Click en una celda con eventos selecciona el dia y muestra los detalles
 * debajo. Click en una celda vacia abre el editor en modo creacion para
 * esa fecha.
 */
export function CalendarMonthView({
  events,
  onEdit,
  onCreate,
  onLoadEvent,
}: CalendarMonthViewProps): JSX.Element {
  const [yearMonth, setYearMonth] = useState<{ year: number; month: number }>(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  const { year, month } = yearMonth;
  const today = todayLocalISO();
  const first = startOfMonth(year, month);
  const day1Dow = first.getDay(); // 0=domingo .. 6=sabado
  const offset = mondayOffset(day1Dow);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((offset + lastDay) / 7) * 7;

  // Rango del mes para expandRecurrences (inclusivos).
  const fromISO = formatLocalISO(new Date(year, month, 1));
  const toISO = formatLocalISO(new Date(year, month, lastDay));
  const instances = expandRecurrences(events, fromISO, toISO);

  const byDate = useMemo(() => {
    const m = new Map<string, EventInstance[]>();
    for (const inst of instances) {
      const list = m.get(inst.date) ?? [];
      list.push(inst);
      m.set(inst.date, list);
    }
    return m;
  }, [instances]);

  const cells: Array<{ dateISO: string; day: number; inMonth: boolean } | null> = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > lastDay) {
      cells.push(null);
    } else {
      const d = new Date(year, month, dayNum);
      cells.push({ dateISO: formatLocalISO(d), day: dayNum, inMonth: true });
    }
  }

  const selectedInstances =
    selectedDate !== null ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setYearMonth(({ year: y, month: m }) =>
              m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 },
            );
            setSelectedDate(null);
          }}
          aria-label="Mes anterior"
          className="p-2 rounded-md text-gris-700 hover:bg-gris-100 min-h-[44px] min-w-[44px]"
        >
          <MaterialIcon name="chevron_left" />
        </button>
        <h3 className="text-base md:text-lg font-display font-bold text-gris-800 capitalize">
          {monthLabel(year, month)}
        </h3>
        <button
          type="button"
          onClick={() => {
            setYearMonth(({ year: y, month: m }) =>
              m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 },
            );
            setSelectedDate(null);
          }}
          aria-label="Mes siguiente"
          className="p-2 rounded-md text-gris-700 hover:bg-gris-100 min-h-[44px] min-w-[44px]"
        >
          <MaterialIcon name="chevron_right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gris-500">
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="py-1">
            {h}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const list = byDate.get(cell.dateISO) ?? [];
          const isToday = cell.dateISO === today;
          const isSelected = cell.dateISO === selectedDate;
          return (
            <button
              key={cell.dateISO}
              type="button"
              onClick={() => setSelectedDate(cell.dateISO)}
              className={`aspect-square rounded-md border p-1 text-left transition-colors flex flex-col ${
                isSelected
                  ? 'border-turquesa-600 bg-turquesa-50'
                  : isToday
                    ? 'border-turquesa-400 bg-white'
                    : 'border-gris-200 bg-white hover:border-turquesa-300'
              }`}
              aria-label={`${cell.day}, ${list.length} ${list.length === 1 ? 'entrada' : 'entradas'}`}
            >
              <span
                className={`text-xs font-semibold ${
                  isToday ? 'text-turquesa-700' : 'text-gris-700'
                }`}
              >
                {cell.day}
              </span>
              {list.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {list.slice(0, 3).map((inst, i) => (
                    <span
                      key={i}
                      className={`block w-1.5 h-1.5 rounded-full ${
                        inst.event.type === 'indoor' ? 'bg-turquesa-500' : 'bg-tulipTree-500'
                      }`}
                      aria-hidden
                    />
                  ))}
                  {list.length > 3 && (
                    <span className="text-[9px] text-gris-500 leading-none">+{list.length - 3}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate !== null && (
        <DayDetailPanel
          dateISO={selectedDate}
          instances={selectedInstances}
          sessionsById={sessionsById}
          onClose={() => setSelectedDate(null)}
          onCreate={() => onCreate(selectedDate)}
          onEdit={onEdit}
          onLoadEvent={onLoadEvent}
        />
      )}
    </div>
  );
}

function DayDetailPanel({
  dateISO,
  instances,
  sessionsById,
  onClose,
  onCreate,
  onEdit,
  onLoadEvent,
}: {
  dateISO: string;
  instances: EventInstance[];
  sessionsById: Map<string, SavedSession>;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (event: PlannedEvent) => void;
  onLoadEvent: (event: PlannedEvent | EventInstance) => void;
}): JSX.Element {
  const parts = dateISO.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(y, m - 1, d);
  const heading = date
    .toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="rounded-lg border border-gris-200 bg-white p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm md:text-base font-display font-bold text-gris-800">
          {heading}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="p-1.5 rounded-md text-gris-500 hover:bg-gris-100 min-h-[36px] min-w-[36px]"
        >
          <MaterialIcon name="close" size="small" />
        </button>
      </div>
      {instances.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gris-600 mb-2">Sin entradas este día.</p>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1 text-sm text-turquesa-700 font-semibold hover:underline px-3 py-2 min-h-[36px]"
          >
            <MaterialIcon name="add" size="small" />
            Planificar algo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map((inst) => (
            <DetailRow
              key={`${inst.event.id}-${inst.date}`}
              instance={inst}
              sessionsById={sessionsById}
              onEdit={onEdit}
              onLoadEvent={onLoadEvent}
            />
          ))}
          <div className="pt-2">
            <button
              type="button"
              onClick={onCreate}
              className="text-xs text-turquesa-700 hover:underline px-2 py-1.5 min-h-[36px]"
            >
              + Añadir otra entrada en este día
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
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
  const { event, isRecurringInstance, date } = instance;
  const isIndoor = event.type === 'indoor';
  const session = isIndoor ? sessionsById.get(event.savedSessionId) : null;
  const sessionDeleted = isIndoor && !session;
  const title = isIndoor ? (sessionDeleted ? 'Sesión borrada' : (session?.name ?? '')) : event.name;

  const handleSkip = (): void => {
    if (window.confirm('¿Saltar esta instancia? La serie sigue activa.')) {
      markInstanceSkipped(event.id, date);
    }
  };

  return (
    <div
      className={`rounded-md border p-2.5 ${
        sessionDeleted ? 'border-rosa-200 bg-rosa-50' : 'border-gris-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <MaterialIcon
          name={isIndoor ? 'directions_bike' : 'map'}
          size="small"
          className={isIndoor ? 'text-turquesa-600' : 'text-tulipTree-600'}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
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
          {event.notes !== undefined && event.notes.length > 0 && (
            <p className="text-xs text-gris-600 mt-0.5">{event.notes}</p>
          )}
        </div>
      </div>
      <div className="flex gap-1 mt-2">
        {!sessionDeleted && (
          <button
            type="button"
            onClick={() => onLoadEvent(instance)}
            className="flex-1 px-2.5 py-1 rounded-md bg-turquesa-600 text-white text-xs font-medium hover:bg-turquesa-700 min-h-[36px]"
          >
            Cargar
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label="Editar"
          className="px-2.5 py-1 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[36px]"
        >
          <MaterialIcon name="edit" size="small" />
        </button>
        {isRecurringInstance && (
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Saltar esta"
            className="px-2.5 py-1 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[36px]"
          >
            <MaterialIcon name="skip_next" size="small" />
          </button>
        )}
      </div>
    </div>
  );
}
