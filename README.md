# Cadencia

> *disfruta del cardio a tu ritmo*

Webapp que sincroniza música de Spotify con la intensidad de tu cardio, para corredores y ciclistas. Outdoor desde un GPX o indoor desde sesiones por bloques.

> **Open source, abierto a colaboradores.** No hay backend, no hay base de datos, no hay registros: toda la lógica corre en cliente. Solo Spotify usa OAuth (PKCE, en el momento de crear la playlist).

## Qué puedes hacer

- **Subir un GPX de ruta** (Strava, Komoot, Garmin…) → la app estima la potencia por segmento de tu ruta y te genera una playlist Spotify donde cada canción encaja con la intensidad real de cada tramo.
- **Construir una sesión indoor cycling** desde cero o partiendo de plantillas científicas (SIT, HIIT, Noruego 4×4, Z2…) → la app genera la playlist sincronizada para esa sesión.
- **Modo TV** para sesiones indoor: pantalla completa con la sesión y la canción actual, ideal para usar en una tablet sobre el manillar.

## Stack

Vite + React 18 + TypeScript + Tailwind + Vitest + Playwright + Recharts + vite-plugin-pwa.

## Quick start

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5173
pnpm test         # Vitest unit
pnpm test:e2e     # Playwright (necesita 'pnpm test:e2e:install' la primera vez)
pnpm typecheck
pnpm lint
```

## Build y deploy

```bash
pnpm build              # → dist/  (subir a Hostinger /public_html via SFTP)
pnpm deploy             # subir dist/ por FTP (requiere .env.local)
pnpm deploy:full        # build + deploy en una sola tanda
```

La app se publica como webapp + PWA (instalable desde el navegador con "Añadir a pantalla de inicio") en [cadencia.movimientofuncional.app](https://cadencia.movimientofuncional.app).

## Modelo BYOC (Bring Your Own Client ID)

Cadencia funciona con BYOC: cada usuario crea **su propia app de Spotify** (gratis, 3 minutos en [developer.spotify.com](https://developer.spotify.com/dashboard)) y pega su **Client ID** dentro de Cadencia (modal guiado al pulsar «Crear playlist»). El Client ID se guarda en `localStorage` y solo lo configuras una vez.

**¿Por qué?** Spotify endureció el acceso a Extended Quota Mode el 15-mayo-2025 (exige ≥250.000 MAU + empresa registrada + revenue verificable). Para apps indie como Cadencia ese camino está cerrado. La salida es BYOC: cada usuario es dueño de su propia cuota de Development Mode (5 testers por Client ID, suficiente para uso personal).

**¿Qué necesita el usuario?**

1. Cuenta de Spotify **Premium**.
2. Tres minutos para crear su Client ID (la app le guía paso a paso con capturas).
3. Pegar el id en Cadencia. Listo.

## Self-hosting

Cadencia es 100% client-side y MIT. Puedes hostearla donde quieras (Hostinger, Netlify, Vercel, GitHub Pages, tu propio nginx). Pasos:

1. `git clone` este repo.
2. `cp .env.example .env.local` y configura los valores que necesites:
   - **`VITE_SPOTIFY_CLIENT_ID`**: opcional. Si lo dejas vacío, todos los usuarios irán por BYOC. Si lo pones, hasta 5 cuentas que tú autorices a mano en tu Developer Dashboard de Spotify podrán usar tu Client ID compartido.
   - **`VITE_GOOGLE_CLIENT_ID`**: opcional. Activa la sincronización con Drive (carpeta `appdata` privada del usuario).
3. **Si usas tu propio Client ID de Spotify**, registra en su dashboard (Settings → Redirect URIs) las URLs donde correrá Cadencia, por ejemplo:
   - `http://127.0.0.1:5173/callback` (desarrollo)
   - `https://tu-dominio.com/callback` (producción)
4. **Si usas tu propio Client ID de Google Drive**, autoriza tu dominio en su Cloud Console.
5. `pnpm install && pnpm build` y sube `dist/` a tu hosting.

Si tus usuarios traen su propio Client ID (BYOC puro), en su app de Spotify deben registrar el mismo Redirect URI de la URL donde tú alojes Cadencia.

## Estructura

- `src/core/` — Lógica pura (sin React, sin DOM): cálculos fisiológicos (Karvonen, Coggan, Gulati ♀ / Tanaka ♂), parser GPX, ecuación de potencia, motor de matching, plantillas de sesión. 100% unitestable.
- `src/integrations/spotify/` — Cliente OAuth PKCE de Spotify (único servicio externo con autenticación).
- `src/ui/` — Componentes React + Tailwind. Wizard de 5 pasos: Tipo → Datos → Ruta → Música → Resultado, además de Landing y Modo TV.
- `src/data/tracks/` — Librería por defecto: `all.csv` (catálogo unificado bundled) + `sources/` (listas fuente, recompiladas con `pnpm build:tracks`).

Para guías de contribución y reglas vinculantes del proyecto ver [CLAUDE.md](./CLAUDE.md).

## Licencia

[MIT License](./LICENSE).

Puedes usar, modificar y redistribuir el código libremente, incluido para uso comercial. La única condición es mantener el aviso de copyright original.

## Contribuir

Lee [CONTRIBUTING.md](./CONTRIBUTING.md) — todos los commits deben firmarse con DCO (`git commit -s`).
