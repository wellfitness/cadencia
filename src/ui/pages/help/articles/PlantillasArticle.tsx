import { SESSION_TEMPLATES, type SessionTemplate, type SessionTemplateId } from '@core/segmentation';
import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { TemplateExplainer } from '@ui/components/help/TemplateExplainer';
import { navigateInApp } from '@ui/utils/navigation';

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
  // Plantillas de running (este artículo cubre solo las de ciclismo; los textos
  // explicativos de running se documentan en su propio articulo de ayuda).
  'run-easy-long':
    'Sesión más frecuente en cualquier plan de fondo. 60 min Z2 con conversación posible, base aeróbica.',
  'run-tempo':
    'Veinte minutos a ritmo de umbral (Z3-Z4). "Cómodamente duro": solo frases cortas. Mejora MLSS.',
  'run-yasso-800':
    'Diez × 800 m al ritmo Z5 con 400 m suaves. Predictor clásico de tiempo de marathon (Yasso).',
  'run-daniels-intervals':
    'Cinco × 1000 m al ritmo VO2max con 2:30 min de recuperación. Sesión clásica de Jack Daniels.',
  'run-hiit-30-30':
    'Veinte ciclos de 30 s rápidos + 30 s suaves. Protocolo Billat para acumular tiempo a velocidad máxima aeróbica.',
  'run-threshold-cruise':
    'Tres × 1500 m a ritmo de umbral con 90 s suaves entre cada uno. T-pace de Daniels.',
  // Plantillas de tests fisiologicos (este articulo cubre entrenos; los tests
  // se documentan en su propio articulo de ayuda dedicado).
  'bike-test-ramp':
    'Test de campo: rampa lineal +25 W/min hasta agotamiento. Estima FTP con factor 0,75 sobre la potencia minuto pico.',
  'bike-test-map5':
    'Test de campo: 5 minutos all-out tras calentamiento. Estima VO2max (Sitko 2021) y captura tu FCmáx real.',
  'bike-test-3mt':
    'Test de campo: 3 minutos all-out (Vanhatalo 2007) con resistencia fija. Calcula CP y W′. Solo válido en modo NIVEL/SLOPE.',
  'run-test-hrmax-daniels':
    'Test de campo Daniels: 4 min duro + 1 min suave + 3 min all-out. Para medir tu FCmáx real con un protocolo de 10 min.',
  'run-test-5min':
    'Test de campo: 5 minutos all-out. Captura FCmáx y la FC media estima tu LTHR (FC umbral).',
  'run-test-30-15-ift':
    'Test de campo Buchheit: 30 s corriendo + 15 s descanso, velocidad creciente cada estadio. Da vMAS y FCmáx sin sostener nunca >30 s.',
};

function templatesByCategory(): {
  recovery: SessionTemplate[];
  aerobic: SessionTemplate[];
  threshold: SessionTemplate[];
  vo2max: SessionTemplate[];
  anaerobic: SessionTemplate[];
} {
  const all = [...SESSION_TEMPLATES].filter((t) => t.sport === 'bike');
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
      lead="Ocho plantillas de ciclo indoor validadas científicamente, organizadas por objetivo fisiológico. Cárgalas tal cual o úsalas como punto de partida y modifícalas en el constructor."
    >
      <Card variant="info" className="mb-6" title="¿Buscas plantillas de running?" titleIcon="directions_run">
        <p className="text-sm text-gris-700 leading-relaxed">
          Este artículo cubre solo las plantillas de <strong>ciclo indoor</strong>. Si
          eres runner, ve a{' '}
          <a
            href="/ayuda/plantillas-running"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/plantillas-running');
            }}
            className="text-turquesa-600 hover:text-turquesa-700 font-semibold inline-flex items-center gap-1"
          >
            Plantillas de running y cuándo usarlas
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </a>{' '}
          (Yasso 800s, Daniels Intervals, Threshold Cruise, HIIT 30-30, Easy Long Run y
          Tempo Run).
        </p>
      </Card>

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
