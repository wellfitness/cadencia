import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { navigateInApp } from '@ui/utils/navigation';

/**
 * Articulo del centro de ayuda dedicado a los tests fisiologicos guiados.
 * Cubre los 6 tests (3 ciclismo + 3 running) que el usuario puede ejecutar
 * desde la galeria del SessionBuilder en la pestaña «Tests». Las formulas
 * y refs de PubMed viven en src/core/physiology/tests.ts y son la fuente de
 * verdad: este articulo solo las explica al usuario en castellano.
 */
export function TestsArticle(): JSX.Element {
  const goToWizard = (): void => {
    navigateInApp('/');
  };

  return (
    <ArticleShell
      slug="tests-fisiologicos"
      lead="Cadencia incluye seis tests de campo guiados que estiman tus parámetros fisiológicos clave —FCmáx, FTP, VO₂max, CP, LTHR, vMAS— sin laboratorio. Los ejecutas en Modo TV y, al terminar, introduces los datos clave en un formulario que calcula y guarda el resultado en tu perfil."
    >
      <Card variant="info" className="mb-6" title="Antes de empezar" titleIcon="info">
        <p className="text-sm text-gris-700 leading-relaxed">
          Un test no es un entrenamiento: tiene un protocolo cerrado y se hace
          fresco (idealmente 48 h sin sesiones duras). Si lo haces a medio gas
          el resultado falsea tu perfil y verás zonas mal calibradas durante
          semanas. Repite los tests cada <strong>6-8 semanas</strong> si entrenas
          en serio; cada 12-16 semanas si entrenas para mantenerte.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        Cómo se ejecutan en Cadencia
      </h2>
      <ol className="list-decimal pl-6 space-y-2">
        <li>
          En el constructor de sesiones (paso «Ruta» con modo «Sesión»), abre la
          galería de plantillas y entra en la pestaña{' '}
          <strong>«Tests»</strong>. Verás tres tests de bici si tu deporte es
          ciclismo, o tres de running si es carrera.
        </li>
        <li>
          Selecciona el test. Para los que tienen aviso de hardware crítico
          (rampa, 3MT, 30-15 IFT) Cadencia muestra antes una ventana con la
          configuración previa: lee y confirma antes de empezar.
        </li>
        <li>
          Pulsa <strong>«Modo TV»</strong>: la sesión se ejecuta en pantalla
          completa con cronómetro, voz del entrenador y beeps de fin de fase. La
          pantalla no se apaga (Wake Lock).
        </li>
        <li>
          Al terminar, aparece el modal de resultados. Introduces los datos
          clave del test (lo que tu pulsómetro o tu rodillo te dieron). Cadencia
          aplica la fórmula y guarda el resultado en tus datos. Si tienes Drive
          conectado, viaja a tus otros dispositivos.
        </li>
      </ol>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-6 mb-3">
        Tests de ciclismo
      </h2>

      <TestCard
        icon="stairs"
        title="Test de rampa lineal — FTP"
        protocol="Rampa lineal +25 W/min hasta agotamiento. Calentamiento 10 min en Z2. Cuando ya no puedas mantener la cadencia mínima durante 5 s, el test acaba."
        inputs="La potencia minuto pico (MAP, en vatios)."
        formula={<>FTP ≈ 0,75 × MAP. Convención estándar de la industria (Zwift, TrainerRoad). En ciclistas recreativos tiende a quedar un 5-7 % por debajo del LT real, así que es un suelo conservador.</>}
        hardware="El rodillo debe estar en modo NIVEL/SLOPE para que la rampa avance correctamente con tu ritmo."
        refs={[
          { author: 'Michalik 2019', doi: '10.23736/S0022-4707.19.09126-6' },
          { author: 'Valenzuela 2018', doi: '10.1123/ijspp.2018-0008' },
        ]}
      />

      <TestCard
        icon="monitor_heart"
        title="Test 5 minutos all-out — VO₂max + FCmáx"
        protocol="Calentamiento 15 min progresivo (incluye 2-3 aceleraciones cortas). Después 5 minutos all-out: arrancas fuerte pero gestionando para no irte abajo, y los últimos 60 s todo lo que te quede."
        inputs="La potencia media de los 5 minutos y la FC pico que viste."
        formula={<>VO₂max (mL/kg/min) = 16,6 + 8,87 × (P5min / peso). Regresión bayesiana de Sitko 2021 sobre 46 ciclistas amateur, R² 95 % CI 0,61–0,77. Y la FC pico capta tu FCmáx real, mejor que cualquier estimación por edad.</>}
        refs={[{ author: 'Sitko 2021', doi: '10.1123/ijspp.2020-0923' }]}
      />

      <TestCard
        icon="timer"
        title="Test 3MT — Critical Power y W′"
        protocol="3 minutos all-out contra resistencia FIJA, sin pacing. Calentamiento 15 min con dos rampas. Arrancas a tope desde el segundo cero y sostienes lo que puedas hasta que la potencia se estabilice (que será baja). Es duro psicológicamente."
        inputs="La potencia media de los últimos 30 segundos del test (= EP) y el trabajo total en kJ."
        formula={<>CP = potencia media de los últimos 30 s (Vanhatalo 2007). W′ = trabajo total − CP × 180 s. Validez ±5 W vs CP convencional en 8/10 sujetos; predictive validity r = -0,83 con TT 16,1 km (Black 2013).</>}
        hardware="CRÍTICO: el rodillo debe ir en modo NIVEL/SLOPE (resistencia fija). En modo ERG el rodillo auto-ajusta la resistencia a una potencia objetivo y el resultado es inválido sin error visible."
        refs={[
          { author: 'Vanhatalo, Doust & Burnley 2007', doi: '10.1249/mss.0b013e31802dd3e6' },
          { author: 'Black 2013', doi: '10.1080/17461391.2013.810306' },
        ]}
      />

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-8 mb-3">
        Tests de running
      </h2>
      <p className="text-sm text-gris-600 mb-4">
        Los tres tests de running se basan en pulsómetro: no necesitas
        potenciómetro para correr (Stryd y similares son nicho). Lo que
        capturamos es FCmáx real y, en uno de ellos, también una estimación de
        tu FC umbral.
      </p>

      <TestCard
        icon="monitor_heart"
        title="Daniels FCmáx — 4&apos; + 1&apos; + 3&apos;"
        protocol="Calentamiento 15-20 min progresivo. Después 4 min al ritmo más alto que aguantes ese tiempo + 1 min trotando suave + 3 min all-out. Diseñado para alcanzar tu plateau cardiovascular en menos de 10 min de esfuerzo."
        inputs="La FC pico que registró tu pulsómetro durante el test (normalmente en el último minuto)."
        formula={<>FCmáx = pico real medido. Más fiable que cualquier fórmula por edad (Gulati/Tanaka tienen ±10 bpm de error, suficiente para desplazar una banda Karvonen entera).</>}
        refs={[
          { author: 'Zhou 2001', doi: '10.1097/00005768-200111000-00008' },
          { author: 'Daniels Running Formula', doi: '' },
        ]}
      />

      <TestCard
        icon="timer"
        title="Test 5 minutos all-out (running) — FCmáx + LTHR"
        protocol="Calentamiento 15 min progresivo + 2-3 aceleraciones cortas. Después 5 min all-out en pista o tapiz, gestionando el ritmo para no irte abajo en el minuto 3."
        inputs="La FC pico (FCmáx) y la FC media de los 5 minutos."
        formula={<>FCmáx = pico real medido. LTHR ≈ FC media de los 5 min: en un esfuerzo all-out de 5 min la FC media cae típicamente en el 92-95 % de la FCmáx y se aproxima a la LTHR clásica de Joe Friel (FC media de los últimos 20 min de un TT de 30 min).</>}
        refs={[]}
      />

      <TestCard
        icon="shuffle"
        title="30-15 IFT (Buchheit) — vMAS + FCmáx"
        protocol="Test intermitente: 30 s corriendo + 15 s descanso, velocidad creciente +0,5 km/h por estadio. Stage 1 = 8 km/h. Sigues hasta que no puedas alcanzar las marcas dos veces seguidas. Acumular 30 s a velocidad alta sin sostenerla minutos enteros lo hace muy tolerable mentalmente."
        inputs="El número del último estadio que completaste."
        formula={<>vMAS = 8 + 0,5 × (stage − 1) km/h. Captura también tu FCmáx pico (excelente protocolo para ello). vMAS es informativa por ahora; el valor real está en la FCmáx que sí alimenta tus zonas Karvonen.</>}
        hardware="Necesitas conos colocados a 40 m + el audio oficial Buchheit con los pitidos de cada estadio. El test no funciona sin esa señal acústica externa."
        refs={[{ author: 'Buchheit 2011', doi: '10.1519/JSC.0b013e3181d686b7' }]}
      />

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-8 mb-3">
        Cuándo elegir cuál
      </h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Necesitas FCmáx fiable y nunca te has hecho un test máximo</strong>:
          Daniels FCmáx en running, MAP-5min en bici. Cualquiera de los dos da el
          dato directo en menos de 10 min de esfuerzo.
        </li>
        <li>
          <strong>Quieres FTP para entrenar por potencia en bici</strong>: Test de
          rampa. Más corto y menos psicológicamente exigente que el 20-min de
          Coggan, suficiente para uso recreativo.
        </li>
        <li>
          <strong>Eres ciclista experimentado y quieres un dato CP/W′ más rico</strong>:
          3MT. Te da CP (similar a FTP pero por modelo distinto) y W′
          (capacidad de trabajar por encima de CP).
        </li>
        <li>
          <strong>Eres runner que prefiere series cortas o tienes mala
          tolerancia a sostener 5 min</strong>: 30-15 IFT. Estímulo intermitente
          que captura FCmáx con menos sufrimiento subjetivo.
        </li>
      </ul>

      <Card variant="tip" className="my-6" title="¿Qué pasa con tus zonas después de un test?" titleIcon="science">
        <p className="text-sm text-gris-700 leading-relaxed">
          Cuando guardas el resultado, los datos relevantes (FCmáx, FTP, peso) se
          actualizan en{' '}
          <a
            href="/preferencias"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/preferencias');
            }}
            className="text-turquesa-600 hover:text-turquesa-700 font-semibold inline-flex items-center gap-1"
          >
            Mis preferencias
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </a>{' '}
          y todas tus zonas se recalculan automáticamente — Karvonen para las
          zonas de FC en ambos deportes, y Coggan para las de potencia en bici si
          actualizaste FTP. Las próximas sesiones ya verán los rangos nuevos en
          cada bloque.
        </p>
      </Card>

      <div className="mt-6">
        <Button variant="primary" iconRight="arrow_forward" onClick={goToWizard}>
          Hacer un test ahora
        </Button>
      </div>
    </ArticleShell>
  );
}

interface TestCardProps {
  icon: string;
  title: string;
  protocol: string;
  inputs: string;
  formula: React.ReactNode;
  hardware?: string;
  refs: ReadonlyArray<{ author: string; doi: string }>;
}

function TestCard({
  icon,
  title,
  protocol,
  inputs,
  formula,
  hardware,
  refs,
}: TestCardProps): JSX.Element {
  return (
    <article className="my-5 rounded-xl border border-gris-200 bg-white p-5">
      <header className="flex items-center gap-3 mb-3">
        <MaterialIcon name={icon} size="medium" className="text-turquesa-600" decorative />
        <h3 className="font-display text-lg md:text-xl text-gris-900 leading-tight">{title}</h3>
      </header>
      <dl className="space-y-2.5 text-sm text-gris-700">
        <Row label="Protocolo" value={protocol} />
        <Row label="Datos a introducir" value={inputs} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gris-500 mb-0.5">
            Cálculo
          </dt>
          <dd className="leading-relaxed">{formula}</dd>
        </div>
        {hardware !== undefined && (
          <div className="rounded-md border border-tulipTree-200 bg-tulipTree-50 px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-tulipTree-700 mb-0.5 flex items-center gap-1">
              <MaterialIcon name="warning" size="small" decorative />
              Configuración previa
            </dt>
            <dd className="leading-relaxed text-gris-800">{hardware}</dd>
          </div>
        )}
        {refs.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gris-500 mb-0.5">
              Referencias
            </dt>
            <dd className="text-xs leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
              {refs.map((r, i) =>
                r.doi !== '' ? (
                  <a
                    key={i}
                    href={`https://doi.org/${r.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-turquesa-700 hover:underline"
                  >
                    {r.author}
                  </a>
                ) : (
                  <span key={i} className="text-gris-700">
                    {r.author}
                  </span>
                ),
              )}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gris-500 mb-0.5">
        {label}
      </dt>
      <dd className="leading-relaxed">{value}</dd>
    </div>
  );
}
