import { ArticleShell } from '@ui/components/help/ArticleShell';
import { ZoneReferenceTable } from '@ui/components/help/ZoneReferenceTable';
import { Card } from '@ui/components/Card';

export function ZonasArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="zonas"
      lead="Las zonas de entrenamiento son rangos de intensidad cuantificables — vatios, pulsaciones, percepción del esfuerzo — que delimitan los estímulos fisiológicos que tu cuerpo recibe cuando entrenas. Aplican igual a ciclismo y a running."
    >
      <p>
        Cadencia trabaja con <strong>6 zonas lineales (Z1-Z6)</strong> siguiendo el modelo
        Coggan. Cada zona tiene una intención fisiológica clara y un color asociado que se
        mantiene en toda la app: indicadores, gráficos de elevación, bandas en sesiones
        y distintivos de plantillas. <strong>Las mismas 6 zonas valen para los dos
        deportes</strong> — la diferencia está en cómo se calculan los rangos de cada
        zona en tu organismo, no en la nomenclatura.
      </p>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Tabla maestra
      </h2>
      <ZoneReferenceTable />

      <Card variant="info" className="my-6" title="¿Y las zonas Alta / Baja?" titleIcon="info">
        <p className="text-sm text-gris-700 leading-relaxed">
          Algunas literaturas subdividen Z3, Z4 y Z5 en Alta y Baja para ganar resolución.
          Las 6 zonas de Cadencia se corresponden con la versión <strong>"Alta"</strong>{' '}
          cuando la fuente subdivide:
        </p>
        <ul className="list-disc pl-6 mt-2 text-sm text-gris-700 space-y-1">
          <li>Z3 de Cadencia = Z3 Alta (capacidad aeróbica MLSS)</li>
          <li>Z4 de Cadencia = Z4 Alta (potencia umbral / VT2)</li>
          <li>Z5 de Cadencia = Z5 Alta (potencia aeróbica máxima — PAM)</li>
        </ul>
        <p className="text-sm text-gris-700 leading-relaxed mt-2">
          Para la mayoría de usuarios la resolución de 6 zonas es suficiente. Si necesitas
          más granularidad, ajusta los porcentajes manualmente al editar el bloque.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        ¿Qué referencia usar: vatios, pulsaciones o RPE?
      </h2>
      <p>
        Depende de los datos que metas en el asistente y del deporte:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Si tienes <strong>FTP</strong> (potencia de umbral funcional medida con
          potenciómetro), Cadencia te da rangos en vatios — la referencia más precisa.{' '}
          <strong>Solo aplica en ciclismo</strong>: la FTP es un dato del modelo Coggan
          ciclista. En running el equivalente sería la potencia Stryd, que de momento la
          app no consume.
        </li>
        <li>
          Si tienes <strong>FC máxima y FC en reposo</strong>, calcula tus zonas Karvonen
          y te da rangos en pulsaciones — la referencia más práctica si entrenas con
          pulsómetro. <strong>Vale en ciclismo y en running</strong>: la fórmula Karvonen
          es agnóstica de deporte.
        </li>
        <li>
          Si no tienes nada, el <strong>RPE</strong> (escala 1-10 de percepción del esfuerzo)
          siempre vale: Z2 es "puedo conversar", Z4 es "frases cortas", Z6 es "imposible
          hablar". También universal a los dos deportes.
        </li>
      </ul>
      <p>
        Lo ideal es combinar dos referencias. La FC tarda en subir y bajar; los vatios o
        el ritmo de carrera son instantáneos. El RPE corrige el día que no estás bien
        (mismo vatio o ritmo puede ser un Z3 sostenible o un Z4 raspado, según fatiga
        acumulada).
      </p>
    </ArticleShell>
  );
}
