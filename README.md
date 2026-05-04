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

Cadencia funciona con **BYOC puro**: cada persona que use la app crea **su propia app de Spotify** (gratis, 3 minutos en [developer.spotify.com](https://developer.spotify.com/dashboard)) y pega su **Client ID** dentro de Cadencia. El wizard guiado se abre solo al pulsar «Crear playlist» por primera vez. El Client ID queda guardado en `localStorage` del navegador del usuario.

### ¿Por qué BYOC y no un Client ID compartido?

Spotify endureció su política el **15 de mayo de 2025**:

- **Extended Quota Mode** (acceso para apps con tracción real) ahora exige ser **organización legalmente registrada** + **≥ 250.000 MAU** + **revenue verificable** + servicio activo. Para una app indie sin SL ni monetización, este camino está cerrado de facto.
- En paralelo, **Development Mode** quedó limitado a **5 cuentas autorizadas por Client ID** (antes eran 25).

Esto crea un círculo vicioso: para llegar a 250k MAU necesitas mostrar la app a mucha gente, pero solo puedes mostrarla a 4 personas más. La salida es **BYOC**: cada usuario tiene su propia app de Spotify y sus propios 5 huecos de testers, sin pasar por una lista central que el operador del repo tendría que curar a mano.

### Qué necesita el usuario

1. Cuenta de Spotify **Premium**.
2. Tres minutos para crear su Client ID y añadir su email a «Users and Access» (la app le guía paso a paso con capturas reales).
3. Pegar el Client ID en Cadencia. Listo.

### Qué NO necesita el operador del repo

Nada relacionado con Spotify. El código no lee `VITE_SPOTIFY_CLIENT_ID`, no hay fallback compartido, no hay lista de testers que mantener. Quien despliegue Cadencia (Hostinger, Netlify, Vercel, su propio nginx) se preocupa solo del build y el dominio; cada usuario hace su propia configuración del lado de Spotify.

## Self-hosting

Cadencia es 100% client-side y MIT. Puedes hostearla donde quieras. Pasos:

1. `git clone` este repo.
2. `cp .env.example .env.local` y, si quieres, configura `VITE_GOOGLE_CLIENT_ID` para activar la sincronización opcional con Drive (carpeta `appdata` privada del usuario). Para Spotify no hay variable que configurar.
3. `pnpm install && pnpm build` y sube `dist/` a tu hosting.

**Importante para tus usuarios**: cuando creen su app de Spotify, deben registrar como Redirect URI la URL EXACTA del dominio donde tú alojas Cadencia (por ejemplo `https://tu-dominio.com/callback`). El wizard del modal BYOC ya muestra esa URL dinámicamente leyéndola de `window.location.origin`, así que el usuario solo tiene que copiarla del modal y pegarla en su dashboard de Spotify.

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
