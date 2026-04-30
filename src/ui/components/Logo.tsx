export type LogoVariant = 'mark' | 'brand' | 'full';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
export type LogoOrientation = 'horizontal' | 'vertical';
export type LogoTone = 'light' | 'dark';

export interface LogoProps {
  /**
   * Que se muestra:
   * - 'mark': solo el simbolo (corazon con clave de sol y onda de pulso).
   *   Para favicon-like contexts.
   * - 'brand': simbolo + "Cadencia". Para Header / TopBar.
   * - 'full': simbolo + "Cadencia" + "by MOVIMIENTO FUNCIONAL". Para Hero / Footer / About.
   */
  variant?: LogoVariant;
  size?: LogoSize;
  /**
   * - 'horizontal' (default): mark a la izquierda, texto a la derecha.
   *   Pensado para Header, TopBar, badges en línea.
   * - 'vertical': mark arriba centrado, texto debajo. Pensado para Hero,
   *   pantallas de about, splash.
   */
  orientation?: LogoOrientation;
  /**
   * - 'light' (default): wordmark gris-900 + tagline gris-500. Para fondos claros.
   * - 'dark': wordmark blanco + tagline blanco/70. Para fondos oscuros (modo TV,
   *   pantallas de celebracion, hero con overlay oscuro).
   */
  tone?: LogoTone;
  className?: string;
}

const MARK_HEIGHT_BY_SIZE: Record<LogoSize, string> = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-14',
  xl: 'h-24 md:h-[7.2rem]',
};

const WORDMARK_SIZE_BY_SIZE: Record<LogoSize, string> = {
  sm: 'text-lg',
  md: 'text-[1.8rem] md:text-[2.25rem]',
  lg: 'text-3xl md:text-4xl',
  xl: 'text-[2.7rem] md:text-[3.6rem]',
};

const TAGLINE_SIZE_BY_SIZE: Record<LogoSize, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-sm md:text-base',
};

export function Logo({
  variant = 'brand',
  size = 'md',
  orientation = 'horizontal',
  tone = 'light',
  className = '',
}: LogoProps): JSX.Element {
  const markClass = MARK_HEIGHT_BY_SIZE[size];
  const wordmarkClass = WORDMARK_SIZE_BY_SIZE[size];
  const taglineClass = TAGLINE_SIZE_BY_SIZE[size];

  const isMarkOnly = variant === 'mark';
  const isVertical = orientation === 'vertical';
  const isDark = tone === 'dark';

  const wordmarkTone = isDark ? 'text-white' : 'text-gris-900';
  const taglineTone = isDark ? 'text-white/70' : 'text-gris-500';

  const containerClass = isVertical
    ? 'flex flex-col items-center gap-3'
    : 'flex items-center gap-2';

  const textBlockClass = isVertical
    ? 'flex flex-col items-center text-center leading-none'
    : 'flex flex-col leading-none';

  return (
    <div className={`${containerClass} ${className}`}>
      {isDark ? (
        // Sobre fondo oscuro el PNG (silueta negra) se confundiría con el
        // fondo. Lo renderizamos via CSS mask-image: el alpha del PNG actúa
        // como recorte y el `bg-white` rellena la silueta. Así el mismo
        // asset sirve para ambos tonos sin generar un PNG extra. El logo es
        // cuadrado (1280×1280) por lo que aspect-square no distorsiona.
        <div
          role={isMarkOnly ? 'img' : undefined}
          aria-label={isMarkOnly ? 'Cadencia' : undefined}
          aria-hidden={!isMarkOnly}
          className={`${markClass} aspect-square select-none bg-white`}
          style={{
            WebkitMaskImage: 'url(/logo.png)',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskImage: 'url(/logo.png)',
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            maskPosition: 'center',
          }}
        />
      ) : (
        <img
          src="/logo.png"
          alt={isMarkOnly ? 'Cadencia' : ''}
          aria-hidden={!isMarkOnly}
          className={`${markClass} w-auto select-none`}
          draggable={false}
        />
      )}
      {variant !== 'mark' && (
        <div className={textBlockClass}>
          <span
            className={`font-display ${wordmarkTone} ${wordmarkClass} leading-none`}
          >
            Cadencia
          </span>
          {variant === 'full' && (
            <span
              className={`${taglineTone} ${taglineClass} mt-1 tracking-widest uppercase`}
            >
              by Movimiento Funcional
            </span>
          )}
        </div>
      )}
    </div>
  );
}
