import { MaterialIcon } from '@ui/components/MaterialIcon';
import { navigateInApp } from '@ui/utils/navigation';

interface NavCardProps {
  href: string;
  icon: string;
  title: string;
  desc: string;
  badge?: { text: string; tone: 'rosa' | 'turquesa' | 'dorado' };
  isPrincipal?: boolean;
  iconColorClass?: string;
  borderColorClass?: string;
}

function NavCard({
  href,
  icon,
  title,
  desc,
  badge,
  isPrincipal = false,
  iconColorClass = 'text-turquesa-400',
  borderColorClass = 'border-l-turquesa-600',
}: NavCardProps): JSX.Element {
  const principalBorder = isPrincipal
    ? 'border border-turquesa-700 border-l-[3px] border-l-turquesa-400'
    : `border border-gris-700 border-l-[3px] ${borderColorClass}`;

  const titleColor = isPrincipal ? 'text-white' : 'text-gris-200';

  const badgeClass: Record<NonNullable<typeof badge>['tone'], string> = {
    rosa: 'text-rosa-400 bg-rosa-500/15',
    turquesa: 'text-turquesa-400 bg-turquesa-500/15',
    dorado: 'text-gris-900 bg-gradient-to-br from-tulipTree-400 to-tulipTree-500 font-semibold',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-4 py-3 bg-white/5 ${principalBorder} rounded-lg hover:bg-white/10 hover:border-turquesa-500 transition-colors no-underline`}
    >
      <MaterialIcon
        name={icon}
        size="medium"
        className={`${iconColorClass} shrink-0`}
        decorative
      />
      <div className="flex-1 min-w-0">
        <strong className={`block text-sm font-semibold ${titleColor}`}>
          {title}
        </strong>
        <span className="text-xs text-gris-400 block">{desc}</span>
      </div>
      {badge ? (
        <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${badgeClass[badge.tone]}`}>
          {badge.text}
        </span>
      ) : (
        <MaterialIcon
          name="arrow_forward"
          size="small"
          className="text-turquesa-400 shrink-0"
          decorative
        />
      )}
    </a>
  );
}

interface SocialLinkProps {
  href: string;
  icon: string;
  label: string;
}

function SocialLink({ href, icon, label }: SocialLinkProps): JSX.Element {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="w-11 h-11 flex items-center justify-center bg-white/5 border border-gris-700 rounded-full text-turquesa-400 hover:bg-white/10 hover:border-turquesa-600 transition-colors"
    >
      <MaterialIcon name={icon} size="medium" decorative />
    </a>
  );
}

export function SiteFooter(): JSX.Element {
  return (
    <footer className="bg-gris-900 text-gris-300 px-4 pt-12 pb-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr_0.6fr] gap-6">

        {/* Columna 1: Tarjeta Elena */}
        <div className="bg-white/5 border border-turquesa-700 border-t-[3px] border-t-turquesa-400 rounded-2xl p-5">
          <div className="flex gap-3 mb-3">
            <img
              src="/elena-cruces.webp"
              alt="Elena Cruces"
              width={70}
              height={70}
              className="w-[70px] h-[70px] rounded-full object-cover border-2 border-turquesa-600 shrink-0"
            />
            <div>
              <h4 className="font-display text-turquesa-400 text-lg leading-none mb-1">
                Elena Cruces
              </h4>
              <p className="text-xs text-gris-300 leading-snug">
                Entrenadora de fuerza para mujeres +40 — Prevención y salud ósea
              </p>
              <p className="text-[11px] text-gris-400 mt-1">
                Vigo, Galicia — Online y presencial
              </p>
              <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full bg-turquesa-500/15 border border-turquesa-700 text-turquesa-400 text-[11px]">
                <MaterialIcon
                  name="workspace_premium"
                  size="small"
                  className="text-tulipTree-400 text-xs"
                  decorative
                />
                Certificada Nº 038020
              </span>
            </div>
          </div>
          <p className="text-xs text-gris-300 leading-relaxed mb-3">
            Más de 8 años ayudando a mujeres +40 a recuperar su fuerza,
            funcionalidad y confianza.
            <br />
            <strong className="text-white">
              Metodología científica + experiencia personal.
            </strong>
          </p>
          <div className="flex gap-2">
            <SocialLink
              href="https://t.me/movimientofuncional"
              icon="send"
              label="Telegram"
            />
            <SocialLink
              href="https://youtube.com/@movimientofuncional"
              icon="play_circle"
              label="YouTube"
            />
            <SocialLink
              href="https://www.linkedin.com/in/elena-cruces-movimientofuncional-net/"
              icon="work"
              label="LinkedIn"
            />
            <SocialLink
              href="https://www.instagram.com/movimientofuncional.es/"
              icon="photo_camera"
              label="Instagram"
            />
          </div>
        </div>

        {/* Columna 2: Navegacion ecosistema Movimiento Funcional */}
        <div>
          <h4 className="flex items-center gap-2 text-white text-base font-semibold mb-3">
            <MaterialIcon
              name="link"
              size="small"
              className="text-turquesa-400"
              decorative
            />
            Ecosistema Movimiento Funcional
          </h4>
          <div className="flex flex-col gap-2">
            <NavCard
              href="https://academia.movimientofuncional.app"
              icon="fitness_center"
              title="Odisea Antifrágil"
              desc="Tu academia de entrenamiento funcional"
              isPrincipal
            />
            <NavCard
              href="https://academia.movimientofuncional.app/entrena-tus-huesos"
              icon="directions_run"
              title="Entrena tu Hueso"
              desc="Guía práctica: impacto progresivo en casa"
              badge={{ text: 'Gratis', tone: 'rosa' }}
              iconColorClass="text-rosa-400"
              borderColorClass="border-l-rosa-400"
            />
            <NavCard
              href="https://academia.movimientofuncional.app/curso-menopausia"
              icon="school"
              title="Recupera tu Vitalidad"
              desc="Curso gratuito: menopausia y entrenamiento"
              badge={{ text: 'Gratis', tone: 'turquesa' }}
            />
            <NavCard
              href="https://movimientofuncional.app/proyecto-genesis"
              icon="star"
              title="Proyecto Génesis"
              desc="Tu punto de partida personalizado"
              badge={{ text: 'Curso de pago', tone: 'dorado' }}
              iconColorClass="text-tulipTree-400"
              borderColorClass="border-l-tulipTree-500"
            />
          </div>
        </div>

        {/* Columna 3: Ayuda + Legal + Proyecto */}
        <div className="flex flex-col">
          <h4 className="text-white text-base font-semibold mb-2">Ayuda</h4>
          <a
            href="/ayuda"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda');
            }}
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Centro de ayuda
          </a>
          <a
            href="/ayuda/sesion-indoor"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/sesion-indoor');
            }}
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Cómo construir una sesión
          </a>
          <a
            href="/ayuda/plantillas"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/ayuda/plantillas');
            }}
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Plantillas y cuándo usarlas
          </a>
          <a
            href="/preferencias"
            onClick={(e) => {
              e.preventDefault();
              navigateInApp('/preferencias');
            }}
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Mis preferencias
          </a>

          <h4 className="text-white text-base font-semibold mt-4 mb-2">Legal</h4>
          <a
            href="/terms.html"
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Términos de uso
          </a>
          <a
            href="/privacy.html"
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Política de privacidad
          </a>
          <a
            href="https://t.me/movimientofuncional"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            Contacto
          </a>

          <h4 className="text-white text-base font-semibold mt-4 mb-2">Proyecto</h4>
          <a
            href="https://github.com/wellfitness/cadencia"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            <MaterialIcon name="code" size="small" decorative />
            GitHub
          </a>
          <a
            href="https://github.com/wellfitness/cadencia/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gris-300 py-2.5 hover:text-turquesa-400 transition-colors"
          >
            <MaterialIcon name="gavel" size="small" decorative />
            Licencia PolyForm Noncommercial
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-turquesa-400 text-center">
        <p className="text-sm text-white">
          © 2026 MOVIMIENTO FUNCIONAL. Código abierto bajo Licencia PolyForm Noncommercial.
        </p>
      </div>
    </footer>
  );
}
