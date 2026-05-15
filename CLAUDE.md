# CLAUDE.md

Guía rápida para Claude Code al trabajar en este repositorio.

> **Para detalles** de fórmulas físicas (Karvonen, Coggan, Minetti, ecuación de potencia ciclista), zonas, plantillas de sesión, tests fisiológicos, algoritmo de matching, modelo BYOC de Spotify, CSP de previews, sincronización con Google Drive, calendario, paleta de zonas y convenciones de copy: lee **[`docs/PROJECT_DETAILS.md`](docs/PROJECT_DETAILS.md)**.

---

## Objetivo

**Cadencia** — *disfruta del cardio a tu ritmo*. App de código fuente público y uso no comercial (PolyForm Noncommercial 1.0.0) que sincroniza música de Spotify con la intensidad de entrenamientos de cardio. Soporta dos deportes (**ciclismo** y **carrera**) y dos modalidades por deporte (**outdoor** desde GPX o **indoor** por bloques).

Sin registros obligatorios, sin base de datos propia, sin backend. Toda la lógica corre en cliente. Opcionalmente el usuario puede conectar **Google Drive** (scope `drive.appdata`) para sincronizar ajustes y sesiones entre dispositivos — sus datos viajan a una carpeta privada de su propio Drive, nunca pasan por nosotros.

Bajo el paraguas de **Movimiento Funcional**.

---

## Targets de distribución

| Target | Cómo se construye | Dónde se publica | Cómo «se instala» |
|---|---|---|---|
| **Webapp / PWA** | `pnpm build` → `dist/` estático | Hostinger (SFTP a `public_html`) | Usuario abre `cadencia.movimientofuncional.app`. Chrome/Safari móvil ofrecen «Añadir a pantalla de inicio» → PWA fullscreen. |

No hay APK Android nativa: la PWA cubre el caso «tener app en el móvil» sin Play Store ni signing.

---

## Stack

- **Build**: Vite 6
- **UI**: React 18 + TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Estilos**: Tailwind CSS 3
- **Gestor de paquetes**: **pnpm** (nunca `npm` ni `yarn`)
- **PWA**: `vite-plugin-pwa`
- **Charts**: Recharts (sobre puntos ya downsampleados a bloques de 60 s)
- **Tests unit**: Vitest + Testing Library + jsdom
- **Tests E2E**: Playwright
- **OAuth**: Spotify (PKCE, modelo BYOC — cada usuario su Client ID) + Google Drive (GIS, scope `drive.appdata`). Ambas opt-in, app funcional sin ellas.

---

## Comandos

```bash
pnpm install              # Instalar deps
pnpm dev                  # Vite dev server (http://127.0.0.1:5173)
pnpm build                # Build de producción → dist/
pnpm preview              # Preview del build
pnpm typecheck            # tsc --noEmit
pnpm lint                 # ESLint
pnpm lint:fix             # ESLint con autofix
pnpm test                 # Vitest unit, modo watch
pnpm test:run             # Vitest unit, run-once
pnpm test:coverage        # Cobertura sobre src/core/
pnpm test:e2e             # Playwright E2E
pnpm build:tracks         # Recompila src/data/tracks/all.csv desde sources/
pnpm build:assets         # Regenera favicons, iconos PWA y og-image.png
pnpm deploy               # Sube dist/ a Hostinger por FTP (requiere .env.local)
pnpm deploy:full          # build + deploy en una sola tanda
```

---

## Modos de uso

La app arranca en una **Landing**. El usuario pulsa «Empezar» y entra al **stepper de 5 pasos**:

| # | Paso | Página | Qué hace |
|---|---|---|---|
| 0 | **Tipo** | `SourceTypeStep` | Elige deporte (ciclismo/carrera) y fuente (GPX outdoor / sesión por bloques). |
| 1 | **Datos** | `UserDataStep` | Recoge inputs fisiológicos (validación bifurcada por `(sport, mode)`). |
| 2 | **Ruta** | `RouteStep` → `GpxRouteFlow` o `SessionBuilder` | Outdoor: sube GPX. Indoor: construye por bloques, plantilla o importa `.zwo`. Exporta `.zwo`. |
| 3 | **Música** | `MusicStep` | Selector de fuentes (CSVs embebidos, propios o ambos), preferencias de género, matching en vivo. |
| 4 | **Resultado** | `ResultStep` | Playlist final, edición por slot, creación en Spotify y entrada al **Modo TV** (solo indoor). |

Páginas adicionales: `Landing`, `SpotifyCallback`, `CatalogEditorPage` (`/catalogo`), `MyPreferencesPage` (`/preferencias`), `CalendarPage` (`/calendario`), `HelpRouter` (`/ayuda/*`).

Estado **ephemeral** del wizard en `sessionStorage` (`@ui/state/wizardStorage`) — sobrevive al redirect OAuth de Spotify. Estado **duradero** (inputs, preferencias, sesiones guardadas) en `localStorage` vía `@ui/state/cadenciaStore` **por defecto, sin opt-in**. Borrado siempre a un clic en `/preferencias`. Opcionalmente sincronizable con Google Drive.

Detalle de cada paso (incluido el Modo TV con voz del entrenador, wake lock, beeps y test dialogs): `docs/PROJECT_DETAILS.md` § «Modos de uso detallados».

---

## Arquitectura

Separación estricta entre **lógica pura** y **UI**, para que los cálculos sean unitestables sin DOM ni red.

```
src/
  core/                       # TypeScript puro, SIN imports de React ni del DOM
    physiology/               # FC máx (Gulati ♀ / Tanaka ♂), zonas Karvonen y Coggan, tests
    gpx/                      # Parser GPX (DOMParser), haversine, pendiente
    power/                    # Ecuación de potencia ciclista (gravedad + rodadura + aero)
    segmentation/             # Bloques de 60 s, clasificación, plan de sesión, plantillas, Minetti
    matching/                 # Motor de scoring zona ↔ track (determinista)
    tracks/                   # Carga y deduplicación de CSVs
    user/                     # UserInputsRaw, validación bifurcada por (sport, mode), persistencia
    playlist/                 # Builder de nombre/descripción, historial real, stats
    sessionFormats/           # Import/export .zwo (Zwift Workout)
    sync/                     # Motor de sync (puro, agnóstico de Drive): LWW + tombstones
    sessions/                 # CRUD de SavedSession (tombstones)
    csvs/                     # CRUD catálogo personal, denylist nativa, dismissed URIs
    calendar/                 # PlannedEvent, expandRecurrences, tombstones

  integrations/
    spotify/                  # OAuth PKCE + endpoints search/playlists/items, errores tipados
    gdrive/                   # GIS auth + Drive REST + orquestador sync (debounce + polling)

  ui/
    components/               # Stepper, session-builder, sync, calendar, tv, BYOC, etc.
    lib/                      # loadPlannedEvent y helpers UI
    pages/                    # Todas las páginas listadas arriba
    state/                    # cadenciaStore (localStorage), wizardStorage (sessionStorage)

  data/tracks/                # all.csv (~10k tracks) + sources/ (CSVs originales)
```

### Reglas de capas (vinculantes)

- `src/core/` **nunca** importa de `src/ui/` ni de `src/integrations/`. 100% testable sin DOM, sin red, sin React.
- `src/integrations/` puede importar tipos de `src/core/`, nunca al revés.
- `src/ui/` orquesta `core` + `integrations`; nunca contiene cálculos físicos ni parsing.

### Aliases TS / Vite

`@core/*`, `@integrations/*`, `@ui/*`, `@data/*`.

---

## Modelo de dominio (resumen)

Cuatro inputs fisiológicos clave: peso, FTP (opcional, solo bike), FC máx (medida) o `(birthYear + sex)` para estimarla, FC reposo (opcional para Karvonen completo). El público prioritario son personas con pulsómetro, no con potenciómetro.

**Validación bifurcada** por `(sport, mode)` (`src/core/user/validation.ts`):

| Campo | `bike + gpx` | `bike + session` | `run` (gpx o session) |
|---|---|---|---|
| Peso | obligatorio | opcional (default 70) | opcional (default 70, Cr Minetti normaliza por kg) |
| FTP | opcional | opcional | **descartado** |
| FC máx **o** (birthYear + sex) | uno mínimo si no hay FTP | obligatorio | obligatorio |
| FC reposo | opcional | opcional | opcional |
| Sexo biológico | obligatorio si hay birthYear sin FC máx | igual | igual |

En running se descarta `ftpWatts` deliberadamente: Stryd/COROS Pod son nicho V1 — el motor running deriva intensidad de la pendiente (polinomio de Minetti), no de potencia medida.

Detalles completos (fórmulas Gulati/Tanaka, Karvonen, Coggan, floor por pendiente para bike+gpx, ecuación de potencia ciclista, polinomio de Minetti, plantillas científicas, tests fisiológicos guiados con sus DOIs): `docs/PROJECT_DETAILS.md` § «Modelo de dominio».

### Algoritmo de matching (reglas cardinales)

- **Determinista**: misma entrada → misma salida (modulado opcionalmente por una `seed` que permite variedad reproducible).
- **Cero repeticiones**: ninguna canción aparece dos veces en la playlist final, en ningún modo.
- **Cadencia es el único filtro excluyente** (dual-range 1:1 ∪ 2:1 half-time). Energy, valence y género afectan al score, no descartan.
- **Política de selección**: `strict` > `best-effort` cross-zone > `repeated` (último recurso solo si TODO el catálogo está usado).

Scoring exacto, sustitución manual («Otro tema»), pre-check de cobertura, banner de encaje libre y referencias PubMed: `docs/PROJECT_DETAILS.md` § «Algoritmo de matching» y § «Librería de tracks».

---

## Integraciones externas (resumen)

| Servicio | Uso | Token |
|---|---|---|
| **Spotify** | OAuth PKCE solo al pulsar «Crear playlist». Modelo **BYOC**: cada usuario su propio Client ID (no hay fallback compartido). | `sessionStorage`, expira con la pestaña |
| **Google Drive** | OAuth GIS opt-in para sincronizar entre dispositivos. Scope `drive.appdata` (carpeta privada invisible) | `localStorage` (`cadencia:gdrive:token`), expiry 1h con silent refresh |
| **Strava / Komoot** | Import GPX manual (export del usuario, no API) | — |

**Ningún token de Spotify va a `localStorage`, a un backend, ni a logs.** El token de Google sí va a `localStorage` (el patrón GIS lo requiere) pero nunca a backend ni a logs.

**Solo Spotify** está soportado como plataforma musical. Apple Music requiere backend que firme JWT, Amazon Music no expone API pública para crear playlists, YouTube Music no tiene API oficial. Ampliar requiere cambio arquitectónico.

Detalles (endpoints concretos, CSP para previews del iframe embed, modelo BYOC completo con sus 3 superficies UI, manejo de errores reportables, configuración Client ID Spotify y Google, sincronización Drive completa con el motor LWW + tombstones, calendario): `docs/PROJECT_DETAILS.md` § «Integraciones externas detalladas», § «Sincronización Google Drive» y § «Calendario de planificación».

---

## Diseño UI (resumen)

- **Estética**: light mode, design-system de Movimiento Funcional (`.claude/skills/design-system/SKILL.md`). WCAG 2.1 AA, zonas táctiles ≥44 px.
- **Paleta UI**: `turquesa-600 #00bec8` (CTAs/focus), `rosa-600 #e11d48` (críticos, máx 1-2 por pantalla), `tulipTree-500 #eab308` (info), neutrales `gris-{50..900}` (texto principal `gris-800` sobre fondo blanco).
- **Paleta de zonas Z1-Z6**: **solo para visualización de datos** (gauges, charts Recharts con bandas, `ZoneBadge`, `ZoneTimelineChart`). No se usa para UI general. Colores concretos en `docs/PROJECT_DETAILS.md`.
- **Tipografía**: `Righteous` (display, solo H1/H2 y logos) + `ABeeZee` (sans, cuerpo y formularios). Base 16 px móvil / 18 px desktop, escala 1.25.
- **Iconografía**: Material Icons (`<MaterialIcon name="..."/>`). **Nunca emojis** en componentes UI.

---

## Normas del proyecto

1. **No introducir backend, base de datos, ni sistema de cuentas.** Si una feature parece requerirlo, parar y preguntar antes de codificar.
2. **Cálculos físicos viven en `src/core/`** y no tocan React/DOM. Cada fórmula nueva entra con su test unitario.
3. **Nada de `any`** en TypeScript. Si un tipo es genuinamente desconocido, `unknown` + narrowing explícito.
4. **El motor de matching debe ser determinista**: misma entrada → misma salida.
5. **Convenciones de código y copy**: nombres de variables, funciones y archivos en **inglés**; comentarios y commits en **castellano** correcto (con ñ y tildes). En copy de usuario, evitar anglicismos innecesarios (tabla completa en `docs/PROJECT_DETAILS.md` § «Convenciones de copy»). Comillas tipográficas «...» en texto narrativo.
6. **Pre-commit Husky** ejecuta `pnpm typecheck` + `pnpm lint`. **Nunca `git commit --no-verify`**: si un check falla, arreglar la causa.

---

## Licencia

**PolyForm Noncommercial 1.0.0** ([LICENSE](./LICENSE)). Libre para uso no comercial (personal, estudio, hobby, investigación, ONGs); uso comercial requiere permiso (movimientofuncional.net@gmail.com). **No se aceptan pull requests** externos — issues sí. Detalle: `docs/PROJECT_DETAILS.md` § «Licencia y contribuciones».

---

## Subagentes (definidos en `.claude/agentes.md`)

| Tarea                                                    | Subagente                       |
| -------------------------------------------------------- | ------------------------------- |
| Feature nueva desde cero (con type-check + lint + tests) | `web-quality-enforcer`          |
| Limpiar errores TypeScript / ESLint existentes           | `typescript-eslint-fixer`       |
| UI/componentes / verificación visual                     | `ui-ux-designer`                |
| Revisar contra los estándares de este archivo            | `project-aware-code-reviewer`   |

`supabase-database-specialist` no aplica (no hay BD).
