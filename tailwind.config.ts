import type { Config } from 'tailwindcss';

/**
 * Paleta del design-system Movimiento Funcional.
 * Convive con la paleta semantica de zonas (Z1..Z5) reservada exclusivamente
 * para visualizacion de datos (charts, gauges, ZoneBadge).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: turquesa = primary CTAs, navegacion, focus rings
        turquesa: {
          50: '#e6fffd',
          100: '#cdfffb',
          200: '#9efff8',
          400: '#18f8f6',
          500: '#04dadb',
          600: '#00bec8',
          700: '#088b96',
          800: '#0c6f78',
        },
        // Critical: rosa = acciones destructivas, advertencias graves
        rosa: {
          100: '#ffe4e9',
          400: '#fb7185',
          500: '#e11d48',
          600: '#e11d48',
          700: '#be123c',
        },
        // Info: dorado = tips, datos complementarios
        tulipTree: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        // Neutrales
        gris: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // Estados sistema
        success: {
          DEFAULT: '#10b981',
          light: '#d1fae5',
          dark: '#047857',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
          dark: '#d97706',
        },
        error: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
          dark: '#dc2626',
        },
        // Zonas: SOLO para visualizacion de datos (gauges, charts, badges)
        zone: {
          1: '#3b82f6',
          2: '#22c55e',
          3: '#eab308',
          4: '#f97316',
          5: '#ef4444',
          6: '#7c2d12',
        },
      },
      fontFamily: {
        // Solo H1/H2 y elementos display (logo, hero)
        display: ['Righteous', 'system-ui', 'sans-serif'],
        // Cuerpo, formularios, botones, texto general
        sans: ['ABeeZee', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      // Tipografia escala 1.25 (ver design-system)
      fontSize: {
        // Tamanos derivados del design-system
        'ds-base': ['1rem', { lineHeight: '1.6' }],     // 16px
        'ds-h3': ['1.25rem', { lineHeight: '1.3' }],    // 20px
        'ds-h2': ['1.5625rem', { lineHeight: '1.2' }],  // 25px
        'ds-h1': ['1.9375rem', { lineHeight: '1.2' }],  // 31px
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)', // ease-out
      },
      keyframes: {
        // Fade-in suave para revelados (disclosure paneles, banners de
        // confirmacion). Todas las clases que lo usan deben envolverse en
        // motion-safe: para respetar prefers-reduced-motion.
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
