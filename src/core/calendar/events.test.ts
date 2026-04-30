import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlannedEvent,
  listPlannedEvents,
  getPlannedEvent,
  updatePlannedEvent,
  deletePlannedEvent,
  markInstanceSkipped,
  unmarkInstanceSkipped,
  expandRecurrences,
  getEventsForDate,
} from './events';
import { clearCadenciaData, loadCadenciaData } from '@ui/state/cadenciaStore';

beforeEach(() => {
  clearCadenciaData();
});

describe('plannedEvents CRUD', () => {
  it('createPlannedEvent indoor genera id, timestamps y skippedDates vacio', () => {
    const created = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-05',
      savedSessionId: 'sess-1',
      recurrence: null,
    });
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.skippedDates).toEqual([]);
    expect(created.createdAt.length).toBeGreaterThan(0);
    expect(created.updatedAt).toBe(created.createdAt);
    expect(listPlannedEvents()).toHaveLength(1);
  });

  it('createPlannedEvent outdoor con URL externa la persiste', () => {
    const created = createPlannedEvent({
      type: 'outdoor',
      date: '2026-05-09',
      name: 'Pantano 50K',
      externalUrl: 'https://strava.com/routes/123',
      recurrence: null,
    });
    const fetched = getPlannedEvent(created.id);
    expect(fetched?.type).toBe('outdoor');
    if (fetched?.type === 'outdoor') {
      expect(fetched.externalUrl).toBe('https://strava.com/routes/123');
    }
  });

  it('listPlannedEvents oculta tombstones', () => {
    const a = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-05',
      savedSessionId: 's1',
      recurrence: null,
    });
    deletePlannedEvent(a.id);
    expect(listPlannedEvents()).toHaveLength(0);
  });

  it('getPlannedEvent devuelve null para tombstones', () => {
    const a = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-05',
      savedSessionId: 's1',
      recurrence: null,
    });
    deletePlannedEvent(a.id);
    expect(getPlannedEvent(a.id)).toBeNull();
  });

  it('updatePlannedEvent bumpea updatedAt', async () => {
    const a = createPlannedEvent({
      type: 'outdoor',
      date: '2026-05-05',
      name: 'Original',
      recurrence: null,
    });
    await new Promise((r) => setTimeout(r, 10));
    const after = updatePlannedEvent(a.id, { date: '2026-05-06' });
    expect(after?.date).toBe('2026-05-06');
    expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(
      new Date(a.updatedAt).getTime(),
    );
  });

  it('updatePlannedEvent devuelve null para id inexistente', () => {
    expect(updatePlannedEvent('no-existe', { date: '2026-01-01' })).toBeNull();
  });

  it('deletePlannedEvent deja tombstone con deletedAt', () => {
    const a = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-05',
      savedSessionId: 's1',
      recurrence: null,
    });
    deletePlannedEvent(a.id);
    const raw = localStorage.getItem('cadencia:data:v1');
    expect(raw).toContain('deletedAt');
    // El item sigue en el array crudo
    expect(loadCadenciaData().plannedEvents).toHaveLength(1);
  });
});

describe('expandRecurrences — evento puntual', () => {
  it('aparece solo en su date dentro del rango', () => {
    const events = [
      createPlannedEvent({
        type: 'outdoor',
        date: '2026-05-05',
        name: 'Pantano',
        recurrence: null,
      }),
    ];
    const instances = expandRecurrences(events, '2026-05-01', '2026-05-31');
    expect(instances).toHaveLength(1);
    expect(instances[0]?.date).toBe('2026-05-05');
    expect(instances[0]?.isRecurringInstance).toBe(false);
  });

  it('no aparece si el rango lo excluye', () => {
    const events = [
      createPlannedEvent({
        type: 'outdoor',
        date: '2026-05-05',
        name: 'Pantano',
        recurrence: null,
      }),
    ];
    expect(expandRecurrences(events, '2026-06-01', '2026-06-30')).toHaveLength(0);
  });
});

describe('expandRecurrences — evento recurrente semanal', () => {
  it('martes+jueves durante 4 semanas genera 8 instancias', () => {
    // 2026-05-01 = viernes. La serie empieza ese dia.
    // Martes (getDay=2) y jueves (getDay=4) en mayo 2026:
    //   M5, J7, M12, J14, M19, J21, M26, J28 → 8 instancias.
    const events = [
      createPlannedEvent({
        type: 'indoor',
        date: '2026-05-01',
        savedSessionId: 's1',
        recurrence: { daysOfWeek: [2, 4] },
      }),
    ];
    const instances = expandRecurrences(events, '2026-05-01', '2026-05-31');
    expect(instances).toHaveLength(8);
    expect(instances.map((i) => i.date)).toEqual([
      '2026-05-05',
      '2026-05-07',
      '2026-05-12',
      '2026-05-14',
      '2026-05-19',
      '2026-05-21',
      '2026-05-26',
      '2026-05-28',
    ]);
    expect(instances.every((i) => i.isRecurringInstance)).toBe(true);
  });

  it('no genera instancias antes de event.date (start date)', () => {
    const events = [
      createPlannedEvent({
        type: 'indoor',
        date: '2026-05-15',
        savedSessionId: 's1',
        recurrence: { daysOfWeek: [2] }, // martes
      }),
    ];
    // Mayo 2026: martes son 5, 12, 19, 26. Solo 19 y 26 son >= 15.
    const instances = expandRecurrences(events, '2026-05-01', '2026-05-31');
    expect(instances.map((i) => i.date)).toEqual(['2026-05-19', '2026-05-26']);
  });

  it('skippedDates excluye instancias concretas', () => {
    const events = [
      createPlannedEvent({
        type: 'indoor',
        date: '2026-05-01',
        savedSessionId: 's1',
        recurrence: { daysOfWeek: [2] }, // martes
      }),
    ];
    markInstanceSkipped(events[0]!.id, '2026-05-12');
    const fresh = listPlannedEvents();
    const instances = expandRecurrences(fresh, '2026-05-01', '2026-05-31');
    expect(instances.map((i) => i.date)).toEqual([
      '2026-05-05',
      '2026-05-19',
      '2026-05-26',
    ]);
  });

  it('unmarkInstanceSkipped restaura una instancia previamente saltada', () => {
    const e = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-01',
      savedSessionId: 's1',
      recurrence: { daysOfWeek: [2] },
    });
    markInstanceSkipped(e.id, '2026-05-12');
    unmarkInstanceSkipped(e.id, '2026-05-12');
    const fresh = listPlannedEvents();
    const instances = expandRecurrences(fresh, '2026-05-01', '2026-05-31');
    expect(instances.map((i) => i.date)).toContain('2026-05-12');
  });

  it('tombstone (deletedAt) suprime todas las instancias', () => {
    const e = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-01',
      savedSessionId: 's1',
      recurrence: { daysOfWeek: [2] },
    });
    deletePlannedEvent(e.id);
    // expandRecurrences recibe el array crudo (incluye tombstones); debe filtrarlos.
    const raw = loadCadenciaData().plannedEvents;
    expect(expandRecurrences(raw, '2026-05-01', '2026-05-31')).toHaveLength(0);
  });

  it('rango invertido (to < from) devuelve vacio', () => {
    const events = [
      createPlannedEvent({
        type: 'indoor',
        date: '2026-05-05',
        savedSessionId: 's1',
        recurrence: null,
      }),
    ];
    expect(expandRecurrences(events, '2026-05-31', '2026-05-01')).toHaveLength(0);
  });
});

describe('getEventsForDate', () => {
  it('devuelve vacio para dia sin eventos', () => {
    expect(getEventsForDate([], '2026-05-05')).toEqual([]);
  });

  it('devuelve evento puntual de ese dia', () => {
    const e = createPlannedEvent({
      type: 'outdoor',
      date: '2026-05-05',
      name: 'Pantano',
      recurrence: null,
    });
    const result = getEventsForDate([e], '2026-05-05');
    expect(result).toHaveLength(1);
    expect(result[0]?.event.id).toBe(e.id);
  });

  it('devuelve instancia recurrente de ese dia', () => {
    const e = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-01',
      savedSessionId: 's1',
      recurrence: { daysOfWeek: [2] }, // martes
    });
    const result = getEventsForDate([e], '2026-05-12'); // martes
    expect(result).toHaveLength(1);
    expect(result[0]?.isRecurringInstance).toBe(true);
  });

  it('devuelve dos eventos del mismo dia', () => {
    const a = createPlannedEvent({
      type: 'indoor',
      date: '2026-05-05',
      savedSessionId: 's1',
      recurrence: null,
    });
    const b = createPlannedEvent({
      type: 'outdoor',
      date: '2026-05-05',
      name: 'Otra cosa',
      recurrence: null,
    });
    const result = getEventsForDate([a, b], '2026-05-05');
    expect(result).toHaveLength(2);
  });
});

describe('idempotencia y determinismo', () => {
  it('expandRecurrences mismas entradas → misma salida', () => {
    const events = [
      createPlannedEvent({
        type: 'indoor',
        date: '2026-05-01',
        savedSessionId: 's1',
        recurrence: { daysOfWeek: [2, 4] },
      }),
      createPlannedEvent({
        type: 'outdoor',
        date: '2026-05-09',
        name: 'Pantano',
        recurrence: null,
      }),
    ];
    const a = expandRecurrences(events, '2026-05-01', '2026-05-31');
    const b = expandRecurrences(events, '2026-05-01', '2026-05-31');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
