import { calculateTotalDurationSec, type SessionTemplate } from '@core/segmentation';
import { MaterialIcon } from '../MaterialIcon';
import { Button } from '../Button';
import { navigateInApp } from '@ui/utils/navigation';
import { buildIntensityBars, ZONE_BG_BAR } from './intensityBars';

const TEMPLATE_ICONS: Record<string, string> = {
  // Ciclismo
  sit: 'bolt',
  'hiit-10-20-30': 'local_fire_department',
  'noruego-4x4': 'trending_up',
  'zona2-continuo': 'favorite',
  'tempo-mlss': 'speed',
  'umbral-progresivo': 'show_chart',
  'vo2max-cortos': 'rocket_launch',
  'recuperacion-activa': 'self_improvement',
  // Running
  'run-easy-long': 'favorite',
  'run-tempo': 'speed',
  'run-yasso-800': 'show_chart',
  'run-daniels-intervals': 'rocket_launch',
  'run-hiit-30-30': 'local_fire_department',
  'run-threshold-cruise': 'trending_up',
};

export interface TemplateExplainerProps {
  template: SessionTemplate;
  /** Cuando se proporciona, sobrescribe el contexto explicativo bajo la descripcion. */
  context?: string;
}

/**
 * Card explicativa de una plantilla, pensada para el articulo de ayuda
 * "Plantillas". Muestra icono + nombre + duracion + descripcion + barra de
 * intensidad + boton "Cargar en constructor" que dispara la navegacion al
 * wizard con el query param ?plantilla= que el SessionBuilder consume.
 */
export function TemplateExplainer({ template, context }: TemplateExplainerProps): JSX.Element {
  const totalSec = calculateTotalDurationSec({ name: template.name, items: [...template.items] });
  const totalMin = Math.round(totalSec / 60);
  const icon = TEMPLATE_ICONS[template.id] ?? 'fitness_center';
  const intensityBars = buildIntensityBars(template, 24);

  const handleLoad = (): void => {
    navigateInApp(`/?plantilla=${template.id}`);
  };

  return (
    <article className="rounded-xl border border-gris-200 bg-white p-4 md:p-5">
      <header className="flex items-start gap-3 mb-2">
        <span className="shrink-0 w-10 h-10 rounded-lg bg-turquesa-50 text-turquesa-600 flex items-center justify-center">
          <MaterialIcon name={icon} size="medium" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-semibold text-gris-800">{template.name}</h3>
          <p className="text-xs text-gris-500 tabular-nums">≈ {totalMin} min</p>
        </div>
      </header>
      <p className="text-sm text-gris-700 leading-relaxed mb-3">{template.description}</p>
      {context && (
        <p className="text-sm text-gris-600 leading-relaxed mb-3 italic">{context}</p>
      )}
      <div
        className="flex gap-0.5 mb-4"
        aria-hidden
        title="Intensidad relativa por zona a lo largo de la sesión"
      >
        {intensityBars.map((zone, i) => (
          <span key={i} className={`h-2 flex-1 rounded-sm ${ZONE_BG_BAR[zone]}`} />
        ))}
      </div>
      <Button
        variant="primary"
        size="sm"
        iconRight="arrow_forward"
        onClick={handleLoad}
      >
        Cargar en el constructor
      </Button>
    </article>
  );
}
