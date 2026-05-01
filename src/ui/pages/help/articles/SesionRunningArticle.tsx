import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { navigateInApp } from '@ui/utils/navigation';

export function SesionRunningArticle(): JSX.Element {
  const goToWizard = (): void => {
    navigateInApp('/');
  };

  return (
    <ArticleShell
      slug="sesion-running"
      lead="Una sesión de running en pista o tapiz es una secuencia de bloques de tiempo, cada uno con una intensidad. Tú decides la estructura; Cadencia se encarga de poner la música."
    >
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        ¿En qué se diferencia de una ruta GPX?
      </h2>
      <p>
        En modo <strong>outdoor</strong> subes un archivo .gpx de tu carrera y la app deduce
        la zona de cada tramo a partir de la pendiente del terreno (curva metabólica de
        Minetti). En modo <strong>sesión</strong> tú defines el entrenamiento por bloques: la
        app no necesita ningún archivo, solo tu plan.
      </p>
      <p>
        Por eso en sesión controlas exactamente qué zonas trabajas y en qué orden — ideal
        para entrenamientos científicos como Yasso 800s, Daniels Intervals, Threshold
        Cruise o un HIIT 30-30.
      </p>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Estructura típica de una sesión
      </h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          <strong>Calentamiento</strong>: 10-15 min trotando suave en Z1-Z2 para subir la
          temperatura muscular y preparar el sistema cardiovascular. Imprescindible si
          después vas a tirar series rápidas.
        </li>
        <li>
          <strong>Trabajo principal</strong>: el meollo de la sesión. Puede ser un rodaje
          continuo (Easy Long Run en Z2, Tempo Run en Z3-Z4) o intervalos de trabajo
          intercalados con recuperaciones (1000 m a vVO₂max, 800 m de Yasso, 30 s rápidos en
          un HIIT…).
        </li>
        <li>
          <strong>Recuperaciones</strong>: los bloques entre los intervalos duros. Para
          intervalos de umbral (Z4) basta una recuperación corta en Z1 trotando suave; para
          intervalos VO₂max (Z5) necesitas más tiempo (2-3 min) para llegar fresco al
          siguiente.
        </li>
        <li>
          <strong>Vuelta a la calma</strong>: 10 min trotando muy suave o caminando para
          bajar las pulsaciones. Saltársela no es trágico, pero ayuda a la recuperación.
        </li>
      </ol>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Cómo funciona el constructor
      </h2>
      <p>
        En el asistente, cuando eliges <strong>Carrera + Sesión</strong>, entras al
        constructor visual. Tienes dos formas de empezar:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Una plantilla</strong>: 6 sesiones con respaldo en la literatura que puedes
          modificar después (ver <em>Plantillas de running y cuándo usarlas</em>).
        </li>
        <li>
          <strong>Desde cero</strong>: añades bloques uno a uno y los ordenas a tu gusto.
        </li>
      </ul>
      <p>
        Cada bloque tiene <strong>zona</strong> (Z1-Z6), <strong>duración</strong> y
        descripción opcional. Los intervalos repetidos los agrupas en un <em>grupo × N</em>{' '}
        en lugar de duplicarlos — más limpio y más fácil de editar (5 × 1000 m son un grupo
        con dos bloques: trabajo + recuperación).
      </p>

      <Card variant="info" className="my-6" title="¿Y la cadencia de pedaleo?" titleIcon="info">
        <p className="text-sm text-gris-700 leading-relaxed">
          En running no hay perfil de cadencia tipo «llano / escalada / sprint» como en
          ciclismo. La cadencia natural de zancada es bastante uniforme (160-180 spm) sea
          cual sea la zona. Por eso el constructor de running no te pide ese campo: solo
          zona y duración. La música encaja con la zona del bloque (ver{' '}
          <em>Cómo se elige la música</em>).
        </p>
      </Card>

      <Card variant="tip" className="my-6" title="¿Qué dice la ciencia sobre HIIT en running?" titleIcon="science">
        <p className="text-sm text-gris-700 leading-relaxed">
          Los HIIT cortos en running (30-30, 15-15, sprints de 200 m) son{' '}
          <strong>eficientes en tiempo</strong> para mejorar el VO₂max. Los intervalos
          largos a vVO₂max (3-5 min, como Daniels Intervals) <strong>maximizan</strong> esa
          mejora a costa de mayor desgaste. La mejor estrategia combina ambos en distintos
          momentos del año, junto a un volumen sólido de Z2.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Modo TV: pantalla completa con voz e indicaciones
      </h2>
      <p>
        Cuando ya tienes la sesión y la lista de música casadas, el botón{' '}
        <strong>«Modo TV»</strong> abre una pestaña en pantalla completa pensada para
        apoyarse frente a la cinta o llevar el móvil en el brazalete con la pantalla
        siempre visible.
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Voz del entrenador</strong>: en cada cambio de bloque, una voz castellana
          anuncia <em>«Zona X, sensación, duración. RPE Y»</em>. Útil para no tener que mirar
          la pantalla mientras corres. Puedes silenciarla con la tecla{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">V</kbd> o el
          botón del altavoz; se guarda en{' '}
          <a
            href="/preferencias"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/preferencias');
            }}
            className="text-turquesa-600 hover:text-turquesa-700 font-semibold"
          >
            Mis preferencias
          </a>{' '}
          y se sincroniza con Drive.
        </li>
        <li>
          <strong>Beeps de cuenta atrás</strong> a 10, 5, 3, 2 y 1 segundos del fin de cada
          bloque, y un acorde ascendente al cambiar de fase (si la voz está activa, el acorde
          se omite para no saturar).
        </li>
        <li>
          <strong>Pantalla siempre encendida</strong> via Screen Wake Lock. Sin esto, la
          pantalla se apaga a los ~30 s y muchos navegadores móviles silencian la voz y los
          beeps en background.
        </li>
        <li>
          <strong>Atajos de teclado</strong>:{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">Espacio</kbd>{' '}
          play/pausa,{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">←</kbd>/
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">→</kbd>{' '}
          saltar fase,{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">S</kbd> sonido
          on/off,{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">V</kbd> voz
          on/off,{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">R</kbd>{' '}
          reiniciar,{' '}
          <kbd className="font-mono text-xs bg-gris-100 px-1.5 py-0.5 rounded">Esc</kbd>{' '}
          cerrar.
        </li>
      </ul>
      <p>
        Si el navegador no soporta síntesis de voz, el modo TV degrada solo: los beeps y el
        acorde de cambio siguen funcionando como red de seguridad sonora.
      </p>

      <div className="mt-6">
        <Button variant="primary" iconRight="arrow_forward" onClick={goToWizard}>
          Empezar a construir mi sesión
        </Button>
      </div>
    </ArticleShell>
  );
}
