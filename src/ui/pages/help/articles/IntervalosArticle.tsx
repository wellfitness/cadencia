import { ArticleShell } from '@ui/components/help/ArticleShell';
import { IntervalPrescriptionTable } from '@ui/components/help/IntervalPrescriptionTable';
import { Card } from '@ui/components/Card';

export function IntervalosArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="intervalos"
      lead="Trabajar por intervalos es alternar bloques duros con recuperaciones para acumular más tiempo en una zona alta del que aguantarías en continuo. La prescripción correcta depende de la zona objetivo. Esta lógica es universal: aplica igual al ciclismo y al running."
    >
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        TMM, TTA y recuperación
      </h2>
      <p>
        Tres números resumen un intervalo:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>TMM</strong> (Tiempo Mantenido por Intervalo): cuánto dura cada bloque
          de trabajo individual. Cuanto más alta la zona, más corto el TMM.
        </li>
        <li>
          <strong>TTA</strong> (Tiempo Total Acumulado): la suma de todos los intervalos de
          trabajo de la sesión en esa zona — ignora calentamiento, recuperaciones y vuelta
          a la calma. Es el "trabajo neto" que estimula la adaptación.
        </li>
        <li>
          <strong>Recuperación</strong>: la duración y la zona del bloque que separa dos
          intervalos. Cae a Z2 cuando el trabajo es submáximo (Z3-Z4) y a Z1 cuando es
          supramáximo (Z5-Z6) — necesitas recuperar del todo entre esfuerzos cortos.
        </li>
      </ul>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Tabla de prescripción por zona
      </h2>
      <IntervalPrescriptionTable />

      <Card variant="tip" className="my-6" title="Lectura: novato vs avanzado" titleIcon="psychology">
        <p className="text-sm text-gris-700 leading-relaxed">
          Las columnas de TTA novato / avanzado son <strong>orientativas</strong>. Si llevas
          poco tiempo entrenando por intervalos, empieza por novato y progresa con el paso
          de las semanas. Un TTA novato bien ejecutado tiene más valor que un TTA avanzado
          a medio gas. La regla es: <strong>el último intervalo debe ser al menos tan duro
          como el primero</strong>. Si no, te has pasado.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Cadencia y elección de música — qué cambia entre ciclismo y running
      </h2>
      <p>
        El motor de Cadencia empareja música usando la cadencia esperada del bloque, pero
        cómo se determina esa cadencia <strong>depende del deporte</strong>:
      </p>

      <h3 className="font-display text-lg text-gris-900 mt-5 mb-2">
        En ciclismo: perfil de cadencia (llano / escalada / sprint)
      </h3>
      <p>
        Cada bloque tiene un <strong>perfil de cadencia</strong> que define qué tipo de
        pedaleo se espera. La música encaja en función de este perfil, no solo de la zona:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Llano</strong> (70-90 rpm): pedalada continua sostenible. Compatible con
          Z1, Z2, Z3 y Z4.
        </li>
        <li>
          <strong>Escalada</strong> (55-80 rpm): cadencia baja, alta resistencia. Para
          muros y escaladas. Compatible con Z3, Z4 y Z5.
        </li>
        <li>
          <strong>Sprint</strong> (90-115 rpm): cadencia alta neuromuscular. Solo Z6.
        </li>
      </ul>
      <p>
        Por eso un bloque Z4 a 65 rpm en escalada y un bloque Z4 a 85 rpm en llano llevan
        música muy distinta aunque trabajen la misma zona fisiológica.
      </p>

      <h3 className="font-display text-lg text-gris-900 mt-5 mb-2">
        En running: cadencia acoplada a la zona (sin perfil)
      </h3>
      <p>
        En running la cadencia natural de zancada se mantiene bastante uniforme alrededor
        de 160-180 spm sea cual sea la intensidad — no hay un equivalente al "perfil
        llano vs escalada" del ciclismo. Por eso los bloques de una sesión de running
        llevan solo <strong>zona</strong> y <strong>duración</strong>; el constructor no
        te pide perfil de cadencia.
      </p>
      <p>
        El motor musical aplica el rango de BPM de canción adecuado a la zona del bloque
        (más enérgico en zonas altas, más calmado en Z1-Z2) y mantiene la coincidencia
        1:1 / 2:1 — la doble vía rescata mucha música rock y dance que Spotify etiqueta
        al doble de su tempo perceptual.
      </p>
    </ArticleShell>
  );
}
