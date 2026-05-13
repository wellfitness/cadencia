import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { SpotifyCallback } from './ui/pages/SpotifyCallback';
import { migrateLegacyStorageOnce } from './ui/state/migrateLegacyStorage';
import { init as initGDriveSync } from './integrations/gdrive/sync';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Migracion one-shot del storage legacy a cadenciaStore. Idempotente:
// si ya hay datos en cadenciaStore o no hay datos legacy, es no-op.
// Debe ejecutarse ANTES de que App() lea el state inicial.
migrateLegacyStorageOnce();

// Motor de sync con Google Drive. Si el usuario estaba conectado, hace
// silent sync al arrancar. Si no, registra los listeners para que un
// futuro connect() funcione. Idempotente.
void initGDriveSync();

// Auto-reload tras update del Service Worker. vite-plugin-pwa con
// `registerType: 'autoUpdate'` ya inyecta skipWaiting + clientsClaim,
// asi que el nuevo SW activa nada mas estar disponible. Pero los assets
// JS ya cargados en memoria (incluido este mismo bundle) siguen siendo
// los viejos hasta que el usuario refresque. Sin este listener, los
// usuarios con la PWA instalada podrian estar atrapados en una version
// antigua durante dias hasta que cierren completamente la app.
//
// El flag `refreshing` evita bucles si el navegador dispara
// controllerchange multiples veces durante la activacion.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Ruteo minimo: si la URL es /callback servimos la pagina del callback OAuth
// (sin shell del wizard). En el resto, la App normal.
const isCallback = window.location.pathname === '/callback';

createRoot(rootElement).render(
  <StrictMode>{isCallback ? <SpotifyCallback /> : <App />}</StrictMode>,
);
