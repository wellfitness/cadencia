import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { MaterialIcon } from './MaterialIcon';

export type ButtonVariant = 'primary' | 'critical' | 'secondary' | 'accent' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-turquesa-600 text-white border-turquesa-700 hover:bg-turquesa-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,190,200,0.3)] active:translate-y-0',
  critical:
    'bg-rosa-600 text-white border-rosa-700 hover:bg-rosa-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(225,29,72,0.3)] active:translate-y-0',
  secondary:
    'bg-white text-gris-700 border-gris-300 hover:bg-gris-50 hover:border-gris-400',
  // Acento dorado: para acciones secundarias distintivas (regenerar, exportar
  // .zwo, features info-tipo). NO destructivo, NO primary — un escalon entre.
  accent:
    'bg-white text-tulipTree-600 border-tulipTree-400 hover:bg-tulipTree-50 hover:border-tulipTree-500 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(234,179,8,0.25)] active:translate-y-0',
  // Dorado relleno: CTA llamativa que destaca sobre fondos visuales densos
  // (overlays sobre imagenes, hero). Texto gris-900 sobre amarillo-500 para
  // contraste AAA (~10:1). Hover sube un escalon de luminosidad.
  gold:
    'bg-tulipTree-500 text-gris-900 border-tulipTree-600 hover:bg-tulipTree-400 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(234,179,8,0.45)] active:translate-y-0',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-2 min-h-[36px]',
  // Touch target del design-system: 44px movil, 48px desktop
  md: 'text-base px-4 py-2.5 min-h-[44px] md:min-h-[48px]',
  lg: 'text-base px-6 py-3 min-h-[48px] md:min-h-[52px]',
  // CTA hero: extra grande, max conspicuidad sin perder proporcion en mobile
  xl: 'text-lg md:text-xl px-8 md:px-10 py-4 min-h-[56px] md:min-h-[64px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: string;
  iconRight?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    loading = false,
    fullWidth = false,
    disabled = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg border-2 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={`${baseClasses} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${widthClass} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <MaterialIcon name="progress_activity" size="small" className="animate-spin-slow" />
      ) : iconLeft ? (
        <MaterialIcon name={iconLeft} size="small" />
      ) : null}
      {children}
      {!loading && iconRight ? <MaterialIcon name={iconRight} size="small" /> : null}
    </button>
  );
});
