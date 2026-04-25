import type { HTMLAttributes, ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

export type CardVariant = 'default' | 'tip' | 'info';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Titulo opcional renderizado como h3 dentro del card. */
  title?: string;
  /** Icono Material opcional al lado del titulo. */
  titleIcon?: string;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-white border border-gris-200 shadow-sm',
  tip: 'bg-gradient-to-br from-turquesa-100 to-turquesa-50 border-l-4 border-turquesa-600',
  info: 'bg-gradient-to-br from-tulipTree-50 to-white border-l-4 border-tulipTree-500',
};

const TITLE_COLOR: Record<CardVariant, string> = {
  default: 'text-gris-800',
  tip: 'text-turquesa-700',
  info: 'text-tulipTree-600',
};

export function Card({
  variant = 'default',
  title,
  titleIcon,
  className = '',
  children,
  ...rest
}: CardProps): JSX.Element {
  return (
    <section
      className={`rounded-xl p-3 md:p-5 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...rest}
    >
      {title && (
        <h3
          className={`flex items-center gap-2 text-base md:text-lg font-semibold mb-2 md:mb-3 ${TITLE_COLOR[variant]}`}
        >
          {titleIcon && <MaterialIcon name={titleIcon} size="small" />}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
