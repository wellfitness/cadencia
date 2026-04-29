import { SESSION_TEMPLATES, type SessionTemplate, type SessionTemplateId } from '@core/segmentation';
import { ArticleShell } from '@ui/components/help/ArticleShell';
import { TemplateExplainer } from '@ui/components/help/TemplateExplainer';

const TEMPLATE_CONTEXT: Record<SessionTemplateId, string> = {
  sit:
    'Cuando tienes 30 minutos justos y quieres un estímulo neuromuscular potente. Ideal para días sueltos sin programa.',
  'hiit-10-20-30':
    'Para sumar tiempo en VO2max sin agotar las piernas. Dentro de cada bloque, el sub-ciclo 30/20/10 mantiene la frecuencia cardiaca alta sin recuperación profunda; entre bloques, los 2 min en Z2 dejan respirar antes del siguiente envite — protocolo Bangsbo original.',
  'noruego-4x4':
    'El estándar oro para mejorar VO2max. Si solo pudieras hacer una sesión a la semana, sería esta. Coste: muy alta percepción del esfuerzo.',
  'zona2-continuo':
    'La sesión "aburrida" que más beneficio acumula a largo plazo. Construye base aeróbica, mejora la oxidación de grasas y prepara al cuerpo para todo lo demás.',
  'tempo-mlss':
    'Ideal cuando ya tienes base Z2 sólida y quieres empujar el umbral aeróbico hacia arriba. Tres bloques de 12 min en MLSS. Sostenible pero exigente.',
  'umbral-progresivo':
    'La forma clásica de subir la potencia umbral: cinco bloques de 5 min en Z4 con micropausas Z2. Permite acumular más tiempo en umbral del que aguantarías en continuo.',
  'vo2max-cortos':
    'Más cortos y más explosivos que el Noruego 4×4. Los 2 min en Z5 son cortos pero la cadencia tipo escalada aumenta la solicitación muscular. Recuperación a Z1 para llegar fresco al siguiente.',
  'recuperacion-activa':
    'Día entre cargas duras o regreso post-lesión. La intensidad permite mantener una conversación. No suma estímulo, ayuda a recuperar y a construir hábito.',
};

function templatesByCategory(): {
  recovery: SessionTemplate[];
  aerobic: SessionTemplate[];
  threshold: SessionTemplate[];
  vo2max: SessionTemplate[];
  anaerobic: SessionTemplate[];
} {
  const all = [...SESSION_TEMPLATES];
  return {
    recovery: all.filter((t) => t.id === 'recuperacion-activa'),
    aerobic: all.filter((t) => t.id === 'zona2-continuo' || t.id === 'tempo-mlss'),
    threshold: all.filter((t) => t.id === 'umbral-progresivo' || t.id === 'noruego-4x4'),
    vo2max: all.filter((t) => t.id === 'vo2max-cortos' || t.id === 'hiit-10-20-30'),
    anaerobic: all.filter((t) => t.id === 'sit'),
  };
}

export function PlantillasArticle(): JSX.Element {
  const cats = templatesByCategory();

  return (
    <ArticleShell
      slug="plantillas"
      lead="Ocho plantillas validadas científicamente, organizadas por objetivo fisiológico. Cárgalas tal cual o úsalas como punto de partida y modifícalas en el constructor."
    >
      <Section title="Recuperación activa" icon="self_improvement">
        {cats.recovery.map((t) => (
          <TemplateExplainer key={t.id} template={t} context={TEMPLATE_CONTEXT[t.id]} />
        ))}
      </Section>
      <Section title="Base aeróbica y tempo" icon="favorite">
        {cats.aerobic.map((t) => (
          <TemplateExplainer key={t.id} template={t} context={TEMPLATE_CONTEXT[t.id]} />
        ))}
      </Section>
      <Section title="Umbral (potencia umbral / VT2)" icon="show_chart">
        {cats.threshold.map((t) => (
          <TemplateExplainer key={t.id} template={t} context={TEMPLATE_CONTEXT[t.id]} />
        ))}
      </Section>
      <Section title="VO2max (PAM)" icon="rocket_launch">
        {cats.vo2max.map((t) => (
          <TemplateExplainer key={t.id} template={t} context={TEMPLATE_CONTEXT[t.id]} />
        ))}
      </Section>
      <Section title="Anaeróbico (sprint)" icon="bolt">
        {cats.anaerobic.map((t) => (
          <TemplateExplainer key={t.id} template={t} context={TEMPLATE_CONTEXT[t.id]} />
        ))}
      </Section>
    </ArticleShell>
  );
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
