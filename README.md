# Cadencia

> *para ciclistas con ritmo*

Webapp que sincroniza música de Spotify con la intensidad de tus entrenamientos en bici. Outdoor desde un GPX o indoor desde sesiones por bloques.

> **Source-available, open a colaboradores.** No hay backend, no hay base de datos, no hay registros: toda la lógica corre en cliente. Solo Spotify usa OAuth (PKCE, en el momento de crear la playlist).

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

## Estructura

- `src/core/` — Lógica pura (sin React, sin DOM): cálculos fisiológicos (Karvonen, Coggan, Gulati ♀ / Tanaka ♂), parser GPX, ecuación de potencia, motor de matching, plantillas de sesión. 100% unitestable.
- `src/integrations/spotify/` — Cliente OAuth PKCE de Spotify (único servicio externo con autenticación).
- `src/ui/` — Componentes React + Tailwind. Wizard de 5 pasos: Tipo → Datos → Ruta → Música → Resultado, además de Landing y Modo TV.
- `src/data/tracks/` — CSVs de Spotify embebidos como librería por defecto.

Para guías de contribución y reglas vinculantes del proyecto ver [CLAUDE.md](./CLAUDE.md).

## Licencia

[PolyForm Noncommercial License 1.0.0](./LICENSE).

Puedes usar, modificar y redistribuir el código libremente para cualquier propósito **no comercial** (personal, educativo, investigación, ONGs). El uso comercial está reservado a la titular del copyright. Si quieres uso comercial, abre un issue.

## Contribuir

Lee [CONTRIBUTING.md](./CONTRIBUTING.md) — todos los commits deben firmarse con DCO (`git commit -s`).
