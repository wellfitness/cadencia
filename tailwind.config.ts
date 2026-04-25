import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zone: {
          1: '#3b82f6',
          2: '#22c55e',
          3: '#eab308',
          4: '#f97316',
          5: '#ef4444',
        },
        bg: {
          DEFAULT: '#0d0d0d',
          elevated: '#1a1a1a',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
