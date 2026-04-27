import { useState } from 'react';
import { Card } from '@ui/components/Card';
import { Button } from '@ui/components/Button';
import { Logo } from '@ui/components/Logo';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SiteFooter } from '@ui/components/SiteFooter';
import { BetaAccessModal } from '@ui/components/BetaAccessModal';

export interface LandingProps {
  onStart: () => void;
}

export function Landing({ onStart }: LandingProps): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = (): void => setModalOpen(true);
  const closeModal = (): void => setModalOpen(false);
  const continueToWizard = (): void => {
    setModalOpen(false);
    onStart();
  };

  return (
    <div className="min-h-full flex flex-col bg-white">
      <main className="flex-1">
        <Hero onTry={openModal} />
        <HowItWorks />
        <WhyItWorks />
        <Privacy />
        <Faq />
        <FinalCta onTry={openModal} />
      </main>
      <SiteFooter />
      <BetaAccessModal
        open={modalOpen}
        onClose={closeModal}
        onContinue={continueToWizard}
      />
    </div>
  );
}

function Hero({ onTry }: { onTry: () => void }): JSX.Element {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-white"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-16 text-center">
        {/* Logo + wordmark horizontal centrado */}
        <div className="flex justify-center mb-6">
          <Logo variant="full" size="xl" orientation="horizontal" />
        </div>

        {/* Divisor estilo carretera: linea central discontinua larga */}
        <div
          aria-hidden="true"
          className="mx-auto mb-8 h-1 max-w-md"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, #9ca3af 0 28px, transparent 28px 44px)',
          }}
        />

        {/* H1 con remate cromatico en la ultima frase */}
        <h1
          id="hero-title"
          className="font-display text-4xl md:text-6xl leading-tight mb-6"
        >
          <span className="block text-gris-800">Tu plan. Tu intensidad.</span>
          <span className="block text-turquesa-600">Tu música.</span>
        </h1>

        {/* Subtitulo */}
        <p className="text-lg md:text-xl text-gris-700 max-w-2xl mx-auto mb-6">
          Sube un GPX de tu ruta o construye tu sesión indoor por bloques.
          La app te genera una playlist de Spotify donde cada canción encaja
          con la intensidad real de cada tramo o bloque.
        </p>

        {/* Pills de beneficio */}
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

        {/* CTA unico: abre el modal con los requisitos antes de entrar al wizard */}
        <Button variant="primary" size="lg" onClick={onTry} iconRight="arrow_forward">
          Probar aplicación
        </Button>
        <p className="text-sm text-gris-500 mt-3">
          Gratis. Sin cuenta. Sin servidor.
        </p>
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
            title="Tu plan"
            desc="Sube un GPX exportado desde Strava o Komoot, o construye una sesión indoor por bloques desde plantillas científicas (SIT, HIIT, Noruego 4×4). Calculamos la intensidad de cada tramo o bloque."
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
            desc="Mejora medible del rendimiento físico sin alterar tu frecuencia cardíaca: no es un truco perceptivo, es eficiencia real."
            citation="Terry et al. 2020"
            doi="10.1037/bul0000216"
            n={3599}
          />
          <EvidenceCard
            icon="psychology"
            title="Esfuerzo percibido"
            stat="−0,22 SMD"
            desc="La misma intensidad te parece menos exigente con música. Empujas más rato antes de necesitar bajar el ritmo."
            citation="Terry et al. 2020"
            doi="10.1037/bul0000216"
            n={3599}
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
    q: '¿Sirve para entrenamiento indoor (rodillo o bici estática)?',
    a: 'Sí. Además de procesar GPX outdoor, Cadencia tiene un constructor de sesiones indoor: armas tu rutina por bloques (calentamiento, intervalos, recuperación, sprints) desde cero o partiendo de plantillas científicas (SIT, HIIT, Noruego 4×4) y la app te genera la playlist sincronizada con cada bloque. Hay un Modo TV pantalla completa para seguir la sesión desde una tablet sobre el manillar.',
  },
  {
    q: '¿Funciona sin Spotify Premium?',
    a: 'Para crear la playlist sirve cualquier cuenta de Spotify, gratuita o Premium. Pero solo Premium reproduce las canciones en el orden calculado durante la ruta: con cuenta gratuita Spotify las suena en modo aleatorio en el móvil, lo que rompe el ajuste entre cada tramo y su canción. Sin cuenta de Spotify la app sigue calculándote la potencia y la segmentación, pero no podrás guardar la lista.',
  },
  {
    q: '¿Cómo escucho la playlist en ruta sin saltarme la ley?',
    a: 'En España (Reglamento General de Circulación, art. 18.2) está prohibido conducir cualquier vehículo, bici incluida, con auriculares conectados a un reproductor de sonido. La sanción son 200 € y 3 puntos del carné de coche. La prohibición abarca también los auriculares de conducción ósea, porque la norma no distingue por tipo. Opciones legales: altavoz Bluetooth montado en el manillar o en el cuadro, o un altavoz portátil en la mochila o en el bolsillo del maillot. Para sesiones indoor (rodillo, bici estática, Modo TV) no hay restricción: ahí los auriculares son perfectos.',
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

function FinalCta({ onTry }: { onTry: () => void }): JSX.Element {
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
          ¿Listo para pedalear con ritmo?
        </h2>
        <p className="text-gris-700 mb-6 text-lg">
          Tarda menos de un minuto en generarte la playlist.
        </p>
        <Button variant="primary" size="lg" onClick={onTry} iconRight="arrow_forward">
          Probar aplicación
        </Button>
      </div>
    </section>
  );
}

