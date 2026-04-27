# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Objetivo

**Cadencia** — *para ciclistas con ritmo*. App **source-available** (PolyForm Noncommercial — colaboración abierta, uso comercial reservado a la autora) que sincroniza música de Spotify con la intensidad de tus entrenamientos en bici, en dos modalidades:

- **Outdoor**: subes un GPX de tu ruta, la app estima la **potencia (vatios)** por segmentos y genera una playlist Spotify ordenada donde el BPM/energy de cada track encaja con la intensidad del segmento correspondiente.
- **Indoor cycling**: construyes una sesión por bloques (calentamiento, intervalos, recuperación, sprints…) desde cero o partiendo de **plantillas científicas** (SIT, HIIT, Noruego 4×4, Z2…) y la app genera la playlist sincronizada para esa sesión.

Sin registros, sin base de datos, sin backend. Toda la lógica corre en cliente.

Bajo el paraguas de **Movimiento Funcional**.

---

## Targets de distribución

| Target | Cómo se construye | Dónde se publica | Cómo "se instala" |
|---|---|---|---|
| **Webapp / PWA** | `pnpm build` → `dist/` estático | Hostinger (subir a `public_html` por SFTP) | Usuario abre `cadencia.movimientofuncional.app`. Chrome/Safari móvil ofrecen "Añadir a pantalla de inicio" → PWA fullscreen indistinguible visualmente de una app nativa. |

No hay APK Android nativa: el alcance se simplificó a webapp+PWA porque (a) no hay funcionalidad nativa que justifique Capacitor, (b) la PWA cubre el caso "tener app en el móvil" sin Play Store ni signing.

---

## Stack

- **Build**: Vite 6
- **UI**: React 18 + TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Estilos**: Tailwind CSS 3
- **Gestor de paquetes**: **pnpm** (nunca `npm` ni `yarn`)
- **PWA**: `vite-plugin-pwa` (manifest + service worker, install prompt en navegadores compatibles)
- **Charts**: Recharts (sobre puntos ya downsampleados a bloques de 60 s)
- **Tests unit**: Vitest + Testing Library + jsdom
- **Tests E2E**: Playwright
- **OAuth**: PKCE flow puro en cliente, **solo Spotify** y solo al pulsar "Crear playlist". Token en `sessionStorage`, expira con la pestaña.

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
pnpm deploy               # Sube dist/ a Hostinger por FTP (requiere .env.local)
pnpm deploy:full          # build + deploy en una sola tanda
```

---

## Modos de uso

La app arranca en una **Landing page**. El usuario pulsa "Empezar" y entra al **stepper de 5 pasos**:

| # | Paso | Página | Qué hace |
|---|---|---|---|
| 0 | **Tipo** | `SourceTypeStep` | Elige modalidad: GPX outdoor o sesión indoor. |
| 1 | **Datos** | `UserDataStep` | Recoge inputs fisiológicos. Validación **bifurcada por modo** (ver "Modelo de dominio"). |
| 2 | **Ruta** | `RouteStep` → bifurca a `GpxRouteFlow` o a `SessionBuilder` según el modo elegido. | Outdoor: sube GPX y procesa segmentos. Indoor: construye sesión por bloques desde plantilla o desde cero. |
| 3 | **Música** | `MusicStep` | Selector de fuentes (CSVs embebidos, propios o ambos), preferencias de género, "todo con energía", matching en vivo. |
| 4 | **Resultado** | `ResultStep` | Muestra playlist final, permite editar tracks individuales, crear en Spotify (OAuth PKCE), o entrar en **Modo TV** (`SessionTVMode`) — solo en sesiones indoor — para seguir la sesión a pantalla completa con la música sincronizada. |

Páginas adicionales: `Landing` (home), `SpotifyCallback` (handler del OAuth redirect).

El estado del wizard persiste en `sessionStorage` (`@ui/state/wizardStorage`) para sobrevivir al redirect del OAuth de Spotify (full page navigation a `/callback`).

---

## Arquitectura

Separación estricta entre **lógica pura** y **UI**, para que los cálculos sean unitestables sin DOM ni red.

```
src/
  core/                       # TypeScript puro, SIN imports de React ni del DOM
    physiology/               # FC máx (Gulati), zonas Karvonen y Coggan
    gpx/                      # Parser GPX (DOMParser), haversine, pendiente
    power/                    # Ecuación de potencia (gravedad + rodadura + aero)
    segmentation/             # Bloques de 60 s, clasificación en zonas, plan de sesión, plantillas
      sessionPlan.ts          # Tipos SessionBlock, SessionItem, EditableSessionPlan
      sessionTemplates.ts     # Plantillas científicas (SIT, HIIT, Noruego 4×4, Z2…)
      fromSessionBlocks.ts    # Conversión sesión-indoor → segmentos clasificados
    matching/                 # Motor de scoring zona ↔ track (determinista)
    tracks/                   # Carga y deduplicación de CSVs
    user/                     # Inputs del usuario, validación bifurcada (gpx|session), persistencia
      userInputs.ts           # Tipo UserInputsRaw + EMPTY
      validation.ts           # validateUserInputs(raw, currentYear, mode)
      storage.ts              # sessionStorage wrapper
    playlist/                 # Builders de nombre y descripción de la playlist Spotify

  integrations/
    spotify/                  # OAuth PKCE + endpoints search/playlists/items

  ui/
    components/
      session-builder/        # BlockList, BlockEditor, TemplateGallery, RepeatGroup
      …                       # Resto: Stepper, Card, FileDropzone, ZoneBadge, Charts, etc.
    pages/                    # Landing, SourceTypeStep, UserDataStep, RouteStep, MusicStep,
                              # ResultStep, SessionBuilder, SessionTVMode, SpotifyCallback
    state/                    # wizardStorage, userInputsReducer (state global del wizard)

  data/tracks/                # CSVs embebidos (cinelli_rider, mix_alegre, trainingpeaks_virtual)
```

### Reglas de capas (vinculantes)

- `src/core/` **nunca** importa de `src/ui/` ni de `src/integrations/`. 100% testable sin DOM, sin red, sin React.
- `src/integrations/` puede importar tipos de `src/core/`, nunca al revés.
- `src/ui/` orquesta `core` + `integrations`; nunca contiene cálculos físicos ni parsing.

### Aliases TS / Vite

`@core/*`, `@integrations/*`, `@ui/*`, `@data/*`.

---

## Modelo de dominio

### Inputs fisiológicos del usuario

```
Peso corporal (kg)               obligatorio en modo gpx; opcional en modo session (default 70)
FTP en vatios (W)                opcional
  └── Si no hay FTP:
      FC máxima (bpm)            opcional
      FC en reposo (bpm)         opcional (necesaria para Karvonen)
      Año de nacimiento          obligatorio si no hay FC máx Y modo gpx
```

**Validación bifurcada por modo** (`src/core/user/validation.ts`):

| Campo | Modo `gpx` | Modo `session` |
|---|---|---|
| Peso | obligatorio (alimenta ecuación de potencia) | opcional, default 70 kg |
| FTP / FC máx / FC reposo / año nac | uno mínimo (FTP, o FC máx, o birthYear) | todos opcionales (el usuario marca zonas a mano) |

La pública objetivo prioritaria son **ciclistas con pulsómetro** (FC), no con potenciómetro (FTP). El UI prioriza inputs de FC; FTP es la excepción para usuarios avanzados.

### FC máxima teórica (fórmula de Gulati)

Más precisa que Tanaka, especialmente en mujeres:

```
FC_max = 211 - 0.64 × edad
```

### Zonas de FC (Karvonen, requiere FC reposo)

```
FC_reserva = FC_max - FC_reposo
Z1 = FC_reposo + [0.50–0.60] × FC_reserva   // Recuperación activa
Z2 = FC_reposo + [0.60–0.70] × FC_reserva   // Aeróbico base
Z3 = FC_reposo + [0.70–0.80] × FC_reserva   // Tempo
Z4 = FC_reposo + [0.80–0.90] × FC_reserva   // Umbral
Z5 = FC_reposo + [0.90–1.00] × FC_reserva   // Máximo
```

### Zonas de potencia (Coggan, si hay FTP)

```
Z1 < 55 % FTP
Z2  55–75 % FTP
Z3  75–90 % FTP
Z4  90–105 % FTP
Z5  105–120 % FTP
Z6 > 120 % FTP        // Se mapea a Z5 musical (no hay banda BPM superior)
```

### Cálculo de potencia por segmento (modo GPX)

```
P_total = P_gravedad + P_rodadura + P_aerodinámica

P_gravedad     = masa_total × g × velocidad × sin(atan(pendiente / 100))
P_rodadura     = Crr × masa_total × g × velocidad
P_aerodinámica = 0.5 × rho × CdA × velocidad³

Constantes por defecto:
  masa_total = peso_usuario + 10 kg (bici)
  g          = 9.81 m/s²
  Crr        = 0.004        (gravel; ajustable)
  rho        = 1.225 kg/m³  (aire a nivel del mar)
  CdA        = 0.36 m²      (posición gravel estándar)
```

**Velocidad**: si el GPX trae timestamps reales se calcula entre puntos; si no, se estima por pendiente:

```
llano        →  25 km/h
subida >4 %  →  14 km/h
subida >8 %  →  10 km/h
bajada       →  35 km/h
```

### Segmentación

**Modo GPX**: agrupar puntos en bloques de **60 segundos** estimados. Para cada bloque: potencia media, zona (Z1–Z5), duración.

**Modo sesión indoor**: el usuario define `SessionBlock`s con `{durationSec, zone, label}`. La función `fromSessionBlocks` los convierte a `ClassifiedSegment[]` directamente — sin pasar por física, porque el usuario ya marca la zona objetivo.

Output común a ambos modos: `Array<{ zone: 1|2|3|4|5; durationSec: number }>`.

### Plantillas de sesión científicas (`src/core/segmentation/sessionTemplates.ts`)

Plantillas predefinidas basadas en literatura de entrenamiento de resistencia. Cada usuario puede partir de una y editarla, o construir desde cero. Ejemplos:

- **SIT** (Sprint Interval Training): repeticiones cortas máximas (Z5) + recuperaciones largas (Z1).
- **HIIT** clásico: intervalos Z4 con recuperación Z1.
- **Noruego 4×4**: Helgerud et al., NTNU. 4 × (4 min Z4 / 3 min Z2). Aplicable indistintamente a ciclismo y running.
- **Z2 base**: sesión sostenida en zona aeróbica.

### Mapeo zona → metadatos de track

| Zona | BPM objetivo | Energy min | Valence  | Descripción       |
| ---- | ------------ | ---------- | -------- | ----------------- |
| Z1   | 90-110       | 0.40       | cualq.   | Recuperación      |
| Z2   | 110-120      | 0.55       | > 0.40   | Aeróbico base     |
| Z3   | 120-130      | 0.70       | > 0.50   | Tempo sostenido   |
| Z4   | 130-145      | 0.80       | > 0.60   | Umbral            |
| Z5   | 145-175      | 0.90       | > 0.70   | Máximo / sprint   |

Si el usuario marca "todo con energía", `Energy mín = 0.70` también en Z1–Z2.

### Algoritmo de matching (determinista)

Para cada segmento `[zona, duración]`:

1. Filtrar tracks por **zona → BPM + Energy + género preferido**.
2. Ordenar por `score = 0.5 × match_genero + 0.3 × ajuste_BPM + 0.2 × energy`.
3. Seleccionar el track con mayor `score` **no usado en los últimos 5 tracks**.
4. **Una entrada por canción**: si una canción es lo bastante larga para cubrir varios segmentos consecutivos de la misma zona, aparece una sola vez en la playlist (no se repite por segmento). Comportamiento controlado por `crossZoneMode: 'overlap' | 'discrete'` (overlap por defecto en modo GPX, discrete en modo sesión).
5. Encolar.

**Determinista**: misma entrada → misma salida. Si se introduce aleatoriedad para variedad, debe ser con semilla fija configurable.

---

## Librería de tracks

3 CSVs nativos de Spotify viven en `src/data/tracks/`:

- `cinelli_rider.csv`
- `mix_alegre.csv`
- `trainingpeaks_virtual.csv`

El loader los **une y deduplica por `Track URI`**. Columnas relevantes:

- `Tempo` → BPM
- `Energy`, `Valence` → discriminadores principales para zonas
- `Genres` → matching de género preferido
- `Track URI` → identificador único + uso directo para añadir a playlist Spotify

En `MusicStep` el usuario elige fuente: `'predefined'` (solo CSVs embebidos), `'mine'` (solo CSVs propios subidos en runtime) o `'both'` (mergea ambos en memoria, dedup por URI).

---

## Integraciones externas

| Servicio | Uso | Token |
|---|---|---|
| **Spotify** | OAuth PKCE solo al pulsar "Crear playlist" | `sessionStorage`, expira con la pestaña |
| **Strava** | Import GPX manual (el usuario exporta el GPX desde Strava y lo sube) | — |
| **Komoot** | Import GPX manual (su API requiere partner comercial) | — |

**Ningún token va a `localStorage`, a un backend, ni a logs.** La única superficie OAuth de la app es Spotify, y solo se activa cuando el usuario pulsa "Crear playlist".

### Endpoints Spotify usados

```http
POST /v1/me/playlists                                  # crear playlist privada
POST /v1/playlists/{playlist_id}/items                 # añadir tracks por URI
GET  /v1/search?q=track:{n}+artist:{a}&type=track      # solo si falta URI
```

Scope: `playlist-modify-private`.

> **Nota — rename feb-2026 de Spotify**: los endpoints antiguos `POST /v1/users/{user_id}/playlists` y `POST /v1/playlists/{id}/tracks` fueron retirados en febrero de 2026 y devuelven **403 silencioso** (sin razón, sin error legible). Los endpoints actuales son los listados arriba: `/me/playlists` para crear y `/items` para añadir tracks (renombrado para soportar episodios de podcast). Si en algún momento algo devuelve 403 en el OAuth flow después de autenticar correctamente, este es el primer sospechoso.

### Configuración del Client ID

PKCE no necesita Client Secret, pero sí un Client ID. Se configura por `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID=tu-client-id-aqui
```

Pasos para obtenerlo:
1. https://developer.spotify.com/dashboard → "Create an App".
2. Añade Redirect URIs: `http://127.0.0.1:5173/callback` (dev), `https://cadencia.movimientofuncional.app/callback` (prod).
3. Activar "Web API" en las APIs.
4. Copiar el Client ID al `.env.local` (gitignored).

Ver [.env.example](.env.example) para la plantilla.

**Nota sobre `127.0.0.1` vs `localhost`**: Spotify dejó de aceptar `http://localhost` a finales de 2024. En desarrollo abre la app en `http://127.0.0.1:5173/`, no en `localhost`.

**No usar Client Secret**: PKCE prescinde del secret a propósito. Aunque Spotify lo muestre en el dashboard, no debe meterse nunca en el `.env.local` con prefijo `VITE_*` — acabaría visible en el bundle JS público y permitiría suplantar la app.

### Limitaciones conocidas (otras plataformas musicales)

**Solo Spotify** está soportado. Las alternativas comunes no son viables con la arquitectura cliente-only actual:

- **Apple Music**: requiere un Developer Token JWT firmado con clave privada de equipo Apple Developer. Esa clave NO puede vivir en código que se descarga al cliente. Necesitaría un backend que firme tokens, lo que rompe la regla "sin servidores".
- **Amazon Music**: no expone API pública para crear playlists.
- **YouTube Music**: no tiene API oficial; las soluciones no oficiales (ytmusicapi y similares) requieren cookies del usuario y violan ToS.

Si en el futuro se quisiera soportar otras plataformas, requeriría cambio arquitectónico (mini-backend que firme tokens).

---

## Diseño UI

- **Estética**: light mode, design-system de Movimiento Funcional (`.claude/skills/design-system/SKILL.md`). Optimizado para legibilidad, accesibilidad WCAG 2.1 AA y zonas táctiles ≥44 px.
- **Paleta UI**:
  - Primary: `turquesa-600 #00bec8` (CTAs, navegación, focus rings).
  - Critical: `rosa-600 #e11d48` (acciones destructivas, máx 1-2 por pantalla).
  - Info: `tulipTree-500 #eab308` (tips, datos complementarios).
  - Neutrales: paleta `gris-{50..900}` (texto principal `gris-800` sobre fondo blanco).
- **Paleta de zonas Z1-Z5** (`colors.zone.{1..5}` en `tailwind.config.ts`): **exclusivamente para visualización de datos** — gauges de potencia, bandas en charts de elevación (Recharts), `ZoneBadge`, `ZoneTimelineChart` en sesiones indoor. **No se usa para UI general**.
- **Tipografía**: `Righteous` (display, solo H1/H2 y logos) + `ABeeZee` (sans, cuerpo y formularios). Importadas desde Google Fonts en `index.html`. Tamaño base 16 px móvil / 18 px desktop, escala 1.25.
- **Iconografía**: Material Icons (`<MaterialIcon name="..."/>`). **Nunca emojis** en componentes UI.
- **Componentes clave**: `Stepper` (5 pasos), drag & drop GPX (`FileDropzone`), `ElevationChart` con bandas por zona (Recharts), `ZoneTimelineChart` para sesión indoor, cards de tracks con `ZoneBadge`, `EditDataPanel` (panel inline para editar inputs sin volver atrás), `SourceSelector` (gpx vs session), session-builder (`BlockList`, `BlockEditor`, `TemplateGallery`, `RepeatGroup`).

---

## Normas del proyecto

1. **No introducir backend, base de datos, ni sistema de cuentas.** Si una feature parece requerirlo, parar y preguntar antes de codificar.
2. **Cálculos físicos viven en `src/core/`** y no tocan React/DOM. Cada fórmula nueva entra con su test unitario.
3. **Nada de `any`** en TypeScript. Si un tipo es genuinamente desconocido, `unknown` + narrowing explícito.
4. **El motor de matching debe ser determinista**: misma entrada → misma salida.
5. **Open source colaborativo**: nombres de variables, funciones y archivos en **inglés**. Comentarios y commits en **castellano** correcto (con ñ y tildes), evitando anglicismos en UI (no "setup", "default", "playlist" en copy de usuario; sí términos técnicos del dominio: FTP, GPX, Spotify).
6. **Pre-commit Husky** ejecuta `pnpm typecheck` + `pnpm lint`. **Nunca `git commit --no-verify`**: si un check falla, arreglar la causa.

---

## Licencia y contribuciones

- Licencia: **PolyForm Noncommercial 1.0.0** ([LICENSE](./LICENSE)). Uso no comercial libre; comercial reservado a la titular del copyright.
- Contribuciones externas: requieren **firma DCO** (`git commit -s`) en cada commit. Detalles en [CONTRIBUTING.md](./CONTRIBUTING.md). Sin DCO no se mergea.
- Las dependencias instaladas son todas licencias permisivas (MIT, ISC, Apache-2.0, BSD). Si se va a añadir una dependencia con licencia copyleft fuerte (GPL, AGPL), parar y preguntar primero.

---

## Subagentes (definidos en `.claude/agentes.md`)

| Tarea                                                    | Subagente                       |
| -------------------------------------------------------- | ------------------------------- |
| Feature nueva desde cero (con type-check + lint + tests) | `web-quality-enforcer`          |
| Limpiar errores TypeScript / ESLint existentes           | `typescript-eslint-fixer`       |
| UI/componentes / verificación visual                     | `ui-ux-designer`                |
| Revisar contra los estándares de este archivo            | `project-aware-code-reviewer`   |

`supabase-database-specialist` no aplica (no hay BD).
