import { useState, type DragEvent } from 'react';
import type { KarvonenZoneRange, PowerZoneRange } from '@core/physiology';
import type { CadenceProfile, SessionBlock, SessionItem } from '@core/segmentation';
import { MaterialIcon } from '../MaterialIcon';
import { ZoneBadge } from '../ZoneBadge';
import { BlockEditor } from './BlockEditor';
import { RepeatGroup } from './RepeatGroup';
import { formatBpmRange, formatWattsRange } from './zoneRangeFormat';

/**
 * Bandas de FC y vatios precalculadas a partir de los inputs validados del
 * usuario. Cada slot es opcional: solo se rellena si el usuario tiene datos
 * suficientes (Karvonen exige FC max + reposo; Coggan exige FTP).
 */
export interface PhysioContext {
  karvonen: readonly KarvonenZoneRange[] | null;
  power: readonly PowerZoneRange[] | null;
}

export interface BlockListProps {
  items: readonly SessionItem[];
  onItemsChange: (next: SessionItem[]) => void;
  /** CTA del empty state: cargar plantilla SIT (rapida y representativa). */
  onLoadSitTemplate?: () => void;
  /** CTA del empty state: empezar desde cero (anyade un bloque vacio). */
  onStartFromScratch?: () => void;
  /** Bandas bpm/W del usuario. Si se pasan, cada bloque muestra el rango de su zona. */
  physioContext?: PhysioContext;
}

const PHASE_ICONS: Record<string, string> = {
  warmup: 'whatshot',
  work: 'fitness_center',
  recovery: 'self_improvement',
  rest: 'pause_circle',
  cooldown: 'ac_unit',
  main: 'directions_bike',
};

const PHASE_LABELS: Record<string, string> = {
  warmup: 'Calentamiento',
  work: 'Trabajo',
  recovery: 'Recuperación',
  rest: 'Descanso',
  cooldown: 'Vuelta a la calma',
  main: 'Principal',
};

const CADENCE_PROFILE_LABELS: Record<CadenceProfile, string> = {
  flat: 'Llano',
  climb: 'Escalada',
  sprint: 'Sprint',
};

/**
 * Lista de items del plan editable. Cada item es un bloque suelto o un
 * grupo con repeticiones × N. Soporta editar inline, reordenar con flechas
 * y eliminar.
 *
 * El editor en linea identifica el bloque a editar por una clave compuesta
 * `${itemIndex}-${blockId}` para distinguir bloques dentro de grupos.
 */
export function BlockList({
  items,
  onItemsChange,
  onLoadSitTemplate,
  onStartFromScratch,
  physioContext,
}: BlockListProps): JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Drag&drop nativo: el indice arrastrado vive en estado para poder hacer
  // un swap simple al soltar. En mobile las flechas siguen siendo el camino
  // principal (drag nativo en touch es inconsistente entre navegadores).
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const editKey = (itemIndex: number, blockId: string): string => `${itemIndex}-${blockId}`;

  const updateItem = (index: number, next: SessionItem): void => {
    const updated = items.map((item, i) => (i === index ? next : item));
    onItemsChange(updated);
  };

  const removeItem = (index: number): void => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    onItemsChange(next);
  };

  /** Reordena moviendo el item de `from` justo antes de `to` (o al final). */
  const reorderItem = (from: number, to: number): void => {
    if (from === to || from < 0 || from >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    const target = to > from ? to - 1 : to;
    next.splice(target, 0, moved);
    onItemsChange(next);
  };

  const handleSaveEdit = (itemIndex: number, blockIndex: number | null) => (block: SessionBlock): void => {
    const item = items[itemIndex];
    if (item === undefined) return;
    if (item.type === 'block') {
      updateItem(itemIndex, { type: 'block', block });
    } else {
      // Edicion de bloque dentro de un grupo
      if (blockIndex === null) return;
      const updatedBlocks = item.blocks.map((b, i) => (i === blockIndex ? block : b));
      updateItem(itemIndex, { ...item, blocks: updatedBlocks });
    }
    setEditingKey(null);
  };

  const handleRepeatChange = (itemIndex: number) => (next: number): void => {
    const item = items[itemIndex];
    if (item === undefined || item.type !== 'group') return;
    updateItem(itemIndex, { ...item, repeat: next });
  };

  const handleUngroup = (itemIndex: number) => (): void => {
    const item = items[itemIndex];
    if (item === undefined || item.type !== 'group') return;
    // Sustituye el grupo por sus bloques sueltos
    const blockItems: SessionItem[] = item.blocks.map((b) => ({ type: 'block', block: b }));
    const next = [...items.slice(0, itemIndex), ...blockItems, ...items.slice(itemIndex + 1)];
    onItemsChange(next);
  };

  const removeBlockFromGroup = (itemIndex: number, blockIndex: number): void => {
    const item = items[itemIndex];
    if (item === undefined || item.type !== 'group') return;
    const updatedBlocks = item.blocks.filter((_, i) => i !== blockIndex);
    if (updatedBlocks.length === 0) {
      // Si vacia el grupo, elimina el grupo entero
      removeItem(itemIndex);
    } else {
      updateItem(itemIndex, { ...item, blocks: updatedBlocks });
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gris-300 bg-gris-50 p-6 md:p-8 text-center">
        <SessionDiagram />
        <p className="mt-3 text-sm text-gris-700 font-medium">
          Tu sesión está vacía
        </p>
        <p className="text-xs text-gris-500 mt-1 max-w-sm mx-auto">
          Empieza con una plantilla científica probada o construye tu propia
          secuencia desde cero.
        </p>
        {(onLoadSitTemplate !== undefined || onStartFromScratch !== undefined) && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            {onLoadSitTemplate !== undefined && (
              <button
                type="button"
                onClick={onLoadSitTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-turquesa-600 text-white border-2 border-turquesa-700 hover:bg-turquesa-700 px-4 py-2 text-sm font-semibold min-h-[40px] transition-colors"
              >
                <MaterialIcon name="bolt" size="small" />
                Cargar plantilla SIT
              </button>
            )}
            {onStartFromScratch !== undefined && (
              <button
                type="button"
                onClick={onStartFromScratch}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-gris-700 border-2 border-gris-300 hover:border-gris-400 px-4 py-2 text-sm font-semibold min-h-[40px] transition-colors"
              >
                <MaterialIcon name="add" size="small" />
                Empezar desde cero
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const dragProps = (itemIndex: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLLIElement>) => {
      setDraggingIndex(itemIndex);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: DragEvent<HTMLLIElement>) => {
      if (draggingIndex === null || draggingIndex === itemIndex) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDrop: (e: DragEvent<HTMLLIElement>) => {
      if (draggingIndex === null || draggingIndex === itemIndex) {
        setDraggingIndex(null);
        return;
      }
      e.preventDefault();
      reorderItem(draggingIndex, itemIndex);
      setDraggingIndex(null);
    },
    onDragEnd: () => setDraggingIndex(null),
  });

  return (
    <ul className="space-y-2 md:space-y-2.5">
      {items.map((item, itemIndex) => {
        const canMoveUp = itemIndex > 0;
        const canMoveDown = itemIndex < items.length - 1;
        const isDragSource = draggingIndex === itemIndex;
        const dragVisual = isDragSource ? 'opacity-40' : 'group';

        if (item.type === 'block') {
          const block = item.block;
          const isEditing = editingKey === editKey(itemIndex, block.id);
          if (isEditing) {
            return (
              <li key={block.id}>
                <BlockEditor
                  block={block}
                  onSave={handleSaveEdit(itemIndex, null)}
                  onCancel={() => setEditingKey(null)}
                  {...(physioContext !== undefined ? { physioContext } : {})}
                />
              </li>
            );
          }
          return (
            <li key={block.id} className={dragVisual} {...dragProps(itemIndex)}>
              <BlockRow
                block={block}
                onEdit={() => setEditingKey(editKey(itemIndex, block.id))}
                onRemove={() => removeItem(itemIndex)}
                {...(canMoveUp ? { onMoveUp: () => moveItem(itemIndex, -1) } : {})}
                {...(canMoveDown ? { onMoveDown: () => moveItem(itemIndex, 1) } : {})}
                showDragHandle
                {...(physioContext !== undefined ? { physioContext } : {})}
              />
            </li>
          );
        }

        // Grupo
        const groupExpandedSec =
          item.blocks.reduce((acc, b) => acc + b.durationSec, 0) * Math.max(1, item.repeat);
        return (
          <li key={item.id} className={dragVisual} {...dragProps(itemIndex)}>
            <div className="flex items-stretch gap-2">
              <div className="flex flex-col items-center gap-1 pt-2">
                <button
                  type="button"
                  onClick={canMoveUp ? () => moveItem(itemIndex, -1) : undefined}
                  disabled={!canMoveUp}
                  aria-label="Mover grupo arriba"
                  className="w-7 h-7 rounded-md border border-gris-300 bg-white text-gris-600 hover:bg-gris-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <MaterialIcon name="arrow_upward" size="small" />
                </button>
                <button
                  type="button"
                  onClick={canMoveDown ? () => moveItem(itemIndex, 1) : undefined}
                  disabled={!canMoveDown}
                  aria-label="Mover grupo abajo"
                  className="w-7 h-7 rounded-md border border-gris-300 bg-white text-gris-600 hover:bg-gris-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <MaterialIcon name="arrow_downward" size="small" />
                </button>
              </div>
              <RepeatGroup
                repeat={item.repeat}
                onRepeatChange={handleRepeatChange(itemIndex)}
                onUngroup={handleUngroup(itemIndex)}
                onRemove={() => removeItem(itemIndex)}
                expandedDurationSec={groupExpandedSec}
                className="flex-1 min-w-0"
              >
                {item.blocks.map((block, blockIndex) => {
                  const isEditing = editingKey === editKey(itemIndex, block.id);
                  if (isEditing) {
                    return (
                      <BlockEditor
                        key={block.id}
                        block={block}
                        onSave={handleSaveEdit(itemIndex, blockIndex)}
                        onCancel={() => setEditingKey(null)}
                        {...(physioContext !== undefined ? { physioContext } : {})}
                      />
                    );
                  }
                  return (
                    <BlockRow
                      key={block.id}
                      block={block}
                      onEdit={() => setEditingKey(editKey(itemIndex, block.id))}
                      onRemove={() => removeBlockFromGroup(itemIndex, blockIndex)}
                      compact
                      {...(physioContext !== undefined ? { physioContext } : {})}
                    />
                  );
                })}
              </RepeatGroup>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface BlockRowProps {
  block: SessionBlock;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  compact?: boolean;
  /** Muestra el handle de drag (solo desktop, hover-visible). */
  showDragHandle?: boolean;
  physioContext?: PhysioContext;
}

function BlockRow({
  block,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  compact = false,
  showDragHandle = false,
  physioContext,
}: BlockRowProps): JSX.Element {
  const bpm = formatBpmRange(block.zone, physioContext?.karvonen ?? null);
  const watts = formatWattsRange(block.zone, physioContext?.power ?? null);
  const hasRange = bpm !== null || watts !== null;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 ${
        compact ? 'border-gris-200' : 'border-gris-300 shadow-sm'
      }`}
    >
      {showDragHandle && (
        <span
          aria-hidden
          title="Arrastra para reordenar"
          className="hidden md:flex items-center text-gris-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <MaterialIcon name="drag_indicator" size="small" />
        </span>
      )}
      {!compact && (
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={onMoveUp === undefined}
            aria-label="Mover arriba"
            className="w-6 h-6 rounded text-gris-500 hover:bg-gris-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <MaterialIcon name="arrow_upward" size="small" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={onMoveDown === undefined}
            aria-label="Mover abajo"
            className="w-6 h-6 rounded text-gris-500 hover:bg-gris-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <MaterialIcon name="arrow_downward" size="small" />
          </button>
        </div>
      )}

      <MaterialIcon
        name={PHASE_ICONS[block.phase] ?? 'circle'}
        size="small"
        className="text-gris-500 flex-shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ZoneBadge zone={block.zone} size="sm" />
          <span className="text-xs text-gris-500">·</span>
          <span className="text-xs font-semibold text-gris-700">
            {CADENCE_PROFILE_LABELS[block.cadenceProfile]}
          </span>
          <span className="text-sm font-semibold text-gris-800 ml-1">
            {formatDuration(block.durationSec)}
          </span>
          <span className="text-xs text-gris-500">{PHASE_LABELS[block.phase] ?? block.phase}</span>
        </div>
        {hasRange && (
          <p className="text-xs text-gris-500 mt-0.5 flex items-center gap-2 flex-wrap tabular-nums">
            {bpm !== null && (
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="monitor_heart" size="small" className="text-rosa-500" />
                {bpm}
              </span>
            )}
            {watts !== null && (
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="bolt" size="small" className="text-tulipTree-500" />
                {watts}
              </span>
            )}
          </p>
        )}
        {block.description !== undefined && (
          <p className="text-xs text-gris-500 italic truncate mt-0.5">{block.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar bloque"
          className="w-8 h-8 rounded-md text-gris-600 hover:bg-gris-100 flex items-center justify-center"
        >
          <MaterialIcon name="edit" size="small" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar bloque"
          className="w-8 h-8 rounded-md text-rosa-600 hover:bg-rosa-50 flex items-center justify-center"
        >
          <MaterialIcon name="delete" size="small" />
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (sec === 0) return `${min}'`;
  return `${min}'${sec.toString().padStart(2, '0')}"`;
}

/**
 * Mini diagrama SVG de una sesion tipo HIIT: warmup, 4 series work-recovery
 * y cooldown. Solo decorativo — usa colores de zona para ilustrar la idea.
 */
function SessionDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 40"
      preserveAspectRatio="none"
      className="mx-auto w-full max-w-xs h-10 rounded"
      role="img"
      aria-label="Diagrama de una sesión: calentamiento, intervalos work y recovery, vuelta a la calma"
    >
      <rect x="0" y="0" width="36" height="40" className="fill-zone-2" rx="2" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={42 + i * 38}
            y="0"
            width="22"
            height="40"
            className="fill-zone-5"
            rx="2"
          />
          <rect
            x={66 + i * 38}
            y="0"
            width="14"
            height="40"
            className="fill-zone-2"
            rx="2"
          />
        </g>
      ))}
      <rect x="200" y="0" width="40" height="40" className="fill-zone-1" rx="2" />
    </svg>
  );
}
