import { useCallback, useMemo, useReducer, useState } from 'react';
import { calculateKarvonenZones, calculatePowerZones } from '@core/physiology';
import {
  buildSessionRouteMeta,
  calculateTotalDurationSec,
  classifySessionPlan,
  expandSessionPlan,
  findTemplate,
  validateSessionPlan,
  type ClassifiedSegment,
  type EditableSessionPlan,
  type RouteMeta,
  type SessionBlock,
  type SessionItem,
  type SessionTemplate,
} from '@core/segmentation';
import { exportZwo, importZwo, sanitizeFilename } from '@core/sessionFormats';
import type { ValidatedUserInputs } from '@core/user/userInputs';
import { Button } from '@ui/components/Button';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';
import { navigateInApp } from '@ui/utils/navigation';
import { ZoneTimelineChart } from '@ui/components/ZoneTimelineChart';
import { BlockList, type PhysioContext } from '@ui/components/session-builder/BlockList';
import { TemplateGallery } from '@ui/components/session-builder/TemplateGallery';
import { SaveSessionDialog } from '@ui/components/session-builder/SaveSessionDialog';

export interface SessionBuilderProps {
  validatedInputs: ValidatedUserInputs;
  /** Plan inicial restaurado de sessionStorage si existia. */
  initialPlan?: EditableSessionPlan | undefined;
  /** Plantilla activa restaurada (null si edita desde cero o no hay plan). */
  initialActiveTemplateId?: string | null;
  onProcessed: (
    segments: ClassifiedSegment[],
    meta: RouteMeta,
    plan: EditableSessionPlan,
  ) => void;
  onChange: (plan: EditableSessionPlan) => void;
  /** Notifica al padre cada vez que cambia la plantilla activa para persistirla. */
  onActiveTemplateIdChange?: (id: string | null) => void;
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
  | { type: 'loadPlan'; plan: EditableSessionPlan }
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
    case 'loadPlan': {
      // Clona el plan recibido (importado de archivo) por la misma razon
      // que loadTemplate. activeTemplateId queda en null porque no
      // corresponde a ninguna de las plantillas predefinidas.
      const items: SessionItem[] = action.plan.items.map((it) => cloneItem(it));
      return {
        plan: { name: action.plan.name, items },
        activeTemplateId: null,
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
        cadenceProfile: 'flat',
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
  initialActiveTemplateId = null,
  onProcessed,
  onChange,
  onActiveTemplateIdChange,
  onBack,
  onNext,
}: SessionBuilderProps): JSX.Element {
  const [state, dispatch] = useReducer(
    reducer,
    { plan: initialPlan, templateId: initialActiveTemplateId },
    (init): BuilderState => ({
      plan: init.plan ?? { name: defaultName(), items: [] },
      activeTemplateId: init.templateId,
      nextId: 1,
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Notifica al padre cada cambio del plan (debounced en App via persistencia)
  const handleItemsChange = useCallback(
    (items: SessionItem[]): void => {
      const nextPlan = { ...state.plan, items };
      dispatch({ type: 'setItems', items });
      onChange(nextPlan);
      // Editar manualmente borra el highlight de la plantilla original.
      if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(null);
    },
    [state.plan, onChange, onActiveTemplateIdChange],
  );

  const handleLoadTemplate = useCallback(
    (template: SessionTemplate): void => {
      dispatch({ type: 'loadTemplate', template });
      onChange({
        name: template.name,
        items: template.items.map((it) => cloneItem(it)),
      });
      if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(template.id);
      setError(null);
    },
    [onChange, onActiveTemplateIdChange],
  );

  const handleStartFromScratch = useCallback((): void => {
    dispatch({ type: 'startFromScratch' });
    onChange({ name: defaultName(), items: [] });
    if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(null);
    setError(null);
  }, [onChange, onActiveTemplateIdChange]);

  /**
   * Carga una sesion guardada por el usuario (tab "Mis sesiones").
   * Distinta de handleLoadTemplate: no asigna activeTemplateId (las
   * sesiones del usuario no tienen un ID de plantilla built-in) y
   * clona el plan completo, items incluidos.
   */
  const handleLoadSavedPlan = useCallback(
    (savedPlan: EditableSessionPlan): void => {
      dispatch({
        type: 'loadTemplate',
        template: {
          id: 'user-saved' as never,
          name: savedPlan.name,
          description: '',
          items: savedPlan.items.map((it) => cloneItem(it)),
        },
      });
      onChange({
        name: savedPlan.name,
        items: savedPlan.items.map((it) => cloneItem(it)),
      });
      if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(null);
      setError(null);
    },
    [onChange, onActiveTemplateIdChange],
  );

  const [savingDialog, setSavingDialog] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const handleAddBlock = useCallback((): void => {
    dispatch({ type: 'addBlock' });
    // addBlock se considera edicion manual: limpia el highlight de plantilla.
    if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(null);
    setError(null);
  }, [onActiveTemplateIdChange]);

  // Import .zwo: lee el archivo, parsea, y carga el plan resultante. Avisos
  // de error van a `setError`; un mensaje de exito breve a `importNotice`.
  const handleImportZwo = useCallback(
    (file: File): void => {
      setError(null);
      setImportNotice(null);
      const reader = new FileReader();
      reader.onload = (): void => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const result = importZwo(text);
        if (!result.ok) {
          setError(`No se pudo importar el archivo: ${result.error}`);
          return;
        }
        dispatch({ type: 'loadPlan', plan: result.plan });
        onChange(result.plan);
        if (onActiveTemplateIdChange !== undefined) onActiveTemplateIdChange(null);
        setImportNotice(
          `Sesión "${result.plan.name}" importada. Revisa los bloques antes de continuar — ZWO no preserva si cada bloque era llano, escalada o sprint.`,
        );
      };
      reader.onerror = (): void => {
        setError('No se pudo leer el archivo.');
      };
      reader.readAsText(file);
    },
    [onChange, onActiveTemplateIdChange],
  );

  // Export .zwo: serializa el plan actual y dispara la descarga via Blob URL.
  const handleExportZwo = useCallback((): void => {
    const xml = exportZwo(state.plan);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(state.plan.name) + '.zwo';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.plan]);

  // Web Share API Level 2: ¿puede el navegador compartir un .zwo como File?
  // Doble gate:
  //   1. Soporte real de Web Share Files (probe con XML mínimo).
  //   2. Input primario táctil (`pointer: coarse`): móvil y tablet. En desktop
  //      con ratón el sheet del sistema da una UX pobre para .zwo aunque la
  //      API funcione, así que escondemos el botón y dejamos solo "Descargar".
  const canShareZwo = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    if (!window.matchMedia('(pointer: coarse)').matches) return false;
    try {
      const probe = new File(['<workout_file/>'], 'probe.zwo', {
        type: 'application/xml',
      });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }, []);

  const handleShareZwo = useCallback((): void => {
    if (!canShareZwo) return;
    const xml = exportZwo(state.plan);
    const filename = sanitizeFilename(state.plan.name) + '.zwo';
    const file = new File([xml], filename, { type: 'application/xml' });
    navigator
      .share({
        title: state.plan.name,
        text: `Sesión «${state.plan.name}» creada con Cadencia`,
        files: [file],
      })
      .catch(() => {
        // Usuario cierra el sheet o el navegador rechaza el payload:
        // no caemos a download (el botón "Descargar" sigue al lado).
      });
  }, [canShareZwo, state.plan]);

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

  // Bandas Karvonen / Coggan derivadas de los inputs validados. Se calculan
  // una sola vez por cambio en los datos del usuario y se propagan a cada
  // BlockRow para que el usuario vea bpm/W concretos al construir la sesion.
  const physioContext = useMemo<PhysioContext>(() => {
    const karvonen =
      validatedInputs.hasHeartRateZones &&
      validatedInputs.effectiveMaxHr !== null &&
      validatedInputs.restingHeartRate !== null
        ? calculateKarvonenZones(validatedInputs.effectiveMaxHr, validatedInputs.restingHeartRate)
        : null;
    const power =
      validatedInputs.ftpWatts !== null ? calculatePowerZones(validatedInputs.ftpWatts) : null;
    return { karvonen, power };
  }, [validatedInputs]);

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
    <WizardStep maxWidth="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <WizardStepHeading
          title="Construye tu sesión"
          subtitle="Parte de una plantilla científica o crea tu propia secuencia de bloques."
          className="mb-0 flex-1 min-w-0"
        />
        <a
          href="/ayuda/sesion-indoor"
          onClick={(e) => {
            e.preventDefault();
            navigateInApp('/ayuda/sesion-indoor');
          }}
          aria-label="Abrir centro de ayuda"
          title="Centro de ayuda"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full text-turquesa-600 hover:bg-turquesa-50 transition-colors"
        >
          <MaterialIcon name="help_outline" size="medium" decorative />
        </a>
      </div>
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
          onLoadSavedPlan={handleLoadSavedPlan}
          onImportFile={handleImportZwo}
        />
        {importNotice !== null && (
          <p
            role="status"
            className="mt-3 text-xs text-turquesa-800 bg-turquesa-50 border border-turquesa-200 rounded-md px-3 py-2 flex items-start gap-2"
          >
            <MaterialIcon
              name="check_circle"
              size="small"
              className="text-turquesa-600 flex-shrink-0 mt-0.5"
            />
            <span>{importNotice}</span>
          </p>
        )}
      </Card>

      <Card title="Bloques de la sesión" titleIcon="view_list">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm text-gris-600 min-w-0">
            <strong className="text-gris-800 tabular-nums">{totalMinutes}</strong> min totales,{' '}
            <strong className="text-gris-800 tabular-nums">{expandedBlocks.length}</strong>{' '}
            {expandedBlocks.length === 1 ? 'bloque' : 'bloques'} expandidos
          </p>
          <Button variant="secondary" size="sm" iconLeft="add" onClick={handleAddBlock}>
            Añadir bloque
          </Button>
        </div>

        <BlockList
          items={state.plan.items}
          onItemsChange={handleItemsChange}
          onLoadSitTemplate={() => {
            const sit = findTemplate('sit');
            if (sit !== undefined) handleLoadTemplate(sit);
          }}
          onStartFromScratch={handleAddBlock}
          physioContext={physioContext}
        />

        {error !== null && (
          <p
            role="alert"
            className="mt-3 text-sm text-rosa-600 font-medium flex items-center gap-2"
          >
            <MaterialIcon name="error_outline" size="small" className="text-rosa-600" />
            {error}
          </p>
        )}
      </Card>

      {expandedBlocks.length > 0 && (
        <Card title="Vista previa" titleIcon="timeline">
          <ZoneTimelineChart blocks={expandedBlocks} />
        </Card>
      )}

      {saveNotice !== null && (
        <p
          role="status"
          className="text-xs text-turquesa-800 bg-turquesa-50 border border-turquesa-200 rounded-md px-3 py-2 flex items-start gap-2"
        >
          <MaterialIcon
            name="check_circle"
            size="small"
            className="text-turquesa-600 flex-shrink-0 mt-0.5"
          />
          <span>{saveNotice}</span>
        </p>
      )}

      <FooterActions
        onBack={onBack}
        onContinue={handleContinue}
        canContinue={expandedBlocks.length > 0}
        canExport={expandedBlocks.length > 0}
        onExport={handleExportZwo}
        canShare={canShareZwo && expandedBlocks.length > 0}
        onShare={handleShareZwo}
        canSave={expandedBlocks.length > 0}
        onSave={() => setSavingDialog(true)}
      />

      {savingDialog && (
        <SaveSessionDialog
          plan={state.plan}
          onClose={() => setSavingDialog(false)}
          onSaved={() => {
            setSavingDialog(false);
            setSaveNotice(`«${state.plan.name}» guardada en Mis sesiones.`);
            setTimeout(() => setSaveNotice(null), 4000);
          }}
        />
      )}
    </WizardStep>
  );
}

interface FooterActionsProps {
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  canExport: boolean;
  onExport: () => void;
  canShare: boolean;
  onShare: () => void;
  canSave: boolean;
  onSave: () => void;
}

function FooterActions({
  onBack,
  onContinue,
  canContinue,
  canExport,
  onExport,
  canShare,
  onShare,
  canSave,
  onSave,
}: FooterActionsProps): JSX.Element {
  return (
    <WizardStepFooter
      mobile={
        <>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          {canSave && (
            <Button
              variant="accent"
              size="sm"
              iconLeft="bookmark_add"
              onClick={onSave}
              aria-label="Guardar como mi sesión"
              title="Guardar esta sesión para reutilizarla luego"
            />
          )}
          {canShare && (
            <Button
              variant="accent"
              size="sm"
              iconLeft="share"
              onClick={onShare}
              aria-label="Compartir sesión .zwo"
              title="Compartir .zwo (WhatsApp, Mail, Drive…)"
            />
          )}
          {canExport && (
            <Button
              variant="accent"
              size="sm"
              iconLeft="download"
              onClick={onExport}
              aria-label="Descargar sesión en formato .zwo"
              title="Descargar para Zwift / TrainingPeaks Virtual / TrainerRoad / Wahoo SYSTM"
            >
              .zwo
            </Button>
          )}
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={!canContinue}
            onClick={onContinue}
            fullWidth
          >
            Siguiente: Música
          </Button>
        </>
      }
      desktop={
        <>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          {canSave && (
            <Button
              variant="accent"
              iconLeft="bookmark_add"
              onClick={onSave}
              title="Guardar esta sesión para reutilizarla luego"
            >
              Guardar como mi sesión
            </Button>
          )}
          {canShare && (
            <Button
              variant="accent"
              iconLeft="share"
              onClick={onShare}
              title="Compartir .zwo (WhatsApp, Mail, Drive…)"
            >
              Compartir .zwo
            </Button>
          )}
          {canExport && (
            <Button
              variant="accent"
              iconLeft="download"
              onClick={onExport}
              title="Descargar para Zwift / TrainingPeaks Virtual / TrainerRoad / Wahoo SYSTM"
            >
              Descargar .zwo
            </Button>
          )}
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={!canContinue}
            onClick={onContinue}
          >
            Siguiente: Música
          </Button>
        </>
      }
    />
  );
}
