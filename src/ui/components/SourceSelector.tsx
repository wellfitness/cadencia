import { MaterialIcon } from './MaterialIcon';

export type RouteSourceChoice = 'gpx' | 'session';

export interface SourceSelectorProps {
  onSelect: (choice: RouteSourceChoice) => void;
}

/**
 * Pantalla inicial del paso "Plan": el usuario elige si va a subir un GPX
 * (ruta exterior) o construir una sesion indoor cycling. Ambas ramas
 * convergen luego en el mismo motor de matching.
 */
export function SourceSelector({ onSelect }: SourceSelectorProps): JSX.Element {
  return (
    <div className="space-y-3 md:space-y-4">
      <header className="text-center mb-2 md:mb-4">
        <h2 className="font-display text-2xl md:text-3xl text-gris-800 mb-1">
          ¿Qué vas a hacer hoy?
        </h2>
        <p className="text-sm md:text-base text-gris-600">
          Elige el tipo de entrenamiento para crear la lista a tu medida.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <SourceCard
          choice="gpx"
          icon="route"
          title="Ruta con GPX"
          description="Sube un archivo .gpx de una ruta en exterior (Strava, Komoot, Garmin, Wahoo…). Calculamos potencia y zonas a partir del recorrido."
          highlights={['Bici de carretera, gravel o MTB', 'Perfil de elevación real', 'Listas largas para rodajes']}
          onSelect={onSelect}
        />
        <SourceCard
          choice="session"
          icon="fitness_center"
          title="Sesión indoor"
          description="Construye una sesión de rodillo o spinning con tus propios bloques de intervalos, o parte de una plantilla validada."
          highlights={['SIT, HIIT, Noruego 4×4, Z2', 'Sin GPX, todo a tu ritmo', 'Modo TV para seguir la sesión']}
          onSelect={onSelect}
        />
      </div>
    </div>
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
  return (
    <button
      type="button"
      onClick={() => onSelect(choice)}
      className="group text-left bg-white border-2 border-gris-200 rounded-xl p-4 md:p-5 hover:border-turquesa-500 hover:shadow-[0_4px_12px_rgba(0,190,200,0.15)] hover:-translate-y-0.5 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3 mb-2 md:mb-3">
        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-turquesa-50 text-turquesa-600 group-hover:bg-turquesa-100 transition-colors">
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
