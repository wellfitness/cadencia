import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';

export function MusicaArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="musica"
      lead="Cadencia no busca canciones por nombre o por género: empareja cada bloque con la canción cuyo tempo, energía y valencia mejor encajan con la intensidad y el carácter del bloque."
    >
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        La cadencia: el único filtro excluyente
      </h2>
      <p>
        Lo único que descarta una canción es la <strong>cadencia</strong>. Si los BPM de la
        canción no encajan con la cadencia objetivo del bloque, la canción no entra. Para
        no ser demasiado restrictivo, el motor admite dos modos de coincidencia:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>1:1</strong>: una pedalada por pulso. Una canción de 80 BPM se pedalea a
          80 rpm.
        </li>
        <li>
          <strong>2:1 (a tempo doble)</strong>: golpe fuerte cada dos pedaladas. Una
          canción de 145 BPM se pedalea a ~72 rpm. Esto rescata mucho rock y dance clásico
          que Spotify etiqueta al doble de su tempo perceptual.
        </li>
      </ul>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Energía, valencia y género: suman, no descartan
      </h2>
      <p>
        Una vez filtradas por cadencia, las canciones se ordenan por una puntuación
        compuesta. Cada componente vale entre 0 y 1, y todas las canciones que pasan el
        filtro compiten por el hueco:
      </p>
      <Card variant="default" className="my-4" title="Fórmula de la puntuación" titleIcon="calculate">
        <p className="text-sm font-mono text-gris-800">
          puntuación = 0,30·cadencia + 0,30·energía + 0,20·valencia + 0,20·género
        </p>
      </Card>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Cadencia</strong>: cuanto más cerca del centro del rango, mayor puntuación.
        </li>
        <li>
          <strong>Energía</strong> (Spotify, 0-1): mide la intensidad sonora, percusión y
          dinámica. Cada zona tiene un ideal — Z1 = 0,30 (suave), Z6 = 0,95 (explosivo).
        </li>
        <li>
          <strong>Valencia</strong> (Spotify, 0-1): positividad emocional. Z1 = 0,40
          (introspectivo), Z6 = 0,70 (eufórico).
        </li>
        <li>
          <strong>Género</strong>: 1 si encaja con tus preferencias, 0,5 si no marcaste
          ninguna, 0 si no encaja.
        </li>
      </ul>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        "Todo con energía"
      </h2>
      <p>
        Si activas esta opción en el paso "Música", el ideal de energía de Z1 y Z2 sube a
        0,70. Te emparejará canciones más vibrantes en las zonas suaves — útil cuando
        quieres sentirte arriba durante todo el entrenamiento, no solo en los intervalos
        duros.
      </p>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Cómo se reparten las canciones a lo largo de la sesión
      </h2>
      <p>
        Cadencia te genera una lista de canciones en orden, pero <strong>Spotify la
        reproduce de corrido</strong>: cada canción suena hasta el final, sin cortes ni
        fundidos, dure lo que dure tu bloque. La app organiza la lista pensando en eso
        para que la música acompañe tu esfuerzo:
      </p>

      <h3 className="font-display text-lg text-gris-900 mt-5 mb-2">
        En sesiones largas y sostenidas
      </h3>
      <p>
        Plantillas como <strong>Noruego 4×4</strong>, <strong>Tempo MLSS</strong>,{' '}
        <strong>Umbral Progresivo</strong> o <strong>Z2 continuo</strong> tienen bloques
        de varios minutos cada uno. Aquí Cadencia pone una canción por bloque, en el orden
        de los bloques. Como cada bloque dura lo parecido a una canción (3-5 min), la
        sincronización es buena: cuando arranca un nuevo bloque, ya está sonando o está a
        punto de empezar la canción pensada para él.
      </p>

      <h3 className="font-display text-lg text-gris-900 mt-5 mb-2">
        En sesiones interválicas cortas (SIT, HIIT 10-20-30, VO2max cortos)
      </h3>
      <p>
        En estas plantillas los intervalos duros duran pocos segundos (10 s, 30 s, 2 min)
        y se intercalan con descansos cortos. Si pusiéramos una canción distinta en cada
        intervalo y descanso, Spotify no podría seguir el ritmo: una canción de 3 min se
        comería los siguientes intervalos enteros y podrías acabar pedaleando un sprint
        con una canción suave de recuperación sonando.
      </p>
      <p>
        Para evitarlo, Cadencia detecta el patrón de intervalos y selecciona canciones de
        la <strong>zona más alta del set</strong> para acompañar todo el bloque interválico,
        descansos incluidos. Es como una clase de spinning real: el monitor pone música
        potente durante toda la serie, no cambia el track en cada recuperación de 30 s.
        Así tienes la garantía de que <strong>nunca te va a sonar una canción suave en
        mitad de un sprint o un intervalo Z4/Z5/Z6</strong>.
      </p>

      <h3 className="font-display text-lg text-gris-900 mt-5 mb-2">
        En rutas al aire libre (GPX)
      </h3>
      <p>
        Aquí el motor usa <em>solapamiento</em>: si una canción es lo bastante larga para
        cubrir varios tramos consecutivos de la misma zona, aparece una sola vez en la
        lista en lugar de duplicarse. La música acompaña tu ruta sin saltos innecesarios.
      </p>

      <Card variant="tip" className="my-6" title="Cero repeticiones" titleIcon="repeat_one">
        <p className="text-sm text-gris-700 leading-relaxed">
          Una canción nunca aparece dos veces en la misma lista mientras quede una
          alternativa fresca, aunque su cadencia no sea ideal. Si el catálogo se agota, el
          motor lo marca como <strong>"encaje libre"</strong> y la interfaz te avisa con
          una franja dorada para que sepas que la lista mejorará subiendo más listas
          propias.
        </p>
      </Card>
    </ArticleShell>
  );
}
