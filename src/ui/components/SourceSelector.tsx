import { useState } from 'react';
import type { Sport } from '@core/user';
import { MaterialIcon } from './MaterialIcon';

export type RouteSourceChoice = 'gpx' | 'session';

/** Decision combinada del paso "Tipo": deporte + tipo de fuente. */
export interface TypeChoice {
  sport: Sport;
  source: RouteSourceChoice;
}

export interface SourceSelectorProps {
  /** Deporte preseleccionado (si el usuario tiene preferencia guardada). Default 'bike'. */
  defaultSport?: Sport;
  /** Se invoca al pulsar una de las dos cards: capta deporte + fuente en un solo click. */
  onSelect: (choice: TypeChoice) => void;
}

/**
 * Pantalla inicial del paso "Tipo": el usuario elige PRIMERO su deporte (bici
 * o running) via toggle, y DESPUES si va a entrenar con una ruta exterior
 * (GPX) o una sesion por bloques (indoor/pista). Las dos decisiones se
 * comprometen al pulsar una card — sin boton intermedio.
 *
 * El toggle de deporte se gestiona en estado local con default desde props
 * (deporte recordado entre sesiones). Al cambiar el toggle, las descripciones
 * de las cards se adaptan en directo para reflejar el contexto del deporte
 * seleccionado.
 */
export function SourceSelector({
  defaultSport = 'bike',
  onSelect,
}: SourceSelectorProps): JSX.Element {
  const [sport, setSport] = useState<Sport>(defaultSport);
  const copy = COPY_BY_SPORT[sport];

  return (
    <div className="space-y-4 md:space-y-5">
      <SportToggle value={sport} onChange={setSport} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <SourceCard
          choice="gpx"
          icon={copy.gpx.icon}
          title={copy.gpx.title}
          description={copy.gpx.description}
          highlights={copy.gpx.highlights}
          onSelect={(source) => onSelect({ sport, source })}
        />
        <SourceCard
          choice="session"
          icon={copy.session.icon}
          title={copy.session.title}
          description={copy.session.description}
          highlights={copy.session.highlights}
          onSelect={(source) => onSelect({ sport, source })}
        />
      </div>
    </div>
  );
}

interface SportToggleProps {
  value: Sport;
  onChange: (next: Sport) => void;
}

function SportToggle({ value, onChange }: SportToggleProps): JSX.Element {
  return (
    <div className="flex justify-center">
      <div
        role="radiogroup"
        aria-label="Deporte"
        className="inline-flex rounded-full bg-gris-100 p-1 shadow-inner"
      >
        <SportToggleButton
          active={value === 'bike'}
          onClick={() => onChange('bike')}
          icon="directions_bike"
          label="Ciclismo"
        />
        <SportToggleButton
          active={value === 'run'}
          onClick={() => onChange('run')}
          icon="directions_run"
          label="Carrera"
        />
      </div>
    </div>
  );
}

interface SportToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

function SportToggleButton({
  active,
  onClick,
  icon,
  label,
}: SportToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm md:text-base font-medium transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500 focus-visible:ring-offset-2 ${
        active
          ? 'bg-turquesa-600 text-white shadow-md'
          : 'text-gris-700 hover:text-gris-900'
      }`}
    >
      <MaterialIcon name={icon} size="small" decorative />
      <span>{label}</span>
    </button>
  );
}

interface SourceCardProps {
  choice: RouteSourceChoice;
  icon: string;
  title: string;
  description: string;
  highlights: readonly string[];
  onSelect: (choice: RouteSourceChoice) => void;
}

function SourceCard({
  choice,
  icon,
  title,
  description,
  highlights,
  onSelect,
}: SourceCardProps): JSX.Element {
  // El pill del icono se pinta dorado para 'session' y turquesa para 'gpx',
  // diferenciando las dos hermanas a primera vista sin desplazar la primary
  // turquesa fuera de su rol (los hovers de borde, titulo y flecha siguen
  // siendo turquesa: la accion principal sigue siendo "navegar al wizard").
  const iconPillClasses =
    choice === 'session'
      ? 'bg-tulipTree-50 text-tulipTree-600 group-hover:bg-tulipTree-100'
      : 'bg-turquesa-50 text-turquesa-600 group-hover:bg-turquesa-100';
  return (
    <button
      type="button"
      onClick={() => onSelect(choice)}
      className="group text-left bg-white border-2 border-gris-200 rounded-xl p-4 md:p-5 hover:border-turquesa-500 hover:shadow-[0_4px_12px_rgba(0,190,200,0.15)] hover:-translate-y-0.5 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3 mb-2 md:mb-3">
        <span
          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${iconPillClasses}`}
        >
          <MaterialIcon name={icon} size="medium" decorative />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg md:text-xl text-gris-800 group-hover:text-turquesa-700 transition-colors">
            {title}
          </h3>
        </div>
        <MaterialIcon
          name="arrow_forward"
          size="small"
          className="text-gris-400 group-hover:text-turquesa-600 transition-colors mt-1"
          decorative
        />
      </div>
      <p className="text-sm text-gris-600 mb-3 leading-relaxed">{description}</p>
      <ul className="space-y-1">
        {highlights.map((h) => (
          <li key={h} className="flex items-center gap-1.5 text-xs text-gris-500">
            <MaterialIcon name="check_circle" size="small" className="text-turquesa-500" decorative />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

/**
 * Copy de las cards adaptado al deporte. Mantenemos los mismos iconos en
 * ambos deportes (route, fitness_center) porque siguen funcionando
 * semanticamente — la diferencia esta en el texto, no en el simbolo. La
 * descripcion y highlights cambian para reflejar lo que el usuario va a
 * subir/construir segun su deporte.
 */
const COPY_BY_SPORT: Record<
  Sport,
  {
    gpx: {
      icon: string;
      title: string;
      description: string;
      highlights: readonly string[];
    };
    session: {
      icon: string;
      title: string;
      description: string;
      highlights: readonly string[];
    };
  }
> = {
  bike: {
    gpx: {
      icon: 'route',
      title: 'Ruta con GPX',
      description:
        'Sube un archivo .gpx de una ruta en exterior (Strava, Komoot, Garmin, Wahoo…). Calculamos potencia y zonas a partir del recorrido.',
      highlights: [
        'Bici de carretera, gravel o MTB',
        'Perfil de elevación real',
        'Listas largas para rodajes',
      ],
    },
    session: {
      icon: 'fitness_center',
      title: 'Sesión indoor',
      description:
        'Construye una sesión de rodillo o spinning con tus propios bloques de intervalos, o parte de una plantilla validada.',
      highlights: [
        'SIT, HIIT, Noruego 4×4, Z2',
        'Sin GPX, todo a tu ritmo',
        'Modo TV para seguir la sesión',
      ],
    },
  },
  run: {
    gpx: {
      icon: 'route',
      title: 'Ruta con GPX',
      description:
        'Sube un archivo .gpx de tu carrera en exterior. Calculamos las zonas a partir de la pendiente del recorrido (curva de Minetti).',
      highlights: [
        'Asfalto, trail o pista',
        'Perfil de elevación real',
        'Listas largas para rodajes',
      ],
    },
    session: {
      icon: 'fitness_center',
      title: 'Sesión',
      description:
        'Construye una sesión en pista o tapiz con tus propios bloques, o parte de una plantilla validada (series, tempo, intervalos).',
      highlights: [
        'Yasso 800, Daniels, HIIT 30-30',
        'Sin GPX, todo a tu ritmo',
        'Modo TV para seguir la sesión',
      ],
    },
  },
};
