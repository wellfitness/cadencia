import { SESSION_TEMPLATES, type SessionTemplate, type SessionTemplateId } from '@core/segmentation';
import { ArticleShell } from '@ui/components/help/ArticleShell';
import { TemplateExplainer } from '@ui/components/help/TemplateExplainer';

const TEMPLATE_CONTEXT: Partial<Record<SessionTemplateId, string>> = {
  'run-easy-long':
    'La sesión más frecuente de cualquier plan de fondo (5K, 10K, media, marathon, ultra). Una hora en Z2 con conversación posible: la base aeróbica que sostiene todo lo demás. Si solo pudieras hacer una sesión a la semana, sería esta.',
  'run-tempo':
    'Veinte minutos a ritmo "cómodamente duro" — solo frases cortas, no podrías mantener una conversación fluida. Sube el umbral aeróbico (MLSS) y enseña al cuerpo a aclarar lactato a velocidad alta. Tres veces más eficiente que un volumen de Z2 equivalente para mejorar tiempos de 10K-marathon.',
  'run-yasso-800':
    'Diez × 800 m al ritmo Z5 con 400 m suaves de recuperación entre cada uno. Predictor clásico de tiempo de marathon (Bart Yasso): el tiempo medio de los 800 m en min:seg ≈ tu tiempo objetivo de marathon en h:min. Sesión de potencia aeróbica máxima.',
  'run-daniels-intervals':
    'Cinco × 1000 m a ritmo de VO₂max (Z5) con 2:30 min de recuperación trotando muy suave. Sesión clásica de Jack Daniels — mejora el techo cardiovascular acumulando ~20 min en Z5, mucho más de lo que aguantarías en continuo. Coste: percepción del esfuerzo muy alta.',
  'run-hiit-30-30':
    'Veinte ciclos de 30 s rápidos + 30 s suaves. Protocolo Billat para acumular tiempo a velocidad máxima aeróbica con recuperaciones cortas. Más asequible neuromuscularmente que los intervalos largos a vVO₂max y rinde mucho como sesión de calidad cuando tienes 40 minutos justos.',
  'run-threshold-cruise':
    'Tres × 1500 m a ritmo de umbral (Z4) con 90 s suaves entre cada uno. Daniels lo llama "T-pace" — el ritmo más rápido que puedes sostener una hora. Mejora la capacidad de tolerar lactato sin agotar tanto como un Tempo Run continuo. Ideal en mitad de la semana.',
};

function runTemplatesByCategory(): {
  base: SessionTemplate[];
  tempo: SessionTemplate[];
  threshold: SessionTemplate[];
  vo2max: SessionTemplate[];
} {
  const all = [...SESSION_TEMPLATES].filter((t) => t.sport === 'run');
  return {
    base: all.filter((t) => t.id === 'run-easy-long'),
    tempo: all.filter((t) => t.id === 'run-tempo'),
    threshold: all.filter((t) => t.id === 'run-threshold-cruise'),
    vo2max: all.filter(
      (t) =>
        t.id === 'run-yasso-800' ||
        t.id === 'run-daniels-intervals' ||
        t.id === 'run-hiit-30-30',
    ),
  };
}

export function PlantillasRunningArticle(): JSX.Element {
  const cats = runTemplatesByCategory();

  return (
    <ArticleShell
      slug="plantillas-running"
      lead="Seis plantillas de running validadas científicamente, organizadas por objetivo fisiológico. Cárgalas tal cual o úsalas como punto de partida y modifícalas en el constructor."
    >
      <Section title="Base aeróbica (rodaje largo)" icon="favorite">
        {cats.base.map((t) => (
          <TemplateExplainerWithContext key={t.id} template={t} />
        ))}
      </Section>
      <Section title="Tempo / MLSS" icon="speed">
        {cats.tempo.map((t) => (
          <TemplateExplainerWithContext key={t.id} template={t} />
        ))}
      </Section>
      <Section title="Umbral (T-pace)" icon="show_chart">
        {cats.threshold.map((t) => (
          <TemplateExplainerWithContext key={t.id} template={t} />
        ))}
      </Section>
      <Section title="VO₂max y velocidad aeróbica máxima" icon="rocket_launch">
        {cats.vo2max.map((t) => (
          <TemplateExplainerWithContext key={t.id} template={t} />
        ))}
      </Section>
    </ArticleShell>
  );
}

/**
 * Wrapper que pasa el `context` al TemplateExplainer solo si existe en el
 * mapping (TEMPLATE_CONTEXT es Partial). Evita pasar `undefined` explicito,
 * que choca con `exactOptionalPropertyTypes: true` del tsconfig.
 */
function TemplateExplainerWithContext({ template }: { template: SessionTemplate }): JSX.Element {
  const context = TEMPLATE_CONTEXT[template.id];
  if (context !== undefined) {
    return <TemplateExplainer template={template} context={context} />;
  }
  return <TemplateExplainer template={template} />;
}

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): JSX.Element {
  return (
    <section className="mt-6 mb-2">
      <h2 className="font-display text-xl md:text-2xl text-gris-900 mb-3">{title}</h2>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
