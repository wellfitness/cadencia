import { useState } from 'react';
import { Button } from '@ui/components/Button';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { SiteFooter } from '@ui/components/SiteFooter';
import { usePwaInstall } from '@ui/state/usePwaInstall';
import { navigateInApp } from '@ui/utils/navigation';

export interface LandingProps {
  onStart: () => void;
}

export function Landing({ onStart }: LandingProps): JSX.Element {
  return (
    <div className="min-h-full flex flex-col bg-white">
      <main className="flex-1">
        <HeroVisual onTry={onStart} />
        {/* Bloque post-hero móvil + tablet (<lg).
            - Móvil (<md): pastilla Premium ARRIBA + CTA debajo. La pastilla
              encima del botón gestiona la expectativa antes de que el dedo
              llegue al CTA — quien no tenga Premium se entera antes de
              tocar. La imagen 9:16 está saturada y no admite un overlay de
              CTA sin pisarlos visualmente, por eso el CTA vive aquí.
            - Tablet (md..<lg): solo la pastilla Premium (el CTA va como
              overlay sobre la imagen panorámica, donde la franja inferior
              está libre). El div del CTA es `md:hidden`, así que en tablet
              queda fuera del flex y solo se renderiza la pastilla.
            La pastilla reemplaza a los chips de beneficios que vivían aquí
            antes — los chips se mudaron sobre el H2 de "Cómo funciona",
            donde encajan editorialmente como promesa de salida del proceso. */}
        <div className="lg:hidden bg-white px-4 pt-6 pb-2 flex flex-col items-center gap-5">
          <PremiumNotice />
          <div className="md:hidden w-full flex justify-center">
            <LandingCtaBlock onTry={onStart} />
          </div>
        </div>
        <Intro />
        <HowItWorks />
        <InteropZwo />
        <PersonalizedRanges />
        <PlanningCalendar />
        <WhyItWorks />
        <Privacy />
        <Faq />
        <FinalCta onTry={onStart} />
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * LandingCtaBlock: CTA primario «Crear mi sesión» (variante gold size xl).
 * Sin microcopy ni chips — la promesa "Gratis / Sin registro / Sin servidor"
 * vive ya en el footer permanente y en la sección Privacy, no necesita
 * repetirse encima del botón. Los chips son `BenefitChips` aparte, anclables
 * con su propio posicionamiento.
 *
 * Render visual en mayúsculas vía CSS `uppercase` con `tracking-wide` para
 * compensar la pérdida de variabilidad ascendente/descendente — el source
 * queda en case natural ("Crear mi sesión") para que screen readers y el
 * aria-label se lean fluidos. "Sesión" cubre las cuatro combinaciones del
 * wizard (bike/run × outdoor/indoor) y casa con la nomenclatura interna
 * (`SavedSession`, `SessionBuilder`, `SessionTVMode`).
 *
 * No incluye márgenes externos: el contenedor padre decide el spacing.
 */
function LandingCtaBlock({ onTry }: { onTry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        variant="gold"
        size="xl"
        onClick={onTry}
        iconRight="auto_fix_high"
        aria-label="Crear mi sesión en Cadencia"
        className="shadow-xl uppercase tracking-wide"
      >
        Crear mi sesión
      </Button>
    </div>
  );
}

/**
 * PremiumNotice: pastilla negra con borde y texto dorados — tratamiento
 * visual clásico de "tier premium" (alta saturación, máximo contraste sobre
 * blanco y sobre la foto del hero). Filtro suave: el que tiene Premium lee
 * un guiño de valor; el que no, se entera antes de invertir tiempo en el
 * wizard. "Rendimiento" tiene doble lectura (deportiva + ROI de la
 * suscripción), por eso funciona aquí mejor que un "Requiere Spotify Premium"
 * frío.
 *
 * `rounded-2xl` (no `rounded-full`): el copy es lo bastante largo para que
 * en el anclaje right-bottom estrecho del hero desktop entre lg y xl el
 * texto necesite envolver a 2 líneas; un pill totalmente redondo se
 * deformaría en vertical. La esquina 2xl mantiene la familia visual con
 * los chips de beneficios sin imponer single-line.
 *
 * Icono oficial de Spotify (Primary Logo, solo el círculo verde con ondas),
 * descargado del media kit oficial. A 24 px supera el mínimo 21 px que las
 * Branding Guidelines exigen para el icono solo. Preferimos el icono al
 * logo completo aquí porque el texto ya dice «Spotify Premium» — meter el
 * wordmark «Spotify» del logo completo crearía redundancia visual con la
 * propia palabra del copy. El icono verde sobre el fondo negro de la
 * pastilla destaca sin necesidad de versión White/Black (el verde es
 * autocontrastante por su saturación).
 *
 * Fallback textual si el PNG no carga, para no romper la pastilla.
 */
function PremiumNotice(): JSX.Element {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <span className="inline-flex items-center gap-2 rounded-2xl bg-gris-900 border border-tulipTree-400 px-3 py-2 shadow-md">
      {logoOk ? (
        <img
          src="/spotify/Spotify_Primary_Logo_RGB_Green.png"
          alt="Spotify"
          width={24}
          height={24}
          style={{ height: 24, width: 24 }}
          onError={() => setLogoOk(false)}
          loading="lazy"
          decoding="async"
          className="shrink-0"
        />
      ) : (
        <span className="text-sm font-bold text-white shrink-0">Spotify</span>
      )}
      <span className="text-sm font-semibold text-tulipTree-400 leading-tight">
        Sácale más rendimiento a tu Spotify Premium
      </span>
    </span>
  );
}

/**
 * BenefitChips: tres chips de beneficios (adherencia / disfrute / rendimiento).
 * Render independiente para poder ubicarlos en una posición distinta a la
 * del CTA — concretamente, en desktop se anclan a la esquina inferior derecha
 * del hero mientras el CTA queda centrado horizontalmente.
 *
 * La prop `orientation`:
 *   - 'row' (default): fila horizontal envolvente. Pensado para overlay full
 *     width móvil/tablet bajo el botón.
 *   - 'col': columna vertical. Pensado para apilarse en lateral derecho del
 *     hero en desktop sin invadir el centro horizontal.
 */
function BenefitChips({
  orientation = 'row',
}: {
  orientation?: 'row' | 'col';
}): JSX.Element {
  return (
    <ul
      aria-label="Beneficios de Cadencia"
      className={
        orientation === 'col'
          ? 'flex flex-col items-start gap-2'
          : 'flex flex-wrap justify-center gap-2'
      }
    >
      <li className="flex items-center gap-1.5 rounded-full bg-turquesa-50 border border-turquesa-200 px-3 py-1.5">
        <MaterialIcon name="favorite" size="small" className="text-turquesa-600" />
        <span className="text-sm font-semibold text-gris-800">Más adherencia</span>
      </li>
      <li className="flex items-center gap-1.5 rounded-full bg-turquesa-50 border border-turquesa-200 px-3 py-1.5">
        <MaterialIcon name="mood" size="small" className="text-turquesa-600" />
        <span className="text-sm font-semibold text-gris-800">Más disfrute</span>
      </li>
      <li className="flex items-center gap-1.5 rounded-full bg-turquesa-50 border border-turquesa-200 px-3 py-1.5">
        <MaterialIcon name="trending_up" size="small" className="text-turquesa-600" />
        <span className="text-sm font-semibold text-gris-800">Más rendimiento</span>
      </li>
    </ul>
  );
}

/**
 * HeroVisual: imagen full-bleed (panorámica en md+, vertical en <md). La
 * imagen ya contiene todo el copy de cabecera pintado ("Cadencia / disfruta
 * del cardio a tu ritmo / Tu plan. Tu intensidad. Tu música.") junto con la
 * escena multisport (corredor + ciclista) y el mockup del reproductor; ese
 * contenido NO se duplica en HTML.
 *
 * Overlay del CTA en TODOS los breakpoints, con dos formatos distintos:
 *   - Móvil (<md) + tablet (md..<lg): franja full-width anclada al borde
 *     inferior con degradado blanco→transparente. Móvil sin chips (ahorrar
 *     altura sobre la imagen 9:16); tablet con chips.
 *   - Desktop (lg+): card flotante (bg blanco translúcido + backdrop-blur +
 *     shadow-xl + rounded-2xl) anclada a la mitad-inferior DERECHA del hero,
 *     sobre la zona del ciclista/asfalto. Esa zona está libre de copy pintado
 *     (el texto «Tu plan / Tu intensidad / Tu música» vive abajo-izquierda y
 *     «CADENCIA» arriba-centro). max-w-md para no invadir el centro.
 *
 * Posición móvil/tablet: anclado al borde inferior con un degradado
 * blanco→transparente hacia arriba (`from-white/95 via-white/80 to-transparent`).
 * El gradient garantiza contraste WCAG AA del microcopy gris-700 incluso si
 * el track de imagen tiene texturas.
 *
 * Posición desktop: card sólida-traslúcida sobre la imagen. El fondo
 * `bg-white/85 backdrop-blur-sm` mantiene la imagen visible detrás pero
 * eleva el texto a contraste AA sin depender de la zona exacta de la foto.
 *
 * Art-direction con <picture>: cada breakpoint descarga solo su variante.
 * El <img> es decoración (alt="" + aria-hidden), eager + fetchpriority="high"
 * + decoding="async" para optimizar LCP. El único anclaje semántico de la
 * página es el H1 sr-only — Google y lectores de pantalla lo leen aunque
 * la imagen sea decorativa.
 */
function HeroVisual({ onTry }: { onTry: () => void }): JSX.Element {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative w-full overflow-hidden bg-gris-100"
    >
      {/* H1 real, oculto visualmente (la imagen ya muestra la marca pintada).
          Único H1 de la página: SEO + lectores de pantalla. */}
      <h1 id="hero-title" className="sr-only">
        Cadencia: música de Spotify sincronizada con tu salida en bici o tu carrera a pie, al aire libre desde GPX o en interior desde sesiones por bloques
      </h1>

      {/* Imagen responsive con art-direction.
          - aspect-[9/16] en mobile cubre el viewport vertical sin estirar.
          - md..<lg (tablet): aspect-[16/9] sin tope de altura, el contenedor
            adopta el ratio nativo de la panorámica.
          - lg+ (desktop): mismo aspect-[16/9] pero con max-h calc(100vh + 20px)
            para que en pantallas muy anchas (1920+) el alto no exceda el
            viewport en exceso pero permita 20 px adicionales que reducen el
            recorte vertical y dejan ver más de la franja inferior de la imagen
            (la zona donde está pintado «Tu música»). El copy «Tu música» sigue
            cabiendo dentro del fold gracias al ratio panorámico.
          - El `lg:-mb-6` hace que la sección Intro suba ligeramente
            solapándose con el degradado inferior de la imagen, evitando una
            franja vacía entre hero y siguiente bloque. */}
      <div className="relative w-full aspect-[9/16] md:aspect-[16/9] lg:max-h-[calc(100vh+20px)] lg:-mb-6">
        <picture>
          <source media="(min-width: 768px)" srcSet="/hero_cadencia.webp" type="image/webp" />
          <img
            src="/hero_cadencia_movil.webp"
            alt=""
            aria-hidden="true"
            loading="eager"
            // fetchPriority es válido en React 18+ aunque TS quizá no lo
            // tipice; con casing camelCase pasa el JSX-attr genérico.
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>

        {/* Overlay CTA SOLO en tablet (md..<lg).
            - En móvil (<md) la imagen 9:16 está saturada (logo, reproductor,
              corredor+ciclista, copy pintado «Tu plan / Tu intensidad / Tu
              música» en la franja inferior); cualquier overlay competía por
              superficie con esos elementos. Por eso en móvil el CTA vive en
              el bloque blanco bajo el hero (ver `Landing` raíz).
            - En tablet la imagen panorámica 16:9 deja una franja inferior
              limpia donde sí cabe el overlay. `md:pb-6` da aire visual al
              borde inferior. */}
        <div className="hidden md:flex lg:hidden absolute inset-x-0 bottom-0 pt-16 pb-6 px-4 flex-col items-center">
          <LandingCtaBlock onTry={onTry} />
        </div>

        {/* Overlays CTA desktop (lg+): dos bloques transparentes, posicionados
            de forma independiente para cumplir la disposición pedida:
              - Botón CENTRADO horizontalmente, anclado al borde inferior. La
                zona central inferior está libre de copy pintado (el copy «Tu
                plan / Tu intensidad / Tu música» vive a la izquierda, debajo
                del corredor) y queda visualmente sobre el asfalto/ruedas —
                ideal para un CTA llamativo.
              - Pastilla Premium anclada al margen INFERIOR DERECHO, lejos del
                CTA y del copy pintado. `max-w-[260px]` permite envolver el
                texto a 2 líneas en el rango lg (donde la zona derecha es
                estrecha) sin colisionar con el CTA centrado.
            Sin fondo blanco / blur / card: el botón es variant=gold size=xl
            con sombra propia y la pastilla tiene su propio fondo dorado. */}
        <div className="hidden lg:flex absolute left-1/2 lg:bottom-10 -translate-x-1/2 px-4">
          <LandingCtaBlock onTry={onTry} />
        </div>
        <div className="hidden lg:block absolute lg:right-6 xl:right-10 lg:bottom-10 max-w-[260px]">
          <PremiumNotice />
        </div>
      </div>
    </section>
  );
}

/**
 * Intro: bloque inmediatamente bajo el HeroVisual. NO duplica el logo ni el
 * "Tu plan. Tu intensidad. Tu música." porque la imagen del HeroVisual ya
 * muestra esos elementos pintados. Aquí van el copy descriptivo, el botón
 * "Instalar app" (PWA) condicional y el HeroMockup (card con altimetría y
 * tracks).
 *
 * El CTA primario "Crear mi sesión" + pastilla Premium vive en el hero
 * (ver HeroVisual): franja full-width inferior en móvil/tablet, overlay
 * separado en desktop (CTA centrado + pastilla anclada bottom-right). Los
 * chips de beneficios viven sobre el H2 de "Cómo funciona" (más abajo en
 * la página), no aquí. Por eso este componente arranca directamente con
 * la grid del copy + HeroMockup. El padding superior `pt-8 md:pt-12` del
 * contenedor da el aire visual entre el hero y el H2.
 *
 * El botón "Instalar app" (PWA) sigue siendo CTA secundario condicional,
 * dentro de la columna de copy.
 */
function Intro(): JSX.Element {
  const { canInstall, installing, install } = usePwaInstall();

  return (
    <section
      aria-labelledby="intro-title"
      className="relative bg-white"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10 md:pt-12 md:pb-16">
        <div className="grid lg:grid-cols-[1.1fr,1fr] gap-8 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            {/* H2 visible (no sr-only): el bloque necesita un título para
                competir visualmente con el HeroMockup denso de la columna
                derecha. El copy NO repite "Tu plan / Tu intensidad / Tu
                música" (eso ya está pintado en la imagen del Hero); estrena
                un ángulo nuevo: la sincronía como diferenciador. */}
            <h2
              id="intro-title"
              className="font-display text-3xl md:text-4xl text-gris-800 mb-5"
            >
              Música que sigue <span className="text-turquesa-600">cada cambio de intensidad</span>.
            </h2>

            {/* Tres rasgos clave del producto en lista escaneable: input
                flexible, matching musical, export a simuladores. Mejor que un
                párrafo de 3 frases para lectura en mobile y desktop — el ojo
                detecta cada bloque por su icono. Las viñetas se alinean a la
                izquierda incluso cuando el bloque está centrado en mobile,
                porque las listas con texto centrado se leen peor (los ojos
                pierden el origen de cada línea). */}
            <ul className="space-y-3 mb-6 max-w-xl mx-auto lg:mx-0 text-left">
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="directions_bike" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>Sal a rodar, sal a correr o monta tu sesión en casa — tú eliges, la app se adapta.</span>
              </li>
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="music_note" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>Cada canción cae justo donde toca apretar y donde toca soltar.</span>
              </li>
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="import_export" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>¿Entrenas en rodillo? Tu plan se exporta a Zwift, TrainerRoad y compañía con un clic.</span>
              </li>
            </ul>

            {/* Plantillas científicas listas para usar — argumento de
                seriedad técnica (no es una "lista al azar", hay
                literatura detrás). Mostramos 4 nombres reconocibles + "y más"
                con salida al centro de ayuda nuevo, donde el artículo de
                /ayuda/plantillas explica cuándo usar cada una. Misma técnica
                editorial con middots que la lista de "Compatible con" en
                InteropZwo, para coherencia visual. */}
            <p className="text-sm text-gris-600 mb-2 max-w-xl mx-auto lg:mx-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-gris-500 mr-2">
                14 plantillas + 6 tests con base científica · bici y carrera:
              </span>
              <strong className="font-semibold text-gris-800">Noruego 4×4</strong>
              <span className="text-gris-300 mx-1.5">·</span>
              <strong className="font-semibold text-gris-800">SIT</strong>
              <span className="text-gris-300 mx-1.5">·</span>
              <strong className="font-semibold text-gris-800">Yasso 800</strong>
              <span className="text-gris-300 mx-1.5">·</span>
              <strong className="font-semibold text-gris-800">Daniels</strong>
              <span className="text-gris-300 mx-1.5">·</span>
              <strong className="font-semibold text-gris-800">FTP rampa</strong>
              <span className="text-gris-300 mx-1.5">·</span>
              <span>y más</span>
            </p>
            <a
              href="/ayuda/plantillas"
              onClick={(e) => {
                e.preventDefault();
                navigateInApp('/ayuda/plantillas');
              }}
              className="inline-flex items-center gap-1 mb-6 font-semibold text-turquesa-600 hover:text-turquesa-700 transition-colors"
            >
              Ver todas las plantillas
              <MaterialIcon name="arrow_forward" size="small" decorative />
            </a>

            {/* CTA secundario: Instalar app (PWA). Solo aparece si el
                navegador expone el prompt de instalación. Vive bajo el
                bloque informativo, después del CTA primario "Probar
                aplicación" del inicio de la sección, para no canibalizar
                conversión. */}
            {canInstall ? (
              <div className="flex justify-center lg:justify-start">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    void install();
                  }}
                  loading={installing}
                  iconLeft="install_mobile"
                >
                  Instalar app
                </Button>
              </div>
            ) : null}
          </div>

          {/* HeroMockup: en mobile/tablet bajo el texto, en desktop columna
              derecha. Mismo componente que antes, sin cambios. */}
          <div className="flex justify-center mt-10 lg:mt-0 w-full">
            <div className="w-full max-w-sm sm:max-w-md">
              <HeroMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Mock visual del producto: una card "flotante" inclinada con un perfil de
 * elevacion estilizado (SVG) y 3 tracks simulados ya emparejados con su
 * zona. Todo SVG/CSS, sin imagenes externas (cliente-only).
 */
function HeroMockup(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md transform rotate-0 sm:rotate-1 transition-transform duration-300 hover:rotate-0"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gris-200 p-5 md:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gris-500 mb-0.5">
              Ruta procesada
            </p>
            <p className="font-display text-lg text-gris-800 leading-tight">
              Subida al Naranco
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-turquesa-700 bg-turquesa-50 px-2 py-1 rounded-full">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-turquesa-600"
              aria-hidden
            />
            10,8 km
          </span>
        </header>

        {/* Mini perfil de elevacion en SVG con bandas de zona */}
        <div className="relative h-24 rounded-lg overflow-hidden bg-gradient-to-b from-gris-50 to-white border border-gris-100">
          <svg
            viewBox="0 0 200 80"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <linearGradient id="hero-elev" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00bec8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#00bec8" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d="M0,70 L20,62 L40,55 L60,45 L80,30 L100,18 L120,22 L140,40 L160,55 L180,68 L200,72 L200,80 L0,80 Z"
              fill="url(#hero-elev)"
            />
            <path
              d="M0,70 L20,62 L40,55 L60,45 L80,30 L100,18 L120,22 L140,40 L160,55 L180,68 L200,72"
              fill="none"
              stroke="#088b96"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="absolute inset-x-2 bottom-1 flex justify-between text-[10px] text-gris-500 tabular-nums">
            <span>0 km</span>
            <span>5,4 km</span>
            <span>10,8 km</span>
          </div>
        </div>

        {/* Tracks simulados: 3 ejemplos con su zona destino */}
        <ul className="space-y-2" role="presentation">
          <HeroTrackRow
            title="Eye of the Tiger"
            artist="Survivor"
            bpm={108}
            zone={4}
            zoneLabel="Umbral"
          />
          <HeroTrackRow
            title="Born to Be Wild"
            artist="Steppenwolf"
            bpm={147}
            zone={5}
            zoneLabel="VO₂max"
          />
          <HeroTrackRow
            title="Don't Stop Me Now"
            artist="Queen"
            bpm={156}
            zone={3}
            zoneLabel="Tempo"
          />
        </ul>
      </div>
    </div>
  );
}

interface HeroTrackRowProps {
  title: string;
  artist: string;
  bpm: number;
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  zoneLabel: string;
}

function HeroTrackRow({
  title,
  artist,
  bpm,
  zone,
  zoneLabel,
}: HeroTrackRowProps): JSX.Element {
  const ZONE_BG: Record<number, string> = {
    1: 'bg-zone-1',
    2: 'bg-zone-2',
    3: 'bg-zone-3',
    4: 'bg-zone-4',
    5: 'bg-zone-5',
    6: 'bg-zone-6',
  };
  const TEXT: Record<number, string> = {
    1: 'text-white',
    2: 'text-gris-900',
    3: 'text-gris-900',
    4: 'text-white',
    5: 'text-white',
    6: 'text-white',
  };
  const bg = ZONE_BG[zone] ?? 'bg-zone-3';
  const txt = TEXT[zone] ?? 'text-white';
  return (
    <li className="flex items-center gap-3 p-2 rounded-lg bg-gris-50 border border-gris-100">
      <span
        className={`flex items-center justify-center rounded-md ${bg} ${txt} w-9 h-9 flex-shrink-0 font-bold text-xs`}
      >
        Z{zone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gris-800 truncate">{title}</p>
        <p className="text-xs text-gris-500 truncate">
          {artist} · {zoneLabel}
        </p>
      </div>
      <span className="text-xs font-semibold text-gris-700 tabular-nums whitespace-nowrap">
        {bpm} BPM
      </span>
    </li>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <section aria-labelledby="how-it-works-title" className="bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        {/* Chips de beneficios sobre el H2 de "Cómo funciona": cuadran aquí
            porque adherencia/disfrute/rendimiento son el resultado de
            ejecutar los tres pasos (datos → plan → música) que la sección
            describe — actúan como promesa de salida del proceso justo antes
            de que el lector lo entienda. En el hero los reemplaza ahora la
            pastilla Premium, que filtra audiencia antes de gastar tiempo. */}
        <div className="mb-6 flex justify-center">
          <BenefitChips orientation="row" />
        </div>
        <h2
          id="how-it-works-title"
          className="font-display text-gris-800 text-3xl md:text-4xl text-center mb-10"
        >
          Cómo funciona
        </h2>
        <ol className="grid md:grid-cols-3 gap-6 md:gap-8 list-none pt-2">
          <StepCard
            num={1}
            icon="person"
            title="Tus datos"
            desc="Tu frecuencia cardíaca máxima — la que mide tu pulsómetro o, si no tienes, la que estimamos por edad y sexo. Si haces bici, añade el peso (y el FTP si tienes potenciómetro). Con eso calculamos tus zonas reales."
          />
          <StepCard
            num={2}
            icon="route"
            title="Tu plan"
            desc="Sube el GPX de tu ruta o tu carrera — exportado de Strava, Komoot o lo que uses — o monta tu sesión en casa partiendo de una plantilla: Noruego 4×4, Yasso 800, Daniels y unas cuantas más. La app calcula la intensidad de cada tramo."
          />
          <StepCard
            num={3}
            icon="music_note"
            title="Tu música"
            desc="Te montamos la lista de Spotify para que el BPM y la energía de cada canción acompañen exactamente al esfuerzo que toca en cada tramo."
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

/**
 * Bloque "Tu sesión, en cualquier rodillo": destaca la interop bidireccional
 * con .zwo (Zwift, TrainerRoad, Wahoo SYSTM, MyWhoosh, TrainingPeaks Virtual).
 * Acompañado de un mockup-card visual hermano del HeroMockup: barras de zona
 * + meta de la sesión + chip ".zwo" descargable.
 */
function InteropZwo(): JSX.Element {
  return (
    <section aria-labelledby="interop-zwo-title" className="bg-gris-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-[1fr,1.1fr] gap-8 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-turquesa-700">
              <MaterialIcon name="directions_bike" size="small" />
              Bici en rodillo
            </p>
            <h2
              id="interop-zwo-title"
              className="font-display text-gris-800 text-3xl md:text-4xl mb-4"
            >
              Tu sesión, <span className="text-turquesa-600">en cualquier rodillo</span>
            </h2>
            <p className="text-lg text-gris-700 mb-3 max-w-xl lg:mx-0 mx-auto">
              Tu plan sale en{' '}
              <code className="font-mono text-base bg-gris-100 px-1.5 py-0.5 rounded">.zwo</code>{' '}
              estándar. Lo abres en Zwift, TrainerRoad, Wahoo SYSTM, MyWhoosh o
              TrainingPeaks Virtual sin apenas tocar nada.
            </p>
            <p className="text-lg text-gris-700 mb-6 max-w-xl lg:mx-0 mx-auto">
              ¿Te traes una sesión{' '}
              <code className="font-mono text-base bg-gris-100 px-1.5 py-0.5 rounded">.zwo</code>{' '}
              de fuera? Súbela y le ponemos música sincronizada al momento.
            </p>
            <ul className="flex flex-wrap justify-center lg:justify-start gap-3 md:gap-5 mb-4 text-gris-700">
              <li className="flex items-center gap-2">
                <MaterialIcon name="download" className="text-turquesa-600" />
                <span className="font-semibold">Exporta a Zwift y compatibles</span>
              </li>
              <li className="flex items-center gap-2">
                <MaterialIcon name="upload" className="text-turquesa-600" />
                <span className="font-semibold">Importa cualquier .zwo</span>
              </li>
              <li className="flex items-center gap-2">
                <MaterialIcon name="sync" className="text-turquesa-600" />
                <span className="font-semibold">Ida y vuelta sin servidor</span>
              </li>
            </ul>
            <p className="text-sm text-gris-500">
              Formato abierto <code className="font-mono bg-gris-100 px-1 py-0.5 rounded">.zwo</code> (XML).
              Tu rodillo y tu plataforma siguen siendo tuyos.
            </p>
          </div>
          <div className="flex justify-center">
            <ZwoMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Mock visual del export .zwo: card flotante con barras de zona del Noruego
 * 4×4, meta del workout y chip ".zwo" descargable. Hermano del HeroMockup
 * para mantener el lenguaje visual de toda la Landing.
 */
function ZwoMockup(): JSX.Element {
  // Secuencia de zonas del Noruego 4×4: warmup Z2 + 4× (Z4 work + Z2 recovery) + cooldown Z1
  const blocks: { zone: 1 | 2 | 3 | 4 | 5 | 6; flex: number; label: string }[] = [
    { zone: 2, flex: 6, label: 'Calent.' },
    { zone: 4, flex: 4, label: '4 min' },
    { zone: 2, flex: 3, label: '3 min' },
    { zone: 4, flex: 4, label: '4 min' },
    { zone: 2, flex: 3, label: '3 min' },
    { zone: 4, flex: 4, label: '4 min' },
    { zone: 2, flex: 3, label: '3 min' },
    { zone: 4, flex: 4, label: '4 min' },
    { zone: 2, flex: 3, label: '3 min' },
    { zone: 1, flex: 6, label: 'V. calma' },
  ];
  const ZONE_BG: Record<number, string> = {
    1: 'bg-zone-1',
    2: 'bg-zone-2',
    3: 'bg-zone-3',
    4: 'bg-zone-4',
    5: 'bg-zone-5',
    6: 'bg-zone-6',
  };
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md transform rotate-0 sm:-rotate-1 transition-transform duration-300 hover:rotate-0"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gris-200 p-5 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gris-500 mb-0.5">
              Sesión exportable
            </p>
            <p className="font-display text-lg text-gris-800 leading-tight truncate">
              Noruego 4×4
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-turquesa-700 bg-turquesa-100 border border-turquesa-300 px-2.5 py-1 rounded-full whitespace-nowrap">
            <MaterialIcon name="download" size="small" />
            .zwo
          </span>
        </header>
        <div className="space-y-2">
          <div className="flex gap-1 h-10 rounded-md overflow-hidden border border-gris-200">
            {blocks.map((b, i) => (
              <span
                key={i}
                className={`${ZONE_BG[b.zone] ?? 'bg-zone-2'}`}
                style={{ flex: b.flex }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gris-500 tabular-nums px-0.5">
            <span>0&apos;</span>
            <span>24&apos;</span>
            <span>48&apos;</span>
          </div>
        </div>
        <p className="text-sm text-gris-700 tabular-nums">
          <strong className="text-gris-900">48 min</strong> · 4×(4&apos; + 3&apos;) · 10 bloques
        </p>
        <div className="border-t border-gris-100 pt-3">
          <p className="text-xs uppercase tracking-wider text-gris-500 mb-1.5">
            Compatible con
          </p>
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-gris-700">
            <li>Zwift</li>
            <li className="text-gris-300">·</li>
            <li>TrainingPeaks Virtual</li>
            <li className="text-gris-300">·</li>
            <li>TrainerRoad</li>
            <li className="text-gris-300">·</li>
            <li>Wahoo SYSTM</li>
            <li className="text-gris-300">·</li>
            <li>MyWhoosh</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Bloque "Tus números, no los de un manual": muestra cómo cada bloque del
 * SessionBuilder presenta los rangos bpm (Karvonen) y vatios (Coggan)
 * personalizados. 3 cards lado a lado representando una zona suave (Z2),
 * una de umbral (Z4) y una sprint (Z6).
 */
function PersonalizedRanges(): JSX.Element {
  return (
    <section aria-labelledby="personalized-ranges-title" className="bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <h2
          id="personalized-ranges-title"
          className="font-display text-gris-800 text-3xl md:text-4xl text-center mb-3"
        >
          Tus números, <span className="text-turquesa-600">no los de un manual</span>
        </h2>
        <p className="text-center text-gris-600 max-w-2xl mx-auto mb-10">
          Cada bloque de tu sesión muestra el rango exacto que <strong>a ti</strong>{' '}
          te corresponde — pulsaciones siempre, vatios si haces bici con
          potenciómetro, ritmo si corres. Sabes cuándo subir, cuándo aguantar y
          cuándo soltar.
        </p>
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <ZoneRangeCard
            zone={2}
            zoneName="Aeróbico base"
            duration="12 min"
            bpm="122-138"
            watts="145-195"
            description="Pedaleo continuo, conversación posible. Construye base."
          />
          <ZoneRangeCard
            zone={4}
            zoneName="Umbral"
            duration="4 min"
            bpm="152-168"
            watts="235-275"
            description="Justo en el filo. Sostenible si no te pasas."
          />
          <ZoneRangeCard
            zone={6}
            zoneName="Sprint"
            duration="30 s"
            bpm=">168"
            watts=">315"
            description="Anaeróbico puro. Pocos segundos a tope."
          />
        </div>
        <p className="text-center text-xs text-gris-500 mt-6">
          Calculado con Karvonen (FC reserva), Coggan (% FTP) en bici y Minetti
          (coste energético) en carrera. Editable bloque a bloque.
        </p>
      </div>
    </section>
  );
}

interface ZoneRangeCardProps {
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  zoneName: string;
  duration: string;
  bpm: string;
  watts: string;
  description: string;
}

function ZoneRangeCard({
  zone,
  zoneName,
  duration,
  bpm,
  watts,
  description,
}: ZoneRangeCardProps): JSX.Element {
  const ZONE_BG: Record<number, string> = {
    1: 'bg-zone-1',
    2: 'bg-zone-2',
    3: 'bg-zone-3',
    4: 'bg-zone-4',
    5: 'bg-zone-5',
    6: 'bg-zone-6',
  };
  const TEXT_ON_BG: Record<number, string> = {
    1: 'text-white',
    2: 'text-gris-900',
    3: 'text-gris-900',
    4: 'text-white',
    5: 'text-white',
    6: 'text-white',
  };
  const bg = ZONE_BG[zone] ?? 'bg-zone-3';
  const txt = TEXT_ON_BG[zone] ?? 'text-white';
  return (
    <article className="bg-white border-2 border-gris-200 rounded-xl p-5 shadow-sm hover:border-turquesa-300 transition-colors">
      <header className="flex items-center justify-between mb-3 gap-2">
        <span
          className={`flex items-center justify-center rounded-md ${bg} ${txt} px-2.5 py-1 font-bold text-sm`}
        >
          Z{zone}
        </span>
        <span className="text-xs font-semibold text-gris-500 uppercase tracking-wider">
          {duration}
        </span>
      </header>
      <h3 className="font-display text-gris-800 text-xl mb-3">{zoneName}</h3>
      <ul className="space-y-1.5 mb-3 tabular-nums">
        <li className="flex items-center gap-2 text-gris-700">
          <MaterialIcon name="monitor_heart" size="small" className="text-rosa-500" />
          <span className="font-semibold">{bpm}</span>
          <span className="text-gris-500 text-sm">bpm</span>
        </li>
        <li className="flex items-center gap-2 text-gris-700">
          <MaterialIcon name="bolt" size="small" className="text-tulipTree-500" />
          <span className="font-semibold">{watts}</span>
          <span className="text-gris-500 text-sm">W</span>
        </li>
      </ul>
      <p className="text-sm text-gris-600 leading-snug">{description}</p>
    </article>
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
          Es lo que muestra el metaanálisis más completo sobre música y
          ejercicio: 139 estudios, 3.599 participantes (Terry et al. 2020).
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
            accent="gold"
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
  /**
   * Acento cromatico opcional. Cuando es 'gold' la card se pinta con dorado
   * (border superior, icono y stat en tulipTree) en vez del turquesa por
   * defecto. Pensado para destacar UNA card del trio sin romper la jerarquia
   * cromatica del design-system.
   */
  accent?: 'gold';
}

function EvidenceCard({
  icon,
  title,
  stat,
  desc,
  citation,
  doi,
  n,
  accent,
}: EvidenceCardProps): JSX.Element {
  const isGold = accent === 'gold';
  const borderClasses = isGold
    ? 'border border-gris-200 border-t-4 border-t-tulipTree-400'
    : 'border border-gris-200';
  const iconColor = isGold ? 'text-tulipTree-600' : 'text-turquesa-600';
  const statColor = isGold ? 'text-tulipTree-600' : 'text-turquesa-600';
  const linkColor = isGold ? 'text-tulipTree-600' : 'text-turquesa-700';
  return (
    <article className={`bg-white ${borderClasses} rounded-xl p-6 shadow-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <MaterialIcon name={icon} size="large" className={iconColor} />
        <h3 className="font-display text-gris-800 text-xl">{title}</h3>
      </div>
      <p className={`font-display ${statColor} text-3xl mb-2`}>{stat}</p>
      <p className="text-gris-700 mb-4">{desc}</p>
      <p className="text-xs text-gris-500">
        Fuente:{' '}
        <a
          href={`https://doi.org/${doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkColor} hover:underline`}
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
  const PROOFS = [
    {
      num: '01',
      icon: 'cloud_off',
      title: 'Sin servidores ni base de datos',
      body: 'El cálculo de potencia, la segmentación y el matching musical ocurren dentro de tu navegador.',
    },
    {
      num: '02',
      icon: 'no_accounts',
      title: 'Sin registros obligatorios',
      body: 'No pides correo, no creas cuenta, no recuperas contraseña. Si quieres, puedes conectar Google Drive opcionalmente para sincronizar tus ajustes y sesiones entre dispositivos — viajan a una carpeta privada tuya, nunca pasan por nosotros.',
    },
    {
      num: '03',
      icon: 'code',
      title: 'Código fuente abierto y auditable',
      body: 'Cualquiera puede leer cómo funciona Cadencia, verificarlo y proponer mejoras.',
    },
  ] as const;

  return (
    <section aria-labelledby="privacy-title" className="relative bg-white overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -left-8 h-48 w-48 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, #00bec8 1.2px, transparent 1.2px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-8 h-48 w-48 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #00bec8 1.2px, transparent 1.2px)',
          backgroundSize: '14px 14px',
        }}
      />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-turquesa-700">
              <MaterialIcon name="lock" size="small" />
              Privacidad
            </p>

            <h2
              id="privacy-title"
              className="mb-7 font-display text-4xl leading-[1.05] text-gris-800 md:text-5xl"
            >
              Tus datos
              <br />
              <span className="text-turquesa-600">no salen</span> de aquí.
            </h2>

            <ul className="mb-8 space-y-2.5 text-lg text-gris-700 max-w-md">
              <li>
                No tenemos{' '}
                <span className="text-gris-400 line-through decoration-turquesa-600 decoration-[2px] underline-offset-2">
                  servidores
                </span>
                .
              </li>
              <li>
                No tenemos{' '}
                <span className="text-gris-400 line-through decoration-turquesa-600 decoration-[2px] underline-offset-2">
                  cuentas
                </span>
                .
              </li>
              <li>
                No tenemos{' '}
                <span className="text-gris-400 line-through decoration-turquesa-600 decoration-[2px] underline-offset-2">
                  cookies de seguimiento
                </span>
                .
              </li>
            </ul>

            <div className="border-t border-gris-200 pt-6 max-w-md">
              <p className="flex gap-3 text-base leading-relaxed text-gris-600">
                <MaterialIcon name="bolt" size="small" className="mt-1 shrink-0 text-tulipTree-500" />
                <span>
                  Solo nos conectamos a Spotify cuando{' '}
                  <span className="font-semibold text-gris-800">tú</span> decides crear la lista, y únicamente para añadir canciones a tu cuenta. Tus datos físicos, tu GPX y tu ruta nunca salen de tu navegador.
                </span>
              </p>
            </div>
          </div>

          <ul className="space-y-3.5">
            {PROOFS.map(({ num, icon, title, body }) => (
              <li
                key={num}
                className="group relative overflow-hidden rounded-xl border border-gris-200 bg-white p-5 pl-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-turquesa-400 hover:shadow-[0_8px_24px_-12px_rgba(0,190,200,0.45)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-5 bottom-5 w-1 rounded-r-full bg-turquesa-600 transition-all duration-200 group-hover:top-3 group-hover:bottom-3"
                />
                <div className="flex items-start gap-4">
                  <div className="flex shrink-0 flex-col items-center pt-0.5">
                    <span className="font-display text-2xl leading-none text-turquesa-700">{num}</span>
                    <MaterialIcon name={icon} size="medium" className="mt-2 text-turquesa-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-base font-semibold text-gris-800">{title}</h3>
                    <p className="text-sm leading-relaxed text-gris-600">{body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Las preguntas top que mas peso tienen en la decision del usuario al llegar
// a la landing. Premium va primero porque es el unico filtro de salida duro:
// quien no tenga Premium debe enterarse antes de invertir tiempo explorando
// el resto. Despues: bici (modalidad fundadora), running (incorporacion
// reciente, hay que afirmarla explicitamente) y Zwift (interoperabilidad con
// la herramienta que ya usan). El resto del FAQ vive en /ayuda/spotify.
const FAQ_ITEMS: readonly { q: string; a: string | readonly string[] }[] = [
  {
    q: '¿Funciona sin Spotify Premium?',
    a: 'No. Cadencia necesita Spotify Premium para poder conectarte a tu cuenta, crear la lista y reproducirla en el orden establecido para que se sincronice con tu sesión de entrenamiento.',
  },
  {
    q: '¿Cómo puedo escuchar mi música en ruta?',
    a: [
      'En España (Reglamento General de Circulación, art. 18.2) está prohibido conducir cualquier vehículo, bici incluida, con auriculares conectados a un reproductor de sonido. La sanción son 200 € y 3 puntos del carné de coche. La prohibición abarca también los auriculares de conducción ósea, porque la norma no distingue por tipo.',
      'Opciones legales: altavoz Bluetooth montado en el manillar o en el cuadro, o un altavoz portátil en la mochila o en el bolsillo del maillot.',
      'Para sesiones indoor (rodillo, bici estática, Modo TV) no hay restricción: ahí los auriculares son perfectos.',
    ],
  },
  {
    q: '¿Sirve para entrenar en interior (rodillo o bici estática)?',
    a: [
      'Sí. Además de procesar GPX al aire libre (rutas en bici o carreras a pie), Cadencia tiene un constructor de sesiones en sala: armas tu rutina por bloques (calentamiento, intervalos, recuperación, sprints) desde cero o partiendo de plantillas científicas — Noruego 4×4 y SIT en bici, Yasso 800 y Daniels en carrera, entre otras — y la app te genera la lista sincronizada con cada bloque.',
      'Hay un Modo TV pantalla completa para seguir la sesión desde una tablet sobre el manillar (bici en rodillo) o frente a la cinta.',
    ],
  },
  {
    q: '¿Sirve también para correr?',
    a: [
      'Sí. Cadencia trabaja con bici y con carrera a pie por igual. En carrera estimamos la intensidad de cada tramo del GPX según la pendiente del terreno (modelo de coste energético de Minetti), y construimos las zonas a partir de tu frecuencia cardíaca.',
      'No necesitas potenciómetro ni sensores especiales: con tu pulsómetro (o tu edad y sexo si no tienes) basta. Las plantillas de carrera incluyen Yasso 800, intervalos de Daniels, Tempo y rodaje largo en Z2.',
    ],
  },
  {
    q: '¿Es compatible con Zwift, TrainerRoad o TrainingPeaks?',
    a: [
      'Sí, en bici. Cadencia exporta tu sesión en formato .zwo (estándar abierto de sesiones) y también importa cualquier .zwo ajeno.',
      'Funciona con Zwift, TrainerRoad, Wahoo SYSTM, MyWhoosh y TrainingPeaks Virtual. Puedes construir aquí, exportar para entrenar en tu rodillo, o traerte una sesión ya hecha y darle música sincronizada.',
    ],
  },
] as const;

function Faq(): JSX.Element {
  // Structured data: FAQPage. Google puede mostrarlas como rich-snippets
  // en los resultados de busqueda. Fuente unica de verdad: FAQ_ITEMS.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: typeof item.a === 'string' ? item.a : item.a.join(' '),
      },
    })),
  };

  return (
    <section aria-labelledby="faq-title" className="bg-gris-50">
      <script
        type="application/ld+json"
        // Inline JSON-LD: dangerouslySetInnerHTML evita escape de comillas que
        // rompe el parsing del crawler.
        // El .replace de "<" a "\\u003c" es defensa en profundidad: sin el,
        // un texto del FAQ que contenga "</script>" cierra el script antes
        // de tiempo y abre vector XSS. Hoy el contenido es hardcoded y seguro,
        // pero es el patron estandar para JSON-LD inline.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd)
            .replace(/&/g, '\\u0026')
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e'),
        }}
      />
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
              <div className="mt-3 space-y-2">
                {(typeof item.a === 'string' ? [item.a] : item.a).map((para, i) => (
                  <p key={i} className="text-gris-700">{para}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
        <div className="mt-6 text-center">
          <a
            href="/ayuda/spotify"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/spotify');
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-turquesa-600 hover:text-turquesa-700 transition-colors"
          >
            Ver todas las preguntas
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * PlanningCalendar: bloque que destaca la nueva funcionalidad de calendario de
 * planificacion (/calendario). Patron visual hermano de InteropZwo y del bloque
 * Intro: 2 columnas en lg+ con copy a la izquierda (H2 + lista de beneficios
 * con MaterialIcon turquesa) y un mockup flotante a la derecha (CalendarMockup).
 *
 * El H2 sigue el patron "frase + span turquesa-600" usado en Intro/InteropZwo
 * para coherencia visual. La lista de 4 beneficios cubre los 4 ejes del
 * producto: tipos de evento, modalidad en sala/al aire libre, integración en cabecera
 * con TodayBadge y sincronizacion con Drive.
 *
 * Footer pequeno reafirma la promesa "funciona local sin Drive, sincroniza si
 * lo conectas" — alinea con el bloque Privacy de la propia landing.
 */
function PlanningCalendar(): JSX.Element {
  return (
    <section aria-labelledby="planning-calendar-title" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-[1.1fr,1fr] gap-8 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <h2
              id="planning-calendar-title"
              className="font-display text-gris-800 text-3xl md:text-4xl mb-4"
            >
              Tu plan, <span className="text-turquesa-600">semana a semana</span>
            </h2>
            <p className="text-lg text-gris-700 mb-6 max-w-xl lg:mx-0 mx-auto">
              Apunta tus rutas, carreras y sesiones en casa en el calendario.
              Cadencia te las recuerda y, cuando llegue el día, te las carga
              listas para empezar.
            </p>
            <ul className="space-y-3 mb-2 max-w-xl mx-auto lg:mx-0 text-left">
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="event_repeat" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>Un día suelto o fijos en tu semana — los martes y jueves, sin ir más lejos.</span>
              </li>
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="directions_bike" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>En casa cargas el plan entero; para salir a la calle te dejas el enlace de Strava o Komoot a mano.</span>
              </li>
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="notifications_active" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>El próximo entreno lo tienes siempre a la vista en la cabecera.</span>
              </li>
              <li className="flex gap-3 text-base md:text-lg text-gris-700">
                <MaterialIcon name="cloud_sync" className="text-turquesa-600 mt-0.5 shrink-0" />
                <span>Si conectas Drive, viaja contigo entre el móvil y el portátil.</span>
              </li>
            </ul>
          </div>
          <div className="flex justify-center w-full">
            <div className="w-full max-w-sm sm:max-w-md">
              <CalendarMockup />
            </div>
          </div>
        </div>
        <p className="text-xs text-gris-500 mt-6 text-center">
          Funciona localmente sin Drive. Si lo conectas, tu calendario viaja
          entre tu móvil y tu portátil.
        </p>
      </div>
    </section>
  );
}

/**
 * Mock visual del calendario: card flotante con vista lista (3 entradas
 * hardcodeadas) que ilustra los dos tipos de evento (en sala / al aire libre) y el
 * concepto de recurrencia. Hermano de HeroMockup y ZwoMockup en lenguaje
 * visual: white bg, rounded-2xl, shadow-xl, border gris-200, micro-rotacion
 * que se neutraliza en hover.
 *
 * Cada fila combina:
 *   - Icono con color temático (turquesa para sala, tulipTree para aire libre).
 *   - Etiqueta de dia ("Hoy" / "Mañana" / "Jueves") en font-semibold gris-800.
 *   - Titulo del evento entre comillas tipograficas.
 *   - Chip de tipo (sala / aire libre) con icono auxiliar (event_repeat para
 *     entradas recurrentes, enlace externo para aire libre con URL).
 */
function CalendarMockup(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md transform rotate-0 sm:-rotate-1 transition-transform duration-300 hover:rotate-0"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gris-200 p-5 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gris-500 mb-0.5">
              Tu calendario
            </p>
            <p className="font-display text-lg text-gris-800 leading-tight truncate">
              Próximos entrenos
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-turquesa-700 bg-turquesa-100 border border-turquesa-300 px-2.5 py-1 rounded-full whitespace-nowrap">
            <MaterialIcon name="calendar_today" size="small" />
            Esta semana
          </span>
        </header>

        <ul className="space-y-2.5">
          {/* Hoy: sesión en sala concreta (no recurrente) */}
          <li className="flex items-center gap-3 p-3 rounded-lg bg-turquesa-50 border border-turquesa-100">
            <span className="flex items-center justify-center rounded-md bg-turquesa-600 text-white w-10 h-10 flex-shrink-0">
              <MaterialIcon name="directions_bike" size="medium" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-turquesa-700">
                  Hoy
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-turquesa-700 bg-white border border-turquesa-200 px-1.5 py-0.5 rounded">
                  En sala
                </span>
              </div>
              <p className="text-sm font-semibold text-gris-800 truncate">
                «Noruego 4×4»
              </p>
            </div>
          </li>

          {/* Manana: carrera al aire libre con enlace a Strava */}
          <li className="flex items-center gap-3 p-3 rounded-lg bg-gris-50 border border-gris-200">
            <span className="flex items-center justify-center rounded-md bg-tulipTree-500 text-white w-10 h-10 flex-shrink-0">
              <MaterialIcon name="directions_run" size="medium" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gris-700">
                  Mañana
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-tulipTree-600 bg-white border border-tulipTree-200 px-1.5 py-0.5 rounded">
                  Aire libre
                </span>
              </div>
              <p className="text-sm font-semibold text-gris-800 truncate">
                «Vuelta al pantano»
              </p>
              <p className="text-xs text-gris-500 inline-flex items-center gap-0.5">
                Strava
                <MaterialIcon name="open_in_new" size="small" decorative />
              </p>
            </div>
          </li>

          {/* Jueves: sesion en sala recurrente (todos los jueves) */}
          <li className="flex items-center gap-3 p-3 rounded-lg bg-gris-50 border border-gris-200">
            <span className="flex items-center justify-center rounded-md bg-turquesa-600 text-white w-10 h-10 flex-shrink-0">
              <MaterialIcon name="directions_bike" size="medium" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gris-700">
                  Jueves
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-turquesa-700 bg-white border border-turquesa-200 px-1.5 py-0.5 rounded">
                  En sala
                </span>
                <span
                  className="inline-flex items-center text-turquesa-600"
                  title="Evento recurrente"
                >
                  <MaterialIcon name="event_repeat" size="small" />
                </span>
              </div>
              <p className="text-sm font-semibold text-gris-800 truncate">
                «Z2 continuo»
              </p>
            </div>
          </li>
        </ul>

        <div className="border-t border-gris-100 pt-3 flex items-center justify-between">
          <p className="text-xs text-gris-500">
            3 entradas · Esta semana
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-turquesa-700">
            Ver todo
            <MaterialIcon name="arrow_forward" size="small" decorative />
          </span>
        </div>
      </div>
    </div>
  );
}

function FinalCta({ onTry }: { onTry: () => void }): JSX.Element {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="bg-gradient-to-b from-turquesa-50 to-turquesa-100"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16 text-center">
        <h2
          id="final-cta-title"
          className="font-display text-turquesa-700 text-3xl md:text-4xl mb-4"
        >
          ¿Listo para entrenar con ritmo?
        </h2>
        <p className="text-gris-700 mb-6 text-lg">
          Tarda menos de un minuto en generarte la lista.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={onTry}
          iconRight="auto_fix_high"
          aria-label="Crear mi sesión en Cadencia"
          className="uppercase tracking-wide"
        >
          Crear mi sesión
        </Button>
      </div>
    </section>
  );
}

