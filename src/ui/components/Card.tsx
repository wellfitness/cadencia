import { useId, type HTMLAttributes, type ReactNode } from 'react';
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
  default: 'bg-white border border-gris-200 border-l-4 border-l-transparent shadow-sm',
  tip: 'bg-gradient-to-br from-turquesa-100 to-turquesa-50 border border-transparent border-l-4 border-l-turquesa-600',
  info: 'bg-gradient-to-br from-tulipTree-50 to-white border border-transparent border-l-4 border-l-tulipTree-500',
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
  // Si hay titulo lo conectamos via aria-labelledby para que la <section>
  // tenga nombre accesible. Si no hay titulo, usamos un <div> (una <section>
  // sin nombre accesible es un anti-patron WAI-ARIA).
  const reactId = useId();
  const titleId = `${reactId}-card-title`;
  const sectionProps = title ? { 'aria-labelledby': titleId } : undefined;
  const Wrapper = title ? 'section' : 'div';

  return (
    <Wrapper
      className={`rounded-xl p-3 md:p-5 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...sectionProps}
      {...rest}
    >
      {title && (
        <h3
          id={titleId}
          className={`flex items-center gap-2 text-base md:text-lg font-semibold mb-2 md:mb-3 ${TITLE_COLOR[variant]}`}
        >
          {titleIcon && <MaterialIcon name={titleIcon} size="small" />}
          {title}
        </h3>
      )}
      {children}
    </Wrapper>
  );
}
