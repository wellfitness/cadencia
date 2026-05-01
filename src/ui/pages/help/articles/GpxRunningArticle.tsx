import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { navigateInApp } from '@ui/utils/navigation';

export function GpxRunningArticle(): JSX.Element {
  const goToWizard = (): void => {
    navigateInApp('/');
  };

  return (
    <ArticleShell
      slug="gpx-running"
      lead="Cuando subes un GPX de tu carrera, Cadencia divide la ruta en bloques de 60 segundos y asigna a cada uno una zona de intensidad a partir de la pendiente del terreno. Sin necesidad de potenciómetro ni de conocer tu velocidad."
    >
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        ¿Por qué la pendiente y no la velocidad?
      </h2>
      <p>
        En running, el coste energético de correr (medido en julios por kilo y por metro)
        depende <strong>casi exclusivamente de la pendiente</strong>, y es independiente de
        la velocidad a la que vas. Subir una rampa del 10 % te cuesta la misma energía por
        metro vayas a 8 km/h o a 12 km/h: en running, la velocidad domina el TIEMPO total
        pero no el coste por kilómetro.
      </p>
      <p>
        Esto es muy distinto al ciclismo, donde la aerodinámica hace que la velocidad
        domine la potencia (subir una bici es casi todo gravedad, pero rodar en llano es
        casi todo aire). Por eso en bici Cadencia necesita peso, tipo de bici y velocidad
        estimada para calcular vatios; en running con la pendiente sola es suficiente.
      </p>

      <Card variant="info" className="my-6" title="¿De dónde sale ese modelo?" titleIcon="science">
        <p className="text-sm text-gris-700 leading-relaxed">
          La app usa el polinomio metabólico de <strong>Minetti et al. 2002</strong>{' '}
          (publicado en el <em>Journal of Applied Physiology</em>), un fit de quinto grado
          ajustado a los datos de 10 corredores en cinta entre −45 % y +45 % de pendiente.
          El polinomio captura una propiedad sorprendente: el coste energético tiene forma
          de «U» en bajada — bajar una pendiente del −20 % es lo más eficiente posible,
          casi la mitad que el llano, pero a partir de ahí baja peor por la carga
          excéntrica (frenar) y vuelve a subir.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Cómo se traduce pendiente a zona
      </h2>
      <p>
        La app calcula un «multiplicador metabólico» — cuántas veces te cuesta esa
        pendiente comparada con correr en llano — y lo mapea a una zona Z1-Z6:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Bajada moderada o llano fácil</strong> → Z1 (recovery, mínimo metabólico).
        </li>
        <li>
          <strong>Llano</strong> → Z2 (base aeróbica, «puedo conversar»).
        </li>
        <li>
          <strong>Subida del 2-5 %</strong> → Z3 (tempo).
        </li>
        <li>
          <strong>Subida del 5-10 %</strong> → Z4 (umbral).
        </li>
        <li>
          <strong>Subida del 10-15 %</strong> → Z5 (VO₂max).
        </li>
        <li>
          <strong>Subida superior al 15 %</strong> → Z6 (anaeróbico, muros).
        </li>
      </ul>
      <p>
        Las pendientes muy negativas (más de −20 %) vuelven a subir de zona porque correr
        cuesta abajo a tope sigue siendo costoso musculoesqueléticamente, aunque
        cardiovascularmente se note menos.
      </p>

      <Card variant="tip" className="my-6" title="¿Y si mi GPX trae ruido del GPS?" titleIcon="warning">
        <p className="text-sm text-gris-700 leading-relaxed">
          Pendientes fuera del rango razonable (más allá de ±50 %) se «clampan»
          automáticamente al límite — suelen ser ruido del GPS y no esfuerzos reales.
          Además, antes del cálculo de pendiente, la app suaviza la traza de elevación
          para evitar que pequeños saltos del altímetro inflen la zona del bloque
          artificialmente.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Qué pasa con tu peso y tu velocidad
      </h2>
      <p>
        Como el coste de Minetti viene en J/kg/m (ya normalizado por kilo de runner), tu{' '}
        <strong>peso no entra</strong> en el cálculo de zonas. Es opcional en el formulario
        de datos: si lo rellenas, la app puede mostrarte el gasto calórico estimado de la
        sesión, pero la asignación de zonas no cambia.
      </p>
      <p>
        Tu <strong>velocidad real</strong> (que solo aparece si tu GPX trae timestamps) es
        información complementaria — la app la muestra para el contexto pero la zona la
        decide la pendiente, no el ritmo. Esto significa que rodar despacio por una zona
        montañosa puede generar una sesión con más Z4-Z5 del que esperabas: tus piernas
        están trabajando duro aunque el reloj diga que vas «despacio».
      </p>

      <div className="mt-6">
        <Button variant="primary" iconRight="arrow_forward" onClick={goToWizard}>
          Subir un GPX y empezar
        </Button>
      </div>
    </ArticleShell>
  );
}
