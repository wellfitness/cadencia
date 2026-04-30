import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import type {
  PlannedEvent,
  PlannedIndoorEvent,
  PlannedOutdoorEvent,
  EventInstance,
} from './types';

/**
 * CRUD del calendario de planificacion + helpers de expansion para
 * resolver eventos recurrentes en instancias por fecha.
 *
 * Mismo patron que `src/core/sessions/saved.ts`: persistencia via
 * cadenciaStore (localStorage + sync Drive opcional), borrado logico via
 * tombstone (`deletedAt`), bumping de `updatedAt` para que el merge LWW
 * gane en otros dispositivos.
 *
 * `expandRecurrences` y `getEventsForDate` son puros: aceptan un array de
 * eventos arbitrario (filtran tombstones internamente) y no tocan
 * cadenciaStore. Esto permite testearlos con datos sinteticos y tambien
 * usarlos sobre snapshots reactivos de `useCadenciaData()`.
 */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface CreateIndoorInput {
  type: 'indoor';
  date: string;
  savedSessionId: string;
  recurrence: { daysOfWeek: number[] } | null;
  notes?: string;
}

interface CreateOutdoorInput {
  type: 'outdoor';
  date: string;
  name: string;
  externalUrl?: string;
  recurrence: { daysOfWeek: number[] } | null;
  notes?: string;
}

type CreateInput = CreateIndoorInput | CreateOutdoorInput;

export function createPlannedEvent(input: CreateInput): PlannedEvent {
  const now = new Date().toISOString();
  const base = {
    id: uuid(),
    date: input.date,
    recurrence: input.recurrence,
    skippedDates: [] as string[],
    createdAt: now,
    updatedAt: now,
  };

  let event: PlannedEvent;
  if (input.type === 'indoor') {
    const indoor: PlannedIndoorEvent = {
      ...base,
      type: 'indoor',
      savedSessionId: input.savedSessionId,
    };
    if (input.notes !== undefined) indoor.notes = input.notes;
    event = indoor;
  } else {
    const outdoor: PlannedOutdoorEvent = {
      ...base,
      type: 'outdoor',
      name: input.name,
    };
    if (input.externalUrl !== undefined) outdoor.externalUrl = input.externalUrl;
    if (input.notes !== undefined) outdoor.notes = input.notes;
    event = outdoor;
  }

  const data = loadCadenciaData();
  data.plannedEvents = [...data.plannedEvents, event];
  data._sectionMeta.plannedEvents = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return event;
}

/** Devuelve los eventos vivos (sin tombstones), mas reciente primero por createdAt. */
export function listPlannedEvents(): PlannedEvent[] {
  return loadCadenciaData()
    .plannedEvents.filter((e) => !e.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPlannedEvent(id: string): PlannedEvent | null {
  const found = loadCadenciaData().plannedEvents.find((e) => e.id === id);
  if (!found || found.deletedAt) return null;
  return found;
}

interface UpdateInput {
  date?: string;
  recurrence?: { daysOfWeek: number[] } | null;
  notes?: string;
  // Indoor:
  savedSessionId?: string;
  // Outdoor:
  name?: string;
  externalUrl?: string;
}

/**
 * Mutacion parcial de un evento. Mantiene el discriminador `type`
 * intacto: si el caller necesita cambiar de indoor a outdoor (o
 * viceversa), debe borrar y recrear.
 */
export function updatePlannedEvent(id: string, patch: UpdateInput): PlannedEvent | null {
  const data = loadCadenciaData();
  const idx = data.plannedEvents.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const current = data.plannedEvents[idx]!;
  if (current.deletedAt) return null;

  const now = new Date().toISOString();
  const updated: PlannedEvent = { ...current, ...patch, updatedAt: now } as PlannedEvent;

  data.plannedEvents = [
    ...data.plannedEvents.slice(0, idx),
    updated,
    ...data.plannedEvents.slice(idx + 1),
  ];
  data._sectionMeta.plannedEvents = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

/** Borrado logico: marca `deletedAt`. */
export function deletePlannedEvent(id: string): void {
  const data = loadCadenciaData();
  const idx = data.plannedEvents.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  const tombstone: PlannedEvent = {
    ...data.plannedEvents[idx]!,
    deletedAt: now,
    updatedAt: now,
  };
  data.plannedEvents = [
    ...data.plannedEvents.slice(0, idx),
    tombstone,
    ...data.plannedEvents.slice(idx + 1),
  ];
  data._sectionMeta.plannedEvents = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}

/**
 * Anade `dateISO` a `skippedDates` del evento. No-op si ya estaba.
 * Solo tiene efecto util sobre eventos recurrentes; sobre puntuales,
 * la entrada simplemente quedara sin instancias.
 */
export function markInstanceSkipped(id: string, dateISO: string): PlannedEvent | null {
  const data = loadCadenciaData();
  const idx = data.plannedEvents.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const current = data.plannedEvents[idx]!;
  if (current.deletedAt) return null;
  if (current.skippedDates.includes(dateISO)) return current;

  const now = new Date().toISOString();
  const updated: PlannedEvent = {
    ...current,
    skippedDates: [...current.skippedDates, dateISO],
    updatedAt: now,
  };
  data.plannedEvents = [
    ...data.plannedEvents.slice(0, idx),
    updated,
    ...data.plannedEvents.slice(idx + 1),
  ];
  data._sectionMeta.plannedEvents = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

export function unmarkInstanceSkipped(id: string, dateISO: string): PlannedEvent | null {
  const data = loadCadenciaData();
  const idx = data.plannedEvents.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const current = data.plannedEvents[idx]!;
  if (current.deletedAt) return null;
  if (!current.skippedDates.includes(dateISO)) return current;

  const now = new Date().toISOString();
  const updated: PlannedEvent = {
    ...current,
    skippedDates: current.skippedDates.filter((d) => d !== dateISO),
    updatedAt: now,
  };
  data.plannedEvents = [
    ...data.plannedEvents.slice(0, idx),
    updated,
    ...data.plannedEvents.slice(idx + 1),
  ];
  data._sectionMeta.plannedEvents = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

// --- Expansion de recurrencias -----------------------------------------

/**
 * Convierte 'YYYY-MM-DD' en un Date a las 00:00 hora LOCAL.
 *
 * `new Date('2026-05-01')` se interpreta como UTC midnight, lo que en
 * husos horarios negativos puede dar el dia 30 de abril en local. Para
 * trabajar en local hace falta el constructor (year, monthIndex, day).
 */
function parseLocalDate(iso: string): Date {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}

/** Convierte Date a 'YYYY-MM-DD' usando los getters locales. */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Expande eventos en sus instancias por fecha dentro de `[fromISO, toISO]`
 * (ambos inclusivos). Filtra tombstones (`deletedAt`) y `skippedDates`.
 *
 * El array se ordena por fecha ascendente para determinismo.
 */
export function expandRecurrences(
  events: readonly PlannedEvent[],
  fromISO: string,
  toISO: string,
): EventInstance[] {
  const from = parseLocalDate(fromISO);
  const to = parseLocalDate(toISO);
  if (from.getTime() > to.getTime()) return [];

  const instances: EventInstance[] = [];

  for (const event of events) {
    if (event.deletedAt) continue;

    if (event.recurrence === null) {
      // Evento puntual: aparece solo en su date.
      const eventDate = parseLocalDate(event.date);
      if (eventDate.getTime() < from.getTime()) continue;
      if (eventDate.getTime() > to.getTime()) continue;
      if (event.skippedDates.includes(event.date)) continue;
      instances.push({
        event,
        date: event.date,
        isRecurringInstance: false,
      });
      continue;
    }

    // Recurrente semanal por dias de la semana.
    const startDate = parseLocalDate(event.date);
    // Iterar desde max(from, startDate) hasta to.
    const cursor = new Date(
      Math.max(from.getTime(), startDate.getTime()),
    );
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= to.getTime()) {
      const dow = cursor.getDay();
      if (event.recurrence.daysOfWeek.includes(dow)) {
        const dateISO = formatLocalDate(cursor);
        if (!event.skippedDates.includes(dateISO)) {
          instances.push({
            event,
            date: dateISO,
            isRecurringInstance: true,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Sort por fecha asc, y por id como tiebreaker para determinismo.
  instances.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.event.id.localeCompare(b.event.id);
  });

  return instances;
}

/** Conveniencia: instancias de un dia concreto. */
export function getEventsForDate(
  events: readonly PlannedEvent[],
  dateISO: string,
): EventInstance[] {
  return expandRecurrences(events, dateISO, dateISO);
}
