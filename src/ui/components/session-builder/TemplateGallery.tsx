import {
  calculateTotalDurationSec,
  SESSION_TEMPLATES,
  type SessionTemplate,
} from '@core/segmentation';
import { MaterialIcon } from '../MaterialIcon';

export interface TemplateGalleryProps {
  /** ID de la plantilla actualmente cargada (para resaltarla). */
  activeTemplateId: string | null;
  onSelect: (template: SessionTemplate) => void;
  onStartFromScratch: () => void;
}

const TEMPLATE_ICONS: Record<string, string> = {
  sit: 'bolt',
  'hiit-10-20-30': 'local_fire_department',
  'noruego-4x4': 'trending_up',
  'zona2-continuo': 'favorite',
};

/**
 * Galeria de las 4 plantillas indoor cycling + opcion "vacia". Al
 * seleccionar una plantilla, se carga su estructura en el editor del padre.
 */
export function TemplateGallery({
  activeTemplateId,
  onSelect,
  onStartFromScratch,
}: TemplateGalleryProps): JSX.Element {
  return (
    <div className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-base md:text-lg font-semibold text-gris-800 flex items-center gap-2">
          <MaterialIcon name="auto_awesome" size="small" className="text-turquesa-600" />
          Empieza con una plantilla
        </h3>
        <button
          type="button"
          onClick={onStartFromScratch}
          className="text-xs md:text-sm text-turquesa-700 hover:text-turquesa-800 hover:underline font-medium"
        >
          O empieza desde cero
        </button>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {SESSION_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            active={activeTemplateId === template.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: SessionTemplate;
  active: boolean;
  onSelect: (template: SessionTemplate) => void;
}

function TemplateCard({ template, active, onSelect }: TemplateCardProps): JSX.Element {
  const totalSec = calculateTotalDurationSec({ name: template.name, items: [...template.items] });
  const totalMin = Math.round(totalSec / 60);
  const icon = TEMPLATE_ICONS[template.id] ?? 'fitness_center';

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
      <p className="text-[11px] md:text-xs text-gris-500 tabular-nums">
        ≈ {totalMin} min
      </p>
    </button>
  );
}
