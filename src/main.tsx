import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { SpotifyCallback } from './ui/pages/SpotifyCallback';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Ruteo minimo: si la URL es /callback servimos la pagina del callback OAuth
// (sin shell del wizard). En el resto, la App normal.
const isCallback = window.location.pathname === '/callback';

createRoot(rootElement).render(
  <StrictMode>{isCallback ? <SpotifyCallback /> : <App />}</StrictMode>,
);
