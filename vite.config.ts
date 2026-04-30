import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-64x64.png',
        'apple-touch-icon.png',
        'og-image.png',
        'robots.txt',
      ],
      manifest: {
        name: 'Cadencia — disfruta del cardio a tu ritmo',
        short_name: 'Cadencia',
        description:
          'Música de Spotify sincronizada con la intensidad de tu cardio, para corredores y ciclistas. Outdoor desde un GPX o indoor desde sesiones por bloques.',
        theme_color: '#00bec8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['fitness', 'sports', 'health', 'music'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@integrations': path.resolve(__dirname, './src/integrations'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    // Escuchar tambien en 127.0.0.1 (no solo localhost). Necesario para PKCE
    // de Spotify, que exige IP loopback explicita en HTTP de dev.
    host: '127.0.0.1',
  },
});
