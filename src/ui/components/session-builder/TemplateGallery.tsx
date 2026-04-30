import { useRef, useState } from 'react';
import {
  calculateTotalDurationSec,
  templatesForSport,
  type EditableSessionPlan,
  type SessionTemplate,
} from '@core/segmentation';
import type { Sport } from '@core/user';
import { MaterialIcon } from '../MaterialIcon';
import { Button } from '../Button';
import { buildIntensityBars, ZONE_BG_BAR } from '../help/intensityBars';
import { navigateInApp } from '@ui/utils/navigation';
import { MySavedSessionsTab } from './MySavedSessionsTab';

export interface TemplateGalleryProps {
  /** ID de la plantilla actualmente cargada (para resaltarla). */
  activeTemplateId: string | null;
  /**
   * Deporte para filtrar las plantillas que se muestran. Solo se renderizan
   * plantillas cuyo `sport` coincida (las legacy sin `sport` cuentan como 'bike'
   * por retrocompat). Default 'bike'.
   */
  sport?: Sport;
  onSelect: (template: SessionTemplate) => void;
  onStartFromScratch: () => void;
  /**
   * Cargar un plan editable directamente (sin pasar por SessionTemplate).
   * Lo usan las "Mis sesiones" guardadas por el usuario.
   */
  onLoadSavedPlan?: (plan: EditableSessionPlan) => void;
  /**
   * Importar un workout desde archivo .zwo (Zwift, TrainingPeaks Virtual,
   * TrainerRoad, Wahoo SYSTM, MyWhoosh). Si se proporciona, aparece un
   * tercer botón "Importar (.zwo)" en el header de la galería. NO aplica
   * a running (Zwift es solo cycling): el padre debe omitir el callback
   * cuando sport === 'run'.
   */
  onImportFile?: (file: File) => void;
}

type Tab = 'templates' | 'mine';

const TEMPLATE_ICONS: Record<string, string> = {
  // Cycling
  sit: 'bolt',
  'hiit-10-20-30': 'local_fire_department',
  'noruego-4x4': 'trending_up',
  'zona2-continuo': 'favorite',
  'tempo-mlss': 'speed',
  'umbral-progresivo': 'show_chart',
  'vo2max-cortos': 'rocket_launch',
  'recuperacion-activa': 'self_improvement',
  // Running
  'run-easy-long': 'self_improvement',
  'run-tempo': 'speed',
  'run-yasso-800': 'flag',
  'run-daniels-intervals': 'rocket_launch',
  'run-hiit-30-30': 'local_fire_department',
  'run-threshold-cruise': 'show_chart',
};

/**
 * Galeria de las 4 plantillas indoor cycling + opcion "vacia". Al
 * seleccionar una plantilla, se carga su estructura en el editor del padre.
 */
export function TemplateGallery({
  activeTemplateId,
  sport = 'bike',
  onSelect,
  onStartFromScratch,
  onLoadSavedPlan,
  onImportFile,
}: TemplateGalleryProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('templates');
  const templates = templatesForSport(sport);

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file !== undefined && onImportFile !== undefined) {
      onImportFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="text-base md:text-lg font-semibold text-gris-800 flex items-center gap-2">
          <MaterialIcon name="auto_awesome" size="small" className="text-turquesa-600" />
          {tab === 'templates' ? 'Empieza con una plantilla' : 'Mis sesiones guardadas'}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onStartFromScratch}>
            Empieza desde cero
          </Button>
          {onImportFile !== undefined && (
            <>
              <Button
                variant="accent"
                size="sm"
                iconLeft="upload_file"
                onClick={handleImportClick}
              >
                Importar .zwo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zwo,.xml,application/xml,text/xml"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Selecciona un archivo .zwo"
              />
            </>
          )}
        </div>
      </header>

      {onLoadSavedPlan !== undefined && (
        <div
          className="flex gap-1 border-b border-gris-200"
          role="tablist"
          aria-label="Origen del plan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'templates'}
            onClick={() => setTab('templates')}
            className={`px-4 py-2 text-sm min-h-[44px] transition-colors ${
              tab === 'templates'
                ? 'border-b-2 border-turquesa-600 text-turquesa-700 font-semibold'
                : 'text-gris-600 hover:text-gris-800'
            }`}
          >
            <MaterialIcon name="science" size="small" className="mr-1" />
            Plantillas científicas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            onClick={() => setTab('mine')}
            className={`px-4 py-2 text-sm min-h-[44px] transition-colors ${
              tab === 'mine'
                ? 'border-b-2 border-turquesa-600 text-turquesa-700 font-semibold'
                : 'text-gris-600 hover:text-gris-800'
            }`}
          >
            <MaterialIcon name="bookmark" size="small" className="mr-1" />
            Mis sesiones
          </button>
        </div>
      )}

      {tab === 'templates' ? (
        <>
          <a
            href="/ayuda/plantillas"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/plantillas');
            }}
            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-turquesa-600 hover:text-turquesa-700 transition-colors"
          >
            <MaterialIcon name="help_outline" size="small" decorative />
            ¿Qué plantilla elegir? Consulta la guía
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </a>
          {/* Grid: 4 cols en bike (8 plantillas → 2 filas), 3 cols en run
              (6 plantillas → 2 filas exactas). Asi evitamos huecos vacios en
              la rejilla cuando sport === 'run'. */}
          <div
            className={`grid grid-cols-2 gap-2 md:gap-3 ${
              sport === 'run' ? 'md:grid-cols-3' : 'md:grid-cols-4'
            }`}
          >
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                active={activeTemplateId === template.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      ) : (
        onLoadSavedPlan !== undefined && <MySavedSessionsTab onLoad={onLoadSavedPlan} />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: SessionTemplate;
  active: boolean;
  onSelect: (template: SessionTemplate) => void;
}

function TemplateCard({ template, active, onSelect }: TemplateCardProps): JSX.Element {
  const plan = { name: template.name, items: [...template.items] };
  const totalSec = calculateTotalDurationSec(plan);
  const totalMin = Math.round(totalSec / 60);
  const icon = TEMPLATE_ICONS[template.id] ?? 'fitness_center';

  // Mini-barra de intensidad: 8 segmentos coloreados segun la zona
  // proporcional al tiempo en esa zona en el plan expandido. Da una idea
  // rapida del perfil de la sesion sin tener que cargarla.
  const intensityBars = buildIntensityBars(template, 8);

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`group text-left rounded-lg border-2 p-2.5 md:p-3 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500 focus-visible:ring-offset-2 ${
        active
          ? 'border-turquesa-600 bg-turquesa-50'
          : 'border-gris-200 bg-white hover:border-turquesa-400 hover:-translate-y-0.5 hover:shadow-sm'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-2 mb-1">
        <MaterialIcon
          name={icon}
          size="small"
          className={active ? 'text-turquesa-700' : 'text-turquesa-600'}
        />
        <span
          className={`text-xs md:text-sm font-bold ${active ? 'text-turquesa-800' : 'text-gris-800'}`}
        >
          {template.name}
        </span>
      </div>
      <p className="text-[11px] md:text-xs text-gris-600 leading-snug mb-1.5 line-clamp-3">
        {template.description}
      </p>
      <div
        className="flex gap-0.5 mb-1.5"
        aria-hidden
        title="Intensidad relativa por zona"
      >
        {intensityBars.map((zone, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-sm ${ZONE_BG_BAR[zone]}`}
          />
        ))}
      </div>
      <p className="text-[11px] md:text-xs text-gris-500 tabular-nums">
        ≈ {totalMin} min
      </p>
    </button>
  );
}

