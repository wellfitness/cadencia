import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';

export interface LandingProps {
  onStart: () => void;
}

export function Landing({ onStart }: LandingProps): JSX.Element {
  return (
    <div className="min-h-full flex flex-col bg-white">
      <TopBar onStart={onStart} />
      <main className="flex-1">
        <Hero onStart={onStart} />
        <SpotifyPremiumNotice />
        <HowItWorks />
        <WhyItWorks />
        <Privacy />
        <Faq />
        <FinalCta onStart={onStart} />
      </main>
      <Footer />
    </div>
  );
}

function TopBar({ onStart }: { onStart: () => void }): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-gris-200 bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon
            name="directions_bike"
            size="medium"
            className="text-turquesa-600"
            decorative
          />
          <span className="font-display text-turquesa-600 text-xl leading-none">
            Cadencia
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={onStart} iconRight="arrow_forward">
          Empezar
        </Button>
      </div>
    </header>
  );
}

function Hero({ onStart }: { onStart: () => void }): JSX.Element {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-gradient-to-b from-turquesa-50 to-white"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-20 text-center">
        <h1
          id="hero-title"
          className="font-display text-turquesa-700 text-4xl md:text-6xl leading-tight mb-4"
        >
          Tu ruta. Tu potencia. Tu música.
        </h1>
        <p className="text-lg md:text-xl text-gris-700 max-w-2xl mx-auto mb-6">
          Sube un GPX y obtén una playlist de Spotify donde cada canción
          encaja con la intensidad real de cada tramo de tu ruta.
        </p>
        <ul className="flex flex-wrap justify-center gap-3 md:gap-6 mb-8 text-gris-700">
          <li className="flex items-center gap-2">
            <MaterialIcon name="favorite" className="text-turquesa-600" />
            <span className="font-semibold">Más adherencia</span>
          </li>
          <li className="flex items-center gap-2">
            <MaterialIcon name="mood" className="text-turquesa-600" />
            <span className="font-semibold">Más disfrute</span>
          </li>
          <li className="flex items-center gap-2">
            <MaterialIcon name="trending_up" className="text-turquesa-600" />
            <span className="font-semibold">Más rendimiento</span>
          </li>
        </ul>
        <Button variant="primary" size="lg" onClick={onStart} iconRight="arrow_forward">
          Empezar ahora
        </Button>
        <p className="text-sm text-gris-500 mt-3">
          Gratis. Sin cuenta. Sin servidor.
        </p>
      </div>
    </section>
  );
}

function SpotifyPremiumNotice(): JSX.Element {
  return (
    <section aria-label="Aviso sobre Spotify Premium" className="bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:pt-8">
        <Card variant="info" title="Antes de empezar" titleIcon="info">
          <p className="text-gris-700">
            Necesitas Spotify Premium para que la lista se adapte a la ruta o
            entrenamiento. Con la cuenta gratuita se reproduce en orden aleatorio.
          </p>
        </Card>
      </div>
    </section>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <section aria-labelledby="how-it-works-title" className="bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <h2
          id="how-it-works-title"
          className="font-display text-gris-800 text-3xl md:text-4xl text-center mb-10"
        >
          Cómo funciona
        </h2>
        <ol className="grid md:grid-cols-3 gap-6 md:gap-8 list-none">
          <StepCard
            num={1}
            icon="person"
            title="Tus datos"
            desc="Peso y, opcionalmente, tu FTP o frecuencia cardíaca máxima. Calculamos tus zonas de intensidad personalizadas."
          />
          <StepCard
            num={2}
            icon="route"
            title="Tu ruta"
            desc="Sube un archivo GPX exportado desde Strava, Komoot o cualquier app de ciclismo. Estimamos los vatios que generarás en cada tramo."
          />
          <StepCard
            num={3}
            icon="music_note"
            title="Tu música"
            desc="Generamos una playlist de Spotify donde el BPM y la energía de cada canción se ajustan a la intensidad de cada tramo."
          />
        </ol>
      </div>
    </section>
  );
}

interface StepCardProps {
  num: 1 | 2 | 3;
  icon: string;
  title: string;
  desc: string;
}

function StepCard({ num, icon, title, desc }: StepCardProps): JSX.Element {
  return (
    <li className="relative bg-white border-2 border-turquesa-100 rounded-xl p-6 hover:border-turquesa-300 transition-colors">
      <div
        className="absolute -top-4 left-6 bg-turquesa-600 text-white font-display text-xl rounded-full w-10 h-10 flex items-center justify-center"
        aria-hidden
      >
        {num}
      </div>
      <MaterialIcon
        name={icon}
        size="xlarge"
        className="text-turquesa-600 mb-3 mt-2"
      />
      <h3 className="font-display text-gris-800 text-xl mb-2">{title}</h3>
      <p className="text-gris-600">{desc}</p>
    </li>
  );
}

function WhyItWorks(): JSX.Element {
  return (
    <section aria-labelledby="why-it-works-title" className="bg-gris-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <h2
          id="why-it-works-title"
          className="font-display text-gris-800 text-3xl md:text-4xl text-center mb-3"
        >
          Por qué funciona
        </h2>
        <p className="text-center text-gris-600 max-w-2xl mx-auto mb-10">
          No es magia: es la aplicación práctica de la evidencia científica más
          sólida sobre música y ejercicio.
        </p>
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <EvidenceCard
            icon="favorite"
            title="Adherencia"
            stat="+0,48 SMD"
            desc="Mejora la valencia afectiva del ejercicio: lo vives como más placentero, te cuesta menos volver mañana."
            citation="Terry et al. 2020"
            doi="10.1037/bul0000216"
            n={3599}
          />
          <EvidenceCard
            icon="trending_up"
            title="Rendimiento"
            stat="+0,31 SMD"
            desc="Mejora medible del rendimiento físico y reducción del esfuerzo percibido (-0,22 SMD) sin alterar tu frecuencia cardíaca."
            citation="Terry et al. 2020"
            doi="10.1037/bul0000216"
            n={3599}
          />
          <EvidenceCard
            icon="bolt"
            title="Disfrute"
            stat="+18%"
            desc="Triatletas élite aumentaron su tiempo hasta agotamiento sincronizando su pedaleo con la música respecto a entrenar sin música."
            citation="Terry et al. 2011"
            doi="10.1016/j.jsams.2011.06.003"
            n={11}
          />
        </div>
        <p className="text-center text-xs text-gris-500 mt-6">
          SMD = diferencia media estandarizada (Cohen&apos;s d). Datos del
          metaanálisis de 139 estudios y 3.599 participantes.
        </p>
      </div>
    </section>
  );
}

interface EvidenceCardProps {
  icon: string;
  title: string;
  stat: string;
  desc: string;
  citation: string;
  doi: string;
  n: number;
}

function EvidenceCard({
  icon,
  title,
  stat,
  desc,
  citation,
  doi,
  n,
}: EvidenceCardProps): JSX.Element {
  return (
    <article className="bg-white border border-gris-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <MaterialIcon name={icon} size="large" className="text-turquesa-600" />
        <h3 className="font-display text-gris-800 text-xl">{title}</h3>
      </div>
      <p className="font-display text-turquesa-600 text-3xl mb-2">{stat}</p>
      <p className="text-gris-700 mb-4">{desc}</p>
      <p className="text-xs text-gris-500">
        Fuente:{' '}
        <a
          href={`https://doi.org/${doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-turquesa-700 hover:underline"
        >
          {citation}
        </a>
        {' · '}
        n = {n.toLocaleString('es-ES')}
      </p>
    </article>
  );
}

function Privacy(): JSX.Element {
  return (
    <section aria-labelledby="privacy-title" className="bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <Card
          variant="tip"
          title="Tus datos no salen de tu dispositivo"
          titleIcon="lock"
        >
          <p className="text-gris-700 mb-3">
            No tenemos servidores. No tenemos cuentas. No tenemos cookies de
            seguimiento. Todo el cálculo de potencia, segmentación y
            emparejamiento musical ocurre dentro de tu navegador.
          </p>
          <p className="text-gris-700 mb-3">
            Solo nos conectamos a Spotify cuando tú decides crear la playlist,
            y únicamente con permiso para añadir canciones a tu cuenta. Tus
            datos físicos, tu GPX y tu ruta nunca salen de aquí.
          </p>
          <ul className="space-y-2 text-gris-700">
            <li className="flex items-center gap-2">
              <MaterialIcon name="check_circle" className="text-turquesa-600" />
              Sin registros ni inicio de sesión.
            </li>
            <li className="flex items-center gap-2">
              <MaterialIcon name="check_circle" className="text-turquesa-600" />
              Sin base de datos en la nube.
            </li>
            <li className="flex items-center gap-2">
              <MaterialIcon name="check_circle" className="text-turquesa-600" />
              Código fuente abierto y auditable.
            </li>
          </ul>
        </Card>
      </div>
    </section>
  );
}

const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: '¿Necesito conocer mi FTP?',
    a: 'No. Si no tienes potenciómetro, basta con tu peso y tu frecuencia cardíaca máxima (medida o estimada por edad mediante la fórmula de Gulati). Calculamos las zonas con la fórmula de Karvonen.',
  },
  {
    q: '¿Funciona sin Spotify Premium?',
    a: 'Para crear la playlist sirve cualquier cuenta de Spotify, gratuita o Premium. Pero solo Premium reproduce las canciones en el orden calculado durante la ruta: con cuenta gratuita Spotify las suena en modo aleatorio en el móvil, lo que rompe el ajuste entre cada tramo y su canción. Sin cuenta de Spotify la app sigue calculándote la potencia y la segmentación, pero no podrás guardar la lista.',
  },
  {
    q: '¿Es gratis?',
    a: 'Sí. Es código abierto bajo licencia PolyForm Noncommercial. Puedes usarla libremente para tu uso personal o sin fines comerciales.',
  },
  {
    q: '¿Mis datos físicos se guardan en algún sitio?',
    a: 'No. Los datos viven solo en la pestaña actual del navegador (sessionStorage) y se borran cuando la cierras. No tenemos servidores donde almacenarlos.',
  },
] as const;

function Faq(): JSX.Element {
  return (
    <section aria-labelledby="faq-title" className="bg-gris-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <h2
          id="faq-title"
          className="font-display text-gris-800 text-3xl md:text-4xl text-center mb-8"
        >
          Preguntas frecuentes
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group bg-white border border-gris-200 rounded-xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
                <span className="font-semibold text-gris-800">{item.q}</span>
                <MaterialIcon
                  name="expand_more"
                  className="text-turquesa-600 transition-transform group-open:rotate-180 shrink-0"
                />
              </summary>
              <p className="text-gris-700 mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onStart }: { onStart: () => void }): JSX.Element {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="bg-gradient-to-b from-white to-turquesa-50"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16 text-center">
        <h2
          id="final-cta-title"
          className="font-display text-turquesa-700 text-3xl md:text-4xl mb-4"
        >
          ¿Listo para tu próxima ruta?
        </h2>
        <p className="text-gris-700 mb-6 text-lg">
          Tarda menos de un minuto en generarte la playlist.
        </p>
        <Button variant="primary" size="lg" onClick={onStart} iconRight="arrow_forward">
          Empezar ahora
        </Button>
      </div>
    </section>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="border-t border-gris-200 bg-gris-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs md:text-sm text-gris-500">
        <p className="flex items-center gap-1.5">
          <MaterialIcon name="lock" size="small" className="text-gris-400" />
          Sin cuentas, sin cookies, sin servidores. Todo corre en tu dispositivo.
        </p>
        <nav className="flex items-center gap-3">
          <a
            href="/privacy.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Privacidad
          </a>
          <span aria-hidden className="text-gris-300">
            ·
          </span>
          <a
            href="/terms.html"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Términos
          </a>
          <span aria-hidden className="text-gris-300">
            ·
          </span>
          <a
            href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-700 hover:text-turquesa-800 underline-offset-2 hover:underline"
          >
            Licencia
          </a>
        </nav>
      </div>
    </footer>
  );
}
