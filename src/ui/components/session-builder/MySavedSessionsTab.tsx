import { useEffect, useState } from 'react';
import { listSavedSessions, deleteSavedSession } from '@core/sessions/saved';
import { calculateTotalDurationSec, type EditableSessionPlan } from '@core/segmentation';
import type { SavedSession } from '@core/sync/types';
import { MaterialIcon } from '../MaterialIcon';

interface Props {
  onLoad: (plan: EditableSessionPlan) => void;
}

/**
 * Tab "Mis sesiones": lista de planes guardados por el usuario, ordenados
 * por updatedAt desc. Cada item con botones "Cargar" y "Borrar". Si no
 * hay sesiones guardadas, mensaje guia.
 *
 * Re-render automatico tras cambios en cadenciaStore (otros dispositivos
 * via sync, o crear/borrar en este mismo dispositivo).
 */
export function MySavedSessionsTab({ onLoad }: Props): JSX.Element {
  const [sessions, setSessions] = useState<SavedSession[]>(() => listSavedSessions());

  useEffect(() => {
    const handler = (): void => setSessions(listSavedSessions());
    window.addEventListener('cadencia-data-saved', handler);
    return () => window.removeEventListener('cadencia-data-saved', handler);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="text-center text-gris-600 py-8 px-4 rounded-lg border border-dashed border-gris-300 bg-gris-50">
        <MaterialIcon name="bookmark" size="large" className="text-gris-400 mb-2" />
        <p className="text-sm">No tienes sesiones guardadas todavía.</p>
        <p className="text-xs mt-2 text-gris-500">
          Construye una sesión y pulsa <strong>"Guardar como mi sesión"</strong> para
          reusarla luego.
        </p>
      </div>
    );
  }

  const handleDelete = (id: string, name: string): void => {
    if (!window.confirm(`¿Borrar "${name}"? Esta acción no se puede deshacer.`)) return;
    deleteSavedSession(id);
    setSessions(listSavedSessions());
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
      {sessions.map((s) => {
        const totalSec = calculateTotalDurationSec(s.plan);
        const totalMin = Math.round(totalSec / 60);
        return (
          <div
            key={s.id}
            className="rounded-lg border-2 border-gris-200 p-3 bg-white hover:border-turquesa-400 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-display text-sm md:text-base text-gris-800 leading-tight">
                {s.name}
              </h4>
              <span className="text-[11px] text-gris-500 tabular-nums whitespace-nowrap">
                ≈ {totalMin} min
              </span>
            </div>
            {s.description !== undefined && s.description.length > 0 && (
              <p className="text-xs text-gris-600 mb-1.5 line-clamp-2">{s.description}</p>
            )}
            <p className="text-[11px] text-gris-500 mb-2">
              Guardada {new Date(s.createdAt).toLocaleDateString('es-ES')}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onLoad(s.plan)}
                className="flex-1 px-3 py-1.5 rounded-md bg-turquesa-600 text-white text-xs font-medium hover:bg-turquesa-700 min-h-[44px]"
              >
                Cargar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.id, s.name)}
                aria-label={`Borrar sesión ${s.name}`}
                className="px-3 py-1.5 rounded-md border border-gris-300 text-gris-600 hover:bg-rosa-50 hover:border-rosa-300 hover:text-rosa-700 min-h-[44px]"
              >
                <MaterialIcon name="delete_outline" size="small" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
