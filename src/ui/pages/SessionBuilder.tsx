import { useCallback, useMemo, useReducer, useState } from 'react';
import {
  buildSessionRouteMeta,
  calculateTotalDurationSec,
  classifySessionPlan,
  expandSessionPlan,
  validateSessionPlan,
  type ClassifiedSegment,
  type EditableSessionPlan,
  type RouteMeta,
  type SessionBlock,
  type SessionItem,
  type SessionTemplate,
} from '@core/segmentation';
import type { ValidatedUserInputs } from '@core/user/userInputs';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { ZoneTimelineChart } from '@ui/components/ZoneTimelineChart';
import { BlockList } from '@ui/components/session-builder/BlockList';
import { TemplateGallery } from '@ui/components/session-builder/TemplateGallery';

export interface SessionBuilderProps {
  validatedInputs: ValidatedUserInputs;
  /** Plan inicial restaurado de sessionStorage si existia. */
  initialPlan?: EditableSessionPlan | undefined;
  onProcessed: (
    segments: ClassifiedSegment[],
    meta: RouteMeta,
    plan: EditableSessionPlan,
  ) => void;
  onChange: (plan: EditableSessionPlan) => void;
  onBack: () => void;
  onNext: () => void;
}

interface BuilderState {
  plan: EditableSessionPlan;
  /** ID de la plantilla cargada (null si vacio o editada manualmente desde cero). */
  activeTemplateId: string | null;
  /** Contador autoincremental para generar IDs unicos en bloques nuevos. */
  nextId: number;
}

type BuilderAction =
  | { type: 'loadTemplate'; template: SessionTemplate }
  | { type: 'startFromScratch' }
  | { type: 'setItems'; items: SessionItem[] }
  | { type: 'addBlock' }
  | { type: 'setName'; name: string };

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'loadTemplate': {
      // Clona la estructura para que las ediciones no muten la constante de plantillas
      const items: SessionItem[] = action.template.items.map((it) => cloneItem(it));
      return {
        plan: { name: action.template.name, items },
        activeTemplateId: action.template.id,
        nextId: state.nextId,
      };
    }
    case 'startFromScratch':
      return {
        plan: { name: defaultName(), items: [] },
        activeTemplateId: null,
        nextId: state.nextId,
      };
    case 'setItems':
      return {
        ...state,
        plan: { ...state.plan, items: action.items },
        // Tras editar, ya no resaltamos la plantilla original (puede haber divergido)
        activeTemplateId: null,
      };
    case 'addBlock': {
      const id = `b${state.nextId}`;
      const newBlock: SessionBlock = {
        id,
        phase: 'work',
        zone: 3,
        durationSec: 60,
      };
      const newItem: SessionItem = { type: 'block', block: newBlock };
      return {
        ...state,
        plan: { ...state.plan, items: [...state.plan.items, newItem] },
        activeTemplateId: null,
        nextId: state.nextId + 1,
      };
    }
    case 'setName':
      return { ...state, plan: { ...state.plan, name: action.name } };
  }
}

function cloneItem(item: SessionItem): SessionItem {
  if (item.type === 'block') {
    return { type: 'block', block: { ...item.block } };
  }
  return {
    type: 'group',
    id: item.id,
    repeat: item.repeat,
    blocks: item.blocks.map((b) => ({ ...b })),
  };
}

function defaultName(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('es-ES', { month: 'short' });
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Sesión indoor — ${day} ${month}, ${time}`;
}

/**
 * Constructor visual de sesiones indoor cycling. Permite cargar una de las
 * 4 plantillas o empezar desde cero, editar bloques y grupos × N, y al
 * pulsar "Continuar" convierte el plan editable en ClassifiedSegment[] +
 * RouteMeta para alimentar el motor de matching.
 */
export function SessionBuilder({
  validatedInputs,
  initialPlan,
  onProcessed,
  onChange,
  onBack,
  onNext,
}: SessionBuilderProps): JSX.Element {
  const [state, dispatch] = useReducer(
    reducer,
    initialPlan,
    (init): BuilderState => ({
      plan: init ?? { name: defaultName(), items: [] },
      activeTemplateId: null,
      nextId: 1,
    }),
  );
  const [error, setError] = useState<string | null>(null);

  // Notifica al padre cada cambio del plan (debounced en App via persistencia)
  const handleItemsChange = useCallback(
    (items: SessionItem[]): void => {
      const nextPlan = { ...state.plan, items };
      dispatch({ type: 'setItems', items });
      onChange(nextPlan);
    },
    [state.plan, onChange],
  );

  const handleLoadTemplate = useCallback(
    (template: SessionTemplate): void => {
      dispatch({ type: 'loadTemplate', template });
      onChange({
        name: template.name,
        items: template.items.map((it) => cloneItem(it)),
      });
      setError(null);
    },
    [onChange],
  );

  const handleStartFromScratch = useCallback((): void => {
    dispatch({ type: 'startFromScratch' });
    onChange({ name: defaultName(), items: [] });
    setError(null);
  }, [onChange]);

  const handleAddBlock = useCallback((): void => {
    dispatch({ type: 'addBlock' });
    setError(null);
  }, []);

  const handleNameChange = useCallback(
    (name: string): void => {
      dispatch({ type: 'setName', name });
      onChange({ ...state.plan, name });
    },
    [state.plan, onChange],
  );

  const expandedBlocks = useMemo(() => expandSessionPlan(state.plan).blocks, [state.plan]);
  const totalDurationSec = useMemo(() => calculateTotalDurationSec(state.plan), [state.plan]);
  const totalMinutes = Math.round(totalDurationSec / 60);

  const handleContinue = useCallback((): void => {
    const validation = validateSessionPlan(state.plan);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    const expanded = expandSessionPlan(state.plan);
    const segments = classifySessionPlan(expanded, validatedInputs);
    if (segments.length === 0) {
      setError('La sesión no genera ningún segmento. Revisa las duraciones.');
      return;
    }
    const meta = buildSessionRouteMeta(expanded, segments);
    onProcessed(segments, meta, state.plan);
    onNext();
  }, [state.plan, validatedInputs, onProcessed, onNext]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10 space-y-4 md:space-y-6 pb-32 md:pb-10">
      <Card title="Tu sesión indoor" titleIcon="fitness_center">
        <label className="block mb-4">
          <span className="text-xs font-semibold text-gris-700 mb-1 block">Nombre de la sesión</span>
          <input
            type="text"
            value={state.plan.name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={80}
            className="w-full rounded-md border-2 border-gris-300 bg-white px-3 py-2 text-base focus:border-turquesa-500 focus:outline-none min-h-[44px]"
          />
        </label>

        <TemplateGallery
          activeTemplateId={state.activeTemplateId}
          onSelect={handleLoadTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      </Card>

      <Card title="Bloques de la sesión" titleIcon="view_list">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gris-600">
            <strong className="text-gris-800 tabular-nums">{totalMinutes}</strong> min totales,{' '}
            <strong className="text-gris-800 tabular-nums">{expandedBlocks.length}</strong>{' '}
            {expandedBlocks.length === 1 ? 'bloque' : 'bloques'} expandidos
          </p>
          <Button variant="secondary" size="sm" iconLeft="add" onClick={handleAddBlock}>
            Añadir bloque
          </Button>
        </div>

        <BlockList items={state.plan.items} onItemsChange={handleItemsChange} />

        {error !== null && (
          <p
            role="alert"
            className="mt-3 text-sm text-error font-medium flex items-center gap-2"
          >
            <MaterialIcon name="error_outline" size="small" className="text-error" />
            {error}
          </p>
        )}
      </Card>

      {expandedBlocks.length > 0 && (
        <Card title="Vista previa" titleIcon="timeline">
          <ZoneTimelineChart blocks={expandedBlocks} />
        </Card>
      )}

      <FooterActions
        onBack={onBack}
        onContinue={handleContinue}
        canContinue={expandedBlocks.length > 0}
      />
    </div>
  );
}

interface FooterActionsProps {
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}

function FooterActions({ onBack, onContinue, canContinue }: FooterActionsProps): JSX.Element {
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 py-3 flex items-center justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={!canContinue}
          onClick={onContinue}
          fullWidth
        >
          Siguiente: Música
        </Button>
      </div>
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Siguiente: Música
        </Button>
      </div>
    </>
  );
}
