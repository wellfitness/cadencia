import { useState } from 'react';
import type { EditableSessionPlan } from '@core/segmentation';
import { createSavedSession } from '@core/sessions/saved';
import { MaterialIcon } from '../MaterialIcon';

interface Props {
  plan: EditableSessionPlan;
  onClose: () => void;
  onSaved: (id: string) => void;
}

/**
 * Modal "Guardar como mi sesion": nombre + descripcion opcional.
 * Tras guardar, la sesion aparece en el tab "Mis sesiones" del
 * TemplateGallery del paso Plan.
 */
export function SaveSessionDialog({ plan, onClose, onSaved }: Props): JSX.Element {
  const [name, setName] = useState<string>(plan.name);
  const [description, setDescription] = useState<string>('');
  const canSave = name.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) return;
    const desc = description.trim();
    const created = createSavedSession({
      name: name.trim(),
      ...(desc.length > 0 ? { description: desc } : {}),
      plan,
    });
    onSaved(created.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-session-title"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-md w-full space-y-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="save-session-title"
            className="font-display text-xl text-gris-800 flex items-center gap-2"
          >
            <MaterialIcon name="bookmark_add" size="small" className="text-turquesa-600" />
            Guardar como mi sesión
          </h2>
        </div>
        <p className="text-sm text-gris-600">
          Le pones nombre y la tendrás en el tab <strong>Mis sesiones</strong> del paso Plan
          para reutilizarla cuando quieras.
        </p>
        <label className="block">
          <span className="text-sm text-gris-700 font-medium">Nombre</span>
          <input
            ref={(el) => el?.focus()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border-2 border-gris-300 px-3 py-2 focus:border-turquesa-500 focus:outline-none"
            placeholder="Mi Noruego de los martes"
            maxLength={80}
          />
        </label>
        <label className="block">
          <span className="text-sm text-gris-700 font-medium">
            Descripción <span className="text-gris-500 font-normal">(opcional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border-2 border-gris-300 px-3 py-2 focus:border-turquesa-500 focus:outline-none"
            rows={2}
            maxLength={200}
            placeholder="¿Para qué la usas? ¿Qué la hace especial?"
          />
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 min-h-[44px] text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-md bg-turquesa-600 text-white hover:bg-turquesa-700 disabled:opacity-50 min-h-[44px] text-sm font-medium"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
