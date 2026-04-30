import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { navigateInApp } from '@ui/utils/navigation';

export function SesionIndoorArticle(): JSX.Element {
  const goToWizard = (): void => {
    navigateInApp('/');
  };

  return (
    <ArticleShell
      slug="sesion-indoor"
      lead="Una sesión indoor de ciclo (rodillo o spinning) es una secuencia de bloques de tiempo, cada uno con una intensidad y un perfil de pedaleo. Tú decides la estructura; Cadencia se encarga de poner la música."
    >
      <Card variant="info" className="mb-6" title="¿Vienes de running?" titleIcon="directions_run">
        <p className="text-sm text-gris-700 leading-relaxed">
          Este artículo cubre las sesiones de <strong>ciclo indoor</strong>. Si eres
          runner, ve a{' '}
          <a
            href="/ayuda/sesion-running"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/sesion-running');
            }}
            className="text-turquesa-600 hover:text-turquesa-700 font-semibold inline-flex items-center gap-1"
          >
            Cómo construir una sesión de running
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </a>{' '}
          — el constructor es muy parecido pero los bloques de running solo llevan zona y
          duración (sin perfil de cadencia).
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        ¿En qué se diferencia de una ruta GPX?
      </h2>
      <p>
        En modo <strong>outdoor</strong> subes un GPX y la app deduce la intensidad de cada
        tramo a partir de la pendiente y la velocidad. En modo <strong>indoor</strong> tú
        defines la sesión por bloques: la app no necesita ningún archivo, solo tu plan.
      </p>
      <p>
        Por eso en indoor controlas exactamente qué zonas trabajas y en qué orden — ideal
        para entrenamientos científicos como Noruego 4×4, HIIT 10-20-30 o sesiones de
        umbral progresivo.
      </p>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Estructura típica de una sesión
      </h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          <strong>Calentamiento</strong>: 5-15 min en Z1-Z2 para subir la temperatura
          muscular y preparar el sistema cardiovascular. Imprescindible si después vas a
          tirar de Z4 o más.
        </li>
        <li>
          <strong>Trabajo principal</strong>: el meollo de la sesión. Puede ser un bloque
          continuo (Z2 sostenida, tempo MLSS) o varios intervalos de trabajo intercalados
          con recuperaciones (umbral, VO2max, sprint).
        </li>
        <li>
          <strong>Recuperaciones</strong>: los bloques que separan los intervalos duros.
          Caen a Z2 si el trabajo es submáximo (Z3-Z4) o a Z1 si es supramáximo (Z5-Z6) —
          necesitas recuperar del todo entre esfuerzos cortos muy intensos.
        </li>
        <li>
          <strong>Vuelta a la calma</strong>: 5-10 min en Z1 para bajar las pulsaciones y
          favorecer la recuperación. Saltársela no es trágico, pero ayuda.
        </li>
      </ol>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Cómo funciona el constructor
      </h2>
      <p>
        En el asistente, cuando eliges modo "Sesión indoor", entras al constructor visual.
        Tienes tres formas de empezar:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Una plantilla</strong>: 8 sesiones validadas científicamente que puedes
          modificar después (ver <em>Plantillas y cuándo usarlas</em>).
        </li>
        <li>
          <strong>Desde cero</strong>: añades bloques uno a uno y los ordenas a tu gusto.
        </li>
        <li>
          <strong>Importando un .zwo</strong>: cualquier archivo de Zwift Workout (Zwift,
          TrainingPeaks Virtual, TrainerRoad, Wahoo SYSTM, MyWhoosh) se carga directamente.
        </li>
      </ul>
      <p>
        Cada bloque tiene <strong>zona</strong> (Z1-Z6), <strong>perfil de cadencia</strong>{' '}
        (llano, escalada o sprint), <strong>duración</strong> y descripción opcional. Los
        intervalos repetidos los agrupas en un <em>grupo × N</em> en lugar de duplicarlos —
        más limpio y más fácil de editar.
      </p>

      <Card variant="tip" className="my-6" title="¿Qué dice la ciencia sobre HIIT?" titleIcon="science">
        <p className="text-sm text-gris-700 leading-relaxed">
          Los HIIT cortos (intervalos ≤30 s, sesiones ≤5 min de trabajo, programas ≤4
          semanas) son <strong>eficientes en tiempo</strong> para mejorar el VO2max en
          población general. Los HIIT largos (intervalos ≥2 min, sesiones ≥15 min de trabajo,
          programas de 4-12 semanas) <strong>maximizan</strong> esa mejora. La mejor estrategia
          combina ambos en distintos momentos del año.
        </p>
      </Card>

      <div className="mt-6">
        <Button variant="primary" iconRight="arrow_forward" onClick={goToWizard}>
          Empezar a construir mi sesión
        </Button>
      </div>
    </ArticleShell>
  );
}
