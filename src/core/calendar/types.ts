/**
 * Modelo de datos del calendario de planificacion.
 *
 * Una entrada (`PlannedEvent`) representa un entrenamiento futuro que el
 * usuario quiere recordar. Hay dos tipos:
 *
 *  - `indoor`: referencia a una `SavedSession` existente. Al cargar la
 *    entrada al wizard, se rehidrata el plan completo desde el store.
 *  - `outdoor`: ruta GPX que el usuario hara fuera. No persistimos el GPX
 *    (puede pesar MB), solo metadata: nombre, notas y opcionalmente una
 *    URL externa (Strava/Komoot/RideWithGPS) para abrirla el dia D.
 *
 * Las entradas pueden ser puntuales (una sola fecha) o recurrentes con
 * patron semanal por dias de la semana, sin fecha de fin. Para saltar una
 * instancia concreta de una serie recurrente se anade su fecha al array
 * `skippedDates`. Editar la entrada modifica TODA la serie (no por
 * instancia).
 *
 * Borrado logico via `deletedAt` (tombstone), igual patron que
 * `SavedSession`: el item sigue en el array para que el merge LWW lo
 * propague entre dispositivos antes de purgarse a los 30 dias.
 */

interface PlannedEventBase {
  /** UUID v4. Estable a lo largo del ciclo de vida del item. */
  id: string;
  /**
   * Fecha de inicio en formato `YYYY-MM-DD` (zona horaria local).
   *
   * Para eventos puntuales: la unica fecha en la que aparece la entrada.
   * Para eventos recurrentes: el primer dia desde el que se generan
   * instancias. Las instancias previas a esta fecha nunca se generan.
   */
  date: string;
  /**
   * Si es null, la entrada es puntual (aparece solo en `date`). Si tiene
   * valor, se repite cada semana en los dias indicados (0=domingo,
   * 6=sabado, siguiendo `Date.prototype.getDay()`). Sin fecha de fin.
   */
  recurrence: { daysOfWeek: number[] } | null;
  /**
   * Fechas (`YYYY-MM-DD`) excluidas de una serie recurrente. Solo aplica
   * a entradas con `recurrence !== null`. Permite saltar una semana sin
   * borrar la serie entera.
   */
  skippedDates: string[];
  /** Notas libres del usuario para la entrada. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * ISO timestamp de borrado logico. Cuando esta presente, el item es un
   * tombstone: la UI lo oculta pero el merge sigue propagandolo a otros
   * dispositivos hasta que expire.
   */
  deletedAt?: string;
}

/**
 * Entrada de tipo indoor. Referencia a una `SavedSession` por id.
 *
 * Si la sesion referenciada se borra (sync de otro device), la UI muestra
 * la entrada con un mensaje "Sesion borrada" y opcion de editar/eliminar.
 */
export interface PlannedIndoorEvent extends PlannedEventBase {
  type: 'indoor';
  savedSessionId: string;
}

/**
 * Entrada de tipo outdoor. Solo metadata: nombre + URL externa opcional.
 * El GPX no se persiste — el usuario lo subira el dia del entrenamiento
 * desde Strava/Komoot/RideWithGPS.
 */
export interface PlannedOutdoorEvent extends PlannedEventBase {
  type: 'outdoor';
  /** Nombre humano de la ruta. Ej "Vuelta al pantano". */
  name: string;
  /** Enlace opcional a la ruta en Strava/Komoot/RideWithGPS. */
  externalUrl?: string;
}

export type PlannedEvent = PlannedIndoorEvent | PlannedOutdoorEvent;

/**
 * Resolucion de una entrada en una fecha concreta. La distincion entre
 * `event.date` y `date` importa para entradas recurrentes: una serie con
 * `event.date = '2026-05-01'` puede generar instancias en `'2026-05-05'`,
 * `'2026-05-12'`, etc., y cada una es un `EventInstance` distinto.
 */
export interface EventInstance {
  event: PlannedEvent;
  /** Fecha resuelta `YYYY-MM-DD` en la que aparece esta instancia. */
  date: string;
  /** True si proviene de una serie recurrente, false si es la unica de un evento puntual. */
  isRecurringInstance: boolean;
}
