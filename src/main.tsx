import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { SpotifyCallback } from './ui/pages/SpotifyCallback';
import { migrateLegacyStorageOnce } from './ui/state/migrateLegacyStorage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Migracion one-shot del storage legacy a cadenciaStore. Idempotente:
// si ya hay datos en cadenciaStore o no hay datos legacy, es no-op.
// Debe ejecutarse ANTES de que App() lea el state inicial.
migrateLegacyStorageOnce();

// Ruteo minimo: si la URL es /callback servimos la pagina del callback OAuth
// (sin shell del wizard). En el resto, la App normal.
const isCallback = window.location.pathname === '/callback';

createRoot(rootElement).render(
  <StrictMode>{isCallback ? <SpotifyCallback /> : <App />}</StrictMode>,
);
