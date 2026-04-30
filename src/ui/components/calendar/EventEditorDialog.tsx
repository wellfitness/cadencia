import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { MaterialIcon } from '../MaterialIcon';
import {
  createPlannedEvent,
  updatePlannedEvent,
  deletePlannedEvent,
} from '@core/calendar';
import type { PlannedEvent } from '@core/calendar';
import { listSavedSessions } from '@core/sessions/saved';
import type { SavedSession } from '@core/sync/types';
import { navigateInApp } from '@ui/utils/navigation';

export interface EventEditorDialogProps {
  open: boolean;
  /** Si se pasa un evento, modo edicion. Si null, modo creacion. */
  event: PlannedEvent | null;
  /** Fecha inicial (YYYY-MM-DD) cuando es modo creacion. Default = hoy local. */
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_ARIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Modal para crear o editar una entrada del calendario.
 *
 * Modo creacion: `event === null`. Mostramos selector de tipo (indoor /
 * outdoor) y los campos correspondientes. El selector de tipo se oculta
 * tras la primera eleccion del usuario (no cambia tras crear).
 *
 * Modo edicion: `event !== null`. El tipo es inmutable; si el usuario
 * quiere cambiar de indoor a outdoor o viceversa, debe borrar y crear.
 */
export function EventEditorDialog({
  open,
  event,
  initialDate,
  onClose,
  onSaved,
}: EventEditorDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEdit = event !== null;

  // --- Form state ---
  const [type, setType] = useState<'indoor' | 'outdoor'>(
    event?.type ?? 'indoor',
  );
  const [date, setDate] = useState<string>(
    event?.date ?? initialDate ?? todayLocalISO(),
  );
  const [notes, setNotes] = useState<string>(event?.notes ?? '');
  // Indoor:
  const [savedSessionId, setSavedSessionId] = useState<string>(
    event !== null && event.type === 'indoor' ? event.savedSessionId : '',
  );
  // Outdoor:
  const [name, setName] = useState<string>(
    event !== null && event.type === 'outdoor' ? event.name : '',
  );
  const [externalUrl, setExternalUrl] = useState<string>(
    event !== null && event.type === 'outdoor' ? (event.externalUrl ?? '') : '',
  );
  // Recurrencia:
  const [recurrent, setRecurrent] = useState<boolean>(event?.recurrence !== null && event !== null);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    event?.recurrence?.daysOfWeek ?? [],
  );

  // Sesiones disponibles (refrescamos en cada open por si el usuario creo
  // una desde otra pestana via sync).
  const [sessions, setSessions] = useState<SavedSession[]>(() => listSavedSessions());

  // Reset form al abrir/cerrar y cuando cambia event.
  useEffect(() => {
    if (!open) return;
    setSessions(listSavedSessions());
    if (event !== null) {
      setType(event.type);
      setDate(event.date);
      setNotes(event.notes ?? '');
      if (event.type === 'indoor') {
        setSavedSessionId(event.savedSessionId);
        setName('');
        setExternalUrl('');
      } else {
        setName(event.name);
        setExternalUrl(event.externalUrl ?? '');
        setSavedSessionId('');
      }
      setRecurrent(event.recurrence !== null);
      setDaysOfWeek(event.recurrence?.daysOfWeek ?? []);
    } else {
      setType('indoor');
      setDate(initialDate ?? todayLocalISO());
      setNotes('');
      setSavedSessionId('');
      setName('');
      setExternalUrl('');
      setRecurrent(false);
      setDaysOfWeek([]);
    }
  }, [open, event, initialDate]);

  // Sync prop `open` con dialog nativo.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
      onClose();
    };
    node.addEventListener('cancel', handleCancel);
    return () => node.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  function toggleDay(d: number): void {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  function handleSave(): void {
    const recurrence = recurrent && daysOfWeek.length > 0 ? { daysOfWeek } : null;

    if (isEdit && event !== null) {
      const patch: Parameters<typeof updatePlannedEvent>[1] = {
        date,
        recurrence,
      };
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > 0) patch.notes = trimmedNotes;
      if (event.type === 'indoor') {
        patch.savedSessionId = savedSessionId;
      } else {
        patch.name = name.trim();
        const trimmedUrl = externalUrl.trim();
        if (trimmedUrl.length > 0) patch.externalUrl = trimmedUrl;
      }
      updatePlannedEvent(event.id, patch);
    } else if (type === 'indoor') {
      createPlannedEvent({
        type: 'indoor',
        date,
        savedSessionId,
        recurrence,
        ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
      });
    } else {
      createPlannedEvent({
        type: 'outdoor',
        date,
        name: name.trim(),
        recurrence,
        ...(externalUrl.trim().length > 0 ? { externalUrl: externalUrl.trim() } : {}),
        ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
      });
    }
    onSaved();
  }

  function handleDelete(): void {
    if (event === null) return;
    if (!window.confirm('¿Borrar esta entrada del calendario? La acción no se puede deshacer.'))
      return;
    deletePlannedEvent(event.id);
    onSaved();
  }

  const canSave =
    type === 'indoor'
      ? savedSessionId.length > 0
      : name.trim().length > 0;

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="rounded-xl border border-gris-200 bg-white p-0 shadow-xl backdrop:bg-gris-900/40 max-w-md w-[calc(100%-2rem)]"
      aria-labelledby="cal-editor-title"
    >
      <div className="p-5 md:p-6 space-y-4">
        <h3
          id="cal-editor-title"
          className="text-base md:text-lg font-display font-bold text-gris-800"
        >
          {isEdit ? 'Editar entrada' : 'Nueva entrada'}
        </h3>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('indoor')}
              className={`px-3 py-2.5 rounded-md border-2 text-sm font-medium min-h-[44px] transition-colors ${
                type === 'indoor'
                  ? 'border-turquesa-600 bg-turquesa-50 text-turquesa-700'
                  : 'border-gris-200 text-gris-700 hover:border-turquesa-400'
              }`}
              aria-pressed={type === 'indoor'}
            >
              <MaterialIcon name="directions_bike" size="small" className="mr-1.5" />
              Sesión indoor
            </button>
            <button
              type="button"
              onClick={() => setType('outdoor')}
              className={`px-3 py-2.5 rounded-md border-2 text-sm font-medium min-h-[44px] transition-colors ${
                type === 'outdoor'
                  ? 'border-turquesa-600 bg-turquesa-50 text-turquesa-700'
                  : 'border-gris-200 text-gris-700 hover:border-turquesa-400'
              }`}
              aria-pressed={type === 'outdoor'}
            >
              <MaterialIcon name="map" size="small" className="mr-1.5" />
              Ruta outdoor
            </button>
          </div>
        )}

        {type === 'indoor' ? (
          <div>
            <label className="block text-sm font-semibold text-gris-700 mb-1">
              Sesión guardada
            </label>
            {sessions.length === 0 ? (
              <div className="rounded-md border border-dashed border-gris-300 bg-gris-50 p-3 text-sm text-gris-600">
                No tienes sesiones guardadas todavía.{' '}
                <a
                  href="/preferencias"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateInApp('/preferencias');
                  }}
                  className="text-turquesa-700 underline font-medium"
                >
                  Crear o gestionar sesiones
                </a>
              </div>
            ) : (
              <select
                value={savedSessionId}
                onChange={(e) => setSavedSessionId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border-2 border-gris-200 bg-white text-sm min-h-[44px] focus:border-turquesa-500 focus:outline-none"
              >
                <option value="">— Elige una sesión —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-semibold text-gris-700 mb-1">
                Nombre de la ruta
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Vuelta al pantano"
                className="w-full px-3 py-2.5 rounded-md border-2 border-gris-200 text-sm min-h-[44px] focus:border-turquesa-500 focus:outline-none"
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gris-700 mb-1">
                Enlace externo (opcional)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://strava.com/routes/..."
                className="w-full px-3 py-2.5 rounded-md border-2 border-gris-200 text-sm min-h-[44px] focus:border-turquesa-500 focus:outline-none"
              />
              <p className="text-xs text-gris-500 mt-1">
                Strava, Komoot, RideWithGPS, etc. Lo abrirás el día del entrenamiento.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-semibold text-gris-700 mb-1">
            Fecha {recurrent && <span className="text-xs text-gris-500">(inicio de la serie)</span>}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border-2 border-gris-200 text-sm min-h-[44px] focus:border-turquesa-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gris-700 cursor-pointer">
            <input
              type="checkbox"
              checked={recurrent}
              onChange={(e) => setRecurrent(e.target.checked)}
              className="w-4 h-4 accent-turquesa-600"
            />
            Repetir cada semana
          </label>
          {recurrent && (
            <div className="mt-2 flex gap-1 flex-wrap" role="group" aria-label="Días de la semana">
              {DAY_LABELS.map((label, idx) => {
                const active = daysOfWeek.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    aria-pressed={active}
                    aria-label={DAY_ARIA[idx]}
                    className={`w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-turquesa-600 bg-turquesa-600 text-white'
                        : 'border-gris-200 bg-white text-gris-700 hover:border-turquesa-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gris-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cualquier detalle: ritmo objetivo, ruta alternativa..."
            rows={2}
            className="w-full px-3 py-2 rounded-md border-2 border-gris-200 text-sm focus:border-turquesa-500 focus:outline-none resize-none"
            maxLength={500}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2">
          {isEdit && (
            <Button
              variant="critical"
              onClick={handleDelete}
              iconLeft="delete_outline"
              fullWidth
              className="sm:w-auto sm:mr-auto"
            >
              Borrar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} fullWidth className="sm:w-auto">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!canSave || (recurrent && daysOfWeek.length === 0)}
            fullWidth
            className="sm:w-auto"
          >
            Guardar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
