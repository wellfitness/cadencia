# Spoty Cycling

Webapp + APK Android (via Capacitor) que genera playlists de Spotify ordenadas segun el perfil de esfuerzo de una ruta GPX.

> **Esto es un prototipo open source en bootstrap.** No hay backend, no hay base de datos, no hay registros: toda la logica corre en cliente. Solo Spotify usa OAuth (PKCE, en el momento de crear la playlist). Strava y Komoot se importan como GPX manual.

## Stack

Vite + React 18 + TypeScript + Tailwind + Capacitor 6 + Vitest + Playwright + Recharts.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # Vitest unit
pnpm test:e2e     # Playwright (necesita 'pnpm test:e2e:install' la primera vez)
pnpm typecheck
pnpm lint
```

## Build

```bash
pnpm build        # → dist/  (subir a Hostinger /public_html via SFTP)
```

## Android (Capacitor)

```bash
pnpm dlx cap add android       # primera vez
pnpm build && pnpm cap:sync    # cada vez que cambia el frontend
pnpm cap:android               # abrir Android Studio para firmar APK
```

## Estructura

- `src/core/` - Logica pura (sin React, sin DOM): cilculos fisiologicos, parser GPX, motor de matching. 100% unitestable.
- `src/integrations/` - Cliente OAuth de Spotify (unico servicio externo con autenticacion).
- `src/ui/` - Componentes React + Tailwind.
- `src/data/tracks/` - CSVs de Spotify embebidos como librerias por defecto.

Para guias de contribucion y reglas del proyecto ver [CLAUDE.md](./CLAUDE.md).

## Licencia

[PolyForm Noncommercial License 1.0.0](./LICENSE).

Puedes usar, modificar y redistribuir el codigo libremente para cualquier
proposito **no comercial** (personal, educativo, investigacion, ONGs).
El uso comercial esta reservado a la titular del copyright. Si quieres uso
comercial, abre un issue.

## Contribuir

Lee [CONTRIBUTING.md](./CONTRIBUTING.md) — todos los commits deben firmarse
con DCO (`git commit -s`).
