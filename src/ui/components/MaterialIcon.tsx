import type { CSSProperties } from 'react';

const SIZE_PX: Record<MaterialIconSize, number> = {
  small: 18,
  medium: 24,
  large: 36,
  xlarge: 48,
};

export type MaterialIconSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface MaterialIconProps {
  /** Nombre del icono (ej: 'fitness_center', 'check_circle'). Ver fonts.google.com/icons */
  name: string;
  size?: MaterialIconSize;
  className?: string;
  /**
   * Si el icono es la unica fuente de informacion (no hay texto al lado),
   * el padre debe poner aria-label y este componente debe ser aria-hidden=false.
   * Por defecto el icono es decorativo (true).
   */
  decorative?: boolean;
  style?: CSSProperties;
}

/**
 * Wrapper tipado de Material Icons. El design-system es estricto:
 * iconografia con Material Icons, nunca emojis.
 */
export function MaterialIcon({
  name,
  size = 'medium',
  className = '',
  decorative = true,
  style,
}: MaterialIconProps): JSX.Element {
  const sizePx = SIZE_PX[size];
  return (
    <span
      className={`material-icons leading-none align-middle ${className}`.trim()}
      style={{ fontSize: `${sizePx}px`, ...style }}
      aria-hidden={decorative}
    >
      {name}
    </span>
  );
}
