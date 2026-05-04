# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Objetivo

**Cadencia** — *disfruta del cardio a tu ritmo*. App de **código fuente público y uso no comercial** (licencia PolyForm Noncommercial 1.0.0) que sincroniza música de Spotify con la intensidad de tus entrenamientos de cardio. Da soporte a dos deportes (**ciclismo** y **carrera**) y dos modalidades por deporte (outdoor desde GPX o indoor por bloques):

- **Bike outdoor**: subes un GPX de tu ruta, la app estima la **potencia (vatios)** por segmentos (ecuación gravedad + rodadura + aerodinámica) y mapea cada segmento a su zona Z1-Z6.
- **Bike indoor**: construyes una sesión de rodillo o spinning por bloques (calentamiento, intervalos, recuperación, sprints…) desde cero o partiendo de **plantillas científicas de ciclismo** (SIT, HIIT 10-20-30, Noruego 4×4, Z2…).
- **Run outdoor**: subes un GPX de tu carrera y la app deriva la zona de cada tramo desde la **pendiente del terreno** usando el polinomio metabólico de Minetti (independiente de velocidad y peso).
- **Run indoor / pista**: construyes una sesión en tapiz o pista por bloques desde cero o partiendo de **plantillas científicas de running** (Yasso 800s, Daniels Intervals vVO2max, Threshold Cruise, HIIT 30-30, Easy run…).

En las cuatro combinaciones la app genera una playlist Spotify ordenada donde el BPM y la energía de cada track encajan con la intensidad real de cada tramo o bloque.

Sin registros obligatorios, sin base de datos propia, sin backend. Toda la lógica corre en cliente. Opcionalmente, el usuario puede conectar **Google Drive** para sincronizar sus ajustes y sesiones guardadas entre dispositivos — los datos viajan a una carpeta privada de su propio Drive (scope `drive.appdata`, invisible incluso para él en la UI normal de Drive), nunca pasan por nosotros.

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
- **OAuth**: dos integraciones independientes, ambas opt-in y solo activadas al pulsar acciones explícitas:
  - **Spotify** (PKCE puro en cliente, solo al pulsar "Crear playlist"). Token en `sessionStorage`, expira con la pestaña.
  - **Google Drive** (Google Identity Services, scope `drive.appdata`, solo al pulsar "Conectar mi Google Drive"). Token en `localStorage` con expiry 1 h y silent refresh.

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
pnpm build:assets         # Regenera favicons, iconos PWA y og-image.png desde public/logo.png
pnpm deploy               # Sube dist/ a Hostinger por FTP (requiere .env.local)
pnpm deploy:full          # build + deploy en una sola tanda
```

---

## Modos de uso

La app arranca en una **Landing page**. El usuario pulsa "Empezar" y entra al **stepper de 5 pasos**:

| # | Paso | Página | Qué hace |
|---|---|---|---|
| 0 | **Tipo** | `SourceTypeStep` | Elige **deporte** (ciclismo / carrera) en un toggle y **fuente** (GPX outdoor / sesión por bloques) en una card, en una sola pantalla. La combinación `{sport, source}` ramifica el resto del wizard. |
| 1 | **Datos** | `UserDataStep` | Recoge inputs fisiológicos. Validación **bifurcada por `(sport, mode)`**: en run el peso es opcional (Minetti normaliza por kg); en bike+gpx el peso alimenta la ecuación de potencia y es obligatorio. Ver "Modelo de dominio". |
| 2 | **Ruta** | `RouteStep` → bifurca a `GpxRouteFlow` o a `SessionBuilder` según la fuente elegida. | Outdoor: sube GPX y procesa segmentos (potencia ciclista o Cr de Minetti según deporte). Indoor: construye sesión por bloques desde plantilla, desde cero o **importando un .zwo** (Zwift Workout); cada bloque muestra los rangos bpm/W del usuario para su zona. Permite **descargar el plan como .zwo** para Zwift, TrainingPeaks Virtual, TrainerRoad, Wahoo SYSTM, MyWhoosh. |
| 3 | **Música** | `MusicStep` | Selector de fuentes (CSVs embebidos, propios o ambos), preferencias de género, "todo con energía", matching en vivo. |
| 4 | **Resultado** | `ResultStep` | Muestra playlist final, permite editar tracks individuales (incluido un buscador por título o artista en el dropdown «Otro tema», client-side, case- y diacritic-insensitive sobre el ranking ya calculado), crear en Spotify (OAuth PKCE), o entrar en **Modo TV** (`SessionTVMode`) — solo en sesiones indoor — para seguir la sesión a pantalla completa con la música sincronizada. El Modo TV incluye **voz del entrenador** (Web Speech API en castellano, anuncia zona/sensación/cadencia/duración/RPE en cada cambio de bloque), **Screen Wake Lock** (la pantalla no se apaga mientras corre la sesión), beeps de cuenta atrás (10/5/3/2/1 s), atajos de teclado (Espacio, flechas, S/V/R/Esc) y, si la plantilla activa es un test fisiológico, dispara el `TestResultDialog` al completar la sesión. |

Páginas adicionales: `Landing` (home), `SpotifyCallback` (handler del OAuth redirect), `CatalogEditorPage` (`/catalogo`, editor con cuatro pestañas — catálogo nativo, listas propias, descartadas y **estadísticas** del historial real de playlists creadas — con persistencia automática), `MyPreferencesPage` (`/preferencias`, vista consolidada de los datos guardados del usuario; alias `/cuenta` por retrocompatibilidad), `CalendarPage` (`/calendario`, planificación de entrenamientos en vista lista o mes), `HelpRouter` (`/ayuda/*`).

El **header del wizard** incluye un botón directo «Mis preferencias» (icono `manage_accounts`) y un `TodayBadge` que muestra el próximo entreno planificado y permite cargarlo de un click sin pasar por el calendario.

El estado **ephemeral** del wizard (paso actual, ruta procesada, lista casada, índices reemplazados, etc.) persiste en `sessionStorage` (`@ui/state/wizardStorage`) para sobrevivir al redirect del OAuth de Spotify (full page navigation a `/callback`). El estado **duradero** del usuario (inputs fisiológicos, preferencias musicales, sesiones guardadas) vive en `localStorage` vía `@ui/state/cadenciaStore` y se sincroniza opcionalmente con Google Drive (ver "Sincronización opcional con Google Drive" más abajo).

---

## Arquitectura

Separación estricta entre **lógica pura** y **UI**, para que los cálculos sean unitestables sin DOM ni red.

```
src/
  core/                       # TypeScript puro, SIN imports de React ni del DOM
    physiology/               # FC máx (Gulati ♀ / Tanaka ♂), zonas Karvonen y Coggan
    gpx/                      # Parser GPX (DOMParser), haversine, pendiente
    power/                    # Ecuación de potencia ciclista (gravedad + rodadura + aero)
    segmentation/             # Bloques de 60 s, clasificación en zonas, plan de sesión, plantillas
      sessionPlan.ts          # Tipos SessionBlock, SessionItem, EditableSessionPlan, sport
      sessionTemplates.ts     # Plantillas: bike (SIT, HIIT 10-20-30, Noruego 4×4, Z2…)
                              # y run (Yasso 800s, Daniels Intervals, Threshold Cruise, HIIT 30-30, Easy run)
      fromSessionBlocks.ts    # Conversión sesión-indoor → segmentos clasificados
      runMetabolic.ts         # Polinomio de Minetti 2002: Cr(pendiente) en J/kg/m
                              # + slopeToRunZone() para mapear pendiente → zona en GPX de running
    matching/                 # Motor de scoring zona ↔ track (determinista)
    tracks/                   # Carga y deduplicación de CSVs
    user/                     # Inputs del usuario, validación bifurcada por sport+mode, persistencia
      userInputs.ts           # Tipo UserInputsRaw (incluye `sport: 'bike' | 'run'`) + EMPTY
      validation.ts           # validateUserInputs(raw, currentYear, mode) — ramifica run vs bike+gpx vs bike+session
      storage.ts              # sessionStorage wrapper + localStorage opt-in legacy
    playlist/                 # Builders de nombre y descripción de la playlist Spotify,
                              # historial real de creaciones y stats agregadas
      builder.ts              # buildPlaylistName, buildPlaylistDescription, extractUris
      historyTypes.ts         # PlaylistHistoryEntry, PlaylistHistoryTrack
      history.ts              # createPlaylistHistoryEntry, list/get/delete (tombstone), clearAll
      historyStats.ts         # computeSummary, computeTopTracks, computeTopArtists,
                              # computeTopGenresByDuration (ponderado por duración)
    sessionFormats/           # Import/export de planes en formatos externos (zwo.ts → Zwift Workout)
    sync/                     # Motor de sincronización (puro, agnóstico de Drive)
      types.ts                # SyncedData, SectionMeta, SavedSession
      schema.ts               # emptySyncedData(), isSyncedData()
      merge.ts                # mergeData() LWW por sección + array merge por id
      tombstones.ts           # cleanExpiredTombstones() con expiry 30 días
      richness.ts             # calculateDataRichness, isEmptyData (anti-regresión)
    sessions/                 # CRUD de sesiones guardadas por el usuario
      saved.ts                # createSavedSession, list, get, update, delete (tombstone)
    csvs/                     # CRUD de catalogo personal del usuario
      uploadedCsvs.ts         # createUploadedCsv (tombstones), list, get, update, delete
      dismissed.ts            # add/removeDismissedUri, isDismissed, clearAllDismissed
      nativeCatalogPrefs.ts   # set/getNativeCatalogPrefs, addExcludedUri, etc.
    calendar/                 # Planificacion de entrenamientos
      types.ts                # PlannedEvent (indoor|outdoor), EventInstance, recurrencia semanal
      events.ts               # CRUD + expandRecurrences() + tombstones

  integrations/
    spotify/                  # OAuth PKCE + endpoints search/playlists/items
    gdrive/                   # Sincronización opcional con Google Drive (drive.appdata)
      config.ts               # SCOPE, FILE_NAME, CLIENT_ID desde VITE_GOOGLE_CLIENT_ID
      auth.ts                 # signIn / getTokenSilent / refreshToken / signOut (GIS)
      drive-api.ts            # findFile, readFile, createFile, updateFile, getFileMetadata
      sync.ts                 # init, connect, disconnect, push, pull, polling 30s

  ui/
    components/
      session-builder/        # BlockList, BlockEditor, TemplateGallery, RepeatGroup,
                              # SaveSessionDialog, MySavedSessionsTab
      sync/                   # GoogleSyncCard, SyncStatusBadge
      calendar/               # CalendarListView, CalendarMonthView, EventEditorDialog
      tv/                     # MusicControlBar, useSpotifyTVPlayer (controles Spotify
                              # integrados en Modo TV con dialog de detalles reportable)
      TodayBadge.tsx          # Badge de proximo entreno en header del wizard
      ByocTutorialDialog.tsx  # Modal BYOC: 3 pasos para crear y pegar el Client ID propio
      SpotifyAccessDeniedDialog.tsx  # Modal disparado por 403; dos variantes (default/custom)
      SpotifyErrorReporter.tsx    # Card compartida: <pre> técnico + Copiar + Telegram
      …                       # Resto: Stepper, Card, FileDropzone, ZoneBadge, Charts, etc.
    lib/
      loadPlannedEvent.ts     # Rehidrata un PlannedEvent en el wizard (indoor → SavedSession; outdoor → reset)
    pages/                    # Landing, SourceTypeStep, UserDataStep, RouteStep, MusicStep,
                              # ResultStep, SessionBuilder, SessionTVMode, SpotifyCallback,
                              # CatalogEditorPage (/catalogo), MyPreferencesPage (/preferencias),
                              # CalendarPage (/calendario)
    state/                    # cadenciaStore (single source of truth localStorage),
                              # wizardStorage (sessionStorage para wizard ephemeral),
                              # userInputsReducer, migrateLegacyStorage

  data/tracks/                # all.csv (catalogo unificado bundled) + sources/ (12 listas fuente)
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
Sport ('bike' | 'run')           viene del paso 0 del wizard (toggle deporte). Default 'bike' para datos legacy.
Peso corporal (kg)               obligatorio en bike+gpx; opcional en bike+session (default 70) y en run (default 70).
FTP en vatios (W)                opcional en bike (suma rangos de potencia al builder y modo TV); ignorado en run.
FC máxima (bpm)                  obligatoria en bike+session y en run si no hay birthYear + sex.
FC en reposo (bpm)               opcional (necesaria para zonas Karvonen completas).
Año de nacimiento                obligatorio en bike+session y en run si no hay FC máxima.
Sexo biológico                   obligatorio si se estima FC máxima por edad.
```

**Validación bifurcada por `(sport, mode)`** (`src/core/user/validation.ts`):

| Campo | `bike + gpx` | `bike + session` | `run` (gpx u session) |
|---|---|---|---|
| Peso | obligatorio (alimenta ecuación de potencia ciclista) | opcional, default 70 kg | opcional (Cr de Minetti es J/kg/m, ya normalizado), default 70 kg |
| FTP | opcional; junto con FC máx/birthYear, uno mínimo | opcional (suma rangos de vatios) | **descartado** (Stryd es nicho V2; en V1 no aplica) |
| FC máx **o** (birthYear + sex) | uno mínimo si no hay FTP | **mínimo obligatorio** — sin esto el modo TV no podría mostrar pulsaciones objetivo | **mínimo obligatorio** — los rangos de bpm por zona se muestran en cada bloque/segmento |
| FC reposo | opcional (necesaria para zonas Karvonen) | opcional (necesaria para zonas Karvonen) | opcional (necesaria para zonas Karvonen) |
| Sexo biológico | obligatorio sii `birthYear && !maxHeartRate` | obligatorio sii `birthYear && !maxHeartRate` | obligatorio sii `birthYear && !maxHeartRate` |
| Bike type / bike weight | usados (alimentan masa total y Crr/CdA por defecto) | irrelevantes (defaulteados) | irrelevantes (defaulteados) |

El público prioritario son **personas con pulsómetro** (FC), no con potenciómetro: las cuatro combinaciones aceptan FC como dato derivable (FC máx directa o estimable por edad+sexo). FTP queda como excepción para ciclistas avanzados con potenciómetro y suma rangos de vatios al builder y al modo TV cuando se rellena. En running `ftpWatts` se descarta deliberadamente (Stryd y similares son nicho — el motor running V1 deriva intensidad de la pendiente, no de la potencia medida).

**Rangos por zona en el `SessionBuilder`**: cada bloque de la lista (y el editor inline al elegir zona) muestra los rangos bpm y vatios concretos del usuario para esa zona — ej. "Z3 → 138-148 bpm · 195-235 W". Los rangos se calculan una sola vez por sesión en `SessionBuilder` con `calculateKarvonenZones` + `calculatePowerZones` (ver `src/core/physiology/`) y viajan como `PhysioContext` (definido en `BlockList`) hasta cada `BlockRow` y `BlockEditor`. Helpers de formato compartidos en `src/ui/components/session-builder/zoneRangeFormat.ts`. La banda de FC se omite en Z6 (la FC se satura en máxima); la banda de vatios usa "<X W" para Z1 (abierta por debajo) y ">X W" para Z6 (abierta por arriba).

### FC máxima teórica (fórmulas por sexo biológico)

Si el usuario no mide su FC máx con pulsómetro, se estima por edad usando la fórmula derivada para su sexo. Ofrecer ambas en lugar de una única fórmula mixta evita un sesgo sistemático de ~10 bpm en mujeres, suficiente para desplazar una banda Karvonen entera.

```
Mujer  → FC_max = 206 - 0.88 × edad     (Gulati et al., Circulation 2010, n = 5.437 mujeres)
Hombre → FC_max = 208 - 0.7  × edad     (Tanaka et al., JACC 2001, meta-análisis n = 18.712)
```

El código vive en `calculateMaxHeartRate(ageYears, sex)` en [src/core/physiology/maxHeartRate.ts](src/core/physiology/maxHeartRate.ts). Si el usuario mete su FC máx medida directamente, este cálculo no se invoca y `sex` es irrelevante.

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

### Zonas en `bike + gpx`: `max(Coggan, floor por pendiente)`

El modelo Coggan asume que la potencia mecánica medida ≈ esfuerzo cardiovascular. Es razonable en carretera (>95 % de la potencia metabólica acaba siendo potencia mecánica de pedaleo) pero **falla en gravel/MTB**: la velocidad media GPX es estructuralmente baja por Crr efectivo dinámico (barro, grava suelta, raíces), micro-paradas técnicas y coste metabólico de equilibrio que no se traduce en potencia traslacional. Resultado sin corrección: una rampa del 8% en MTB con velocidad media 7 km/h calcula ~140 W mecánicos = Z2 Coggan, cuando el ciclista está en Z5+ cardiovascular.

Solución: la zona de cada bloque ciclista outdoor es `max(zona_Coggan, zona_floor)`. La pendiente sale limpia del GPX y correlaciona con el esfuerzo cardiovascular sin importar la superficie, así que actúa como suelo mínimo. En carretera el floor es muy permisivo y Coggan suele ganar; en gravel/MTB el floor sostiene la zona en subida.

**Tabla de floor por tipo de bici** (en [src/core/segmentation/classifyZone.ts](src/core/segmentation/classifyZone.ts), función `bikeSlopeFloorZone`):

| Pendiente | road | gravel | mtb |
|---|---|---|---|
| < 2% | Z1 | Z1 | Z1 |
| 2-3% | Z1 | Z2 | Z2 |
| 3-5% | Z2 | Z3 | Z3 |
| 5-7% | Z3 | Z4 | Z4 |
| 7-9% | Z4 | Z5 | Z5 |
| 9-11% | Z5 | Z5 | Z6 |
| ≥ 11% | road≥12%→Z6, gravel→Z6, mtb→Z6 | | |

A igual pendiente fuerte la jerarquía es `road ≤ gravel ≤ mtb`: en MTB sostener un 7% obliga ya a Z5 por la "tax" técnica de la superficie, mientras que en carretera el mismo 7% sólo asegura Z4.

**Caso sin FTP**: la zona se deriva exclusivamente del floor. No se inventa un FTP genérico (el viejo default `2.5 W/kg` arrastraba todos los bloques de gravel/MTB a Z1-Z2). La pendiente es un proxy más honesto cuando no hay potenciómetro.

### Cálculo de potencia por segmento (modo `bike + gpx`)

Aplicable solo a ciclismo outdoor. En running outdoor se usa el polinomio de Minetti (siguiente sección).

```
P_total = P_gravedad + P_rodadura + P_aerodinámica

P_gravedad     = masa_total × g × velocidad × sin(atan(pendiente / 100))
P_rodadura     = Crr × masa_total × g × velocidad × cos(atan(pendiente / 100))
P_aerodinámica = 0.5 × rho × CdA × velocidad³

Constantes por defecto:
  masa_total = peso_usuario + 10 kg (bici)
  g          = 9.81 m/s²
  Crr        = 0.004        (gravel; ajustable)
  rho        = 1.225 kg/m³  (aire a nivel del mar)
  CdA        = 0.36 m²      (posición gravel estándar)
```

El `cos(atan(pendiente))` en `P_rodadura` proyecta la fuerza normal sobre la superficie inclinada — en pendientes ciclistas (≤30 %) la diferencia con el modelo simplificado «sin cos» es ≤4 %, pero la formulación completa es la que implementa `src/core/power/equation.ts`.

**Velocidad**: si el GPX trae timestamps reales se calcula entre puntos; si no, se estima por pendiente:

```
llano        →  25 km/h
subida >4 %  →  14 km/h
subida >8 %  →  10 km/h
bajada       →  35 km/h
```

### Cálculo de zonas en running outdoor — polinomio de Minetti (modo `run + gpx`)

A diferencia del ciclismo (donde la velocidad domina la ecuación por la aerodinámica), en running el coste energético `Cr` (J/kg/m) depende **solo de la pendiente** y es independiente de la velocidad. Esto simplifica radicalmente el motor outdoor de running: no necesitamos peso ni velocidad estimada, solo el perfil de elevación del GPX.

Modelo: polinomio empírico de quinto grado ajustado a Minetti et al. 2002 (J Appl Physiol — DOI 10.1152/japplphysiol.01177.2001), datos sobre 10 corredores en cinta entre −45 % y +45 % de pendiente.

```
Cr(g) = 155.4·g⁵ − 30.4·g⁴ − 43.3·g³ + 46.3·g² + 19.5·g + 3.6
```

donde `g` es la pendiente en fracción (no en porcentaje). El polinomio captura la forma "U" del coste en bajada: mínimo a g ≈ −0,20 (~1,8 J/kg/m, 50 % del llano) y vuelve a subir en bajadas más pronunciadas por la carga excéntrica.

**Multiplicador metabólico relativo al llano**: `multiplier(g) = Cr(g) / 3.6`. Es 1× en llano, ~5,6× en +45 %, mínimo ~0,53× a −20 %, vuelve a ~1,18× en −45 % por carga excéntrica.

**Mapeo pendiente → zona** (`slopeToRunZone()` en [src/core/segmentation/runMetabolic.ts](src/core/segmentation/runMetabolic.ts)):

```
multiplier < 0.75   → Z1   (bajada moderada o recovery)
0.75 – 1.05         → Z2   (llano, base aeróbica)
1.05 – 1.40         → Z3   (subida 2-5 %, tempo)
1.40 – 2.00         → Z4   (subida 5-10 %, umbral)
2.00 – 2.50         → Z5   (subida 10-15 %, VO₂max)
≥ 2.50              → Z6   (subida > 15 %, anaeróbico, muros)
```

Pendientes fuera de [−50 %, +50 %] se clampan (suelen ser ruido del GPS). El polinomio se acota a un piso fisiológico mínimo de 0,5 J/kg/m para evitar valores negativos cerca del mínimo del fit.

### Segmentación

**`bike + gpx`**: agrupar puntos en bloques de **60 segundos** estimados. Para cada bloque: potencia media, zona Coggan (Z1–Z6), `cadenceProfile` inferido por pendiente (>6 % → `climb`, resto → `flat`), duración.

**`run + gpx`**: agrupar puntos en bloques de 60 s. Para cada bloque: pendiente media, zona via `slopeToRunZone()`, duración. `cadenceProfile` se rellena por convención a `'flat'` (en running la cadencia musical se acopla a la zona, no al terreno — ver matching).

**`bike + session` y `run + session`**: el usuario define `SessionBlock`s con `{durationSec, zone, cadenceProfile, description}`. La función `fromSessionBlocks` los convierte a `ClassifiedSegment[]` directamente — sin pasar por física, porque el usuario ya marca zona.

Output común a las cuatro combinaciones: `Array<{ zone: 1|2|3|4|5|6; cadenceProfile: 'flat'|'climb'|'sprint'; durationSec: number }>`. El campo `cadenceProfile` viaja por toda la pipeline aunque en running solo es informativo.

### Modelo de zonas (Coggan 6 zonas + cadenceProfile)

Se trabaja con **6 zonas** (Z1-Z6 lineales, sin sub-zonas), siguiendo el estándar Coggan adaptado al curso de ciclo indoor. Cada bloque combina **zona** (intensidad cardíaca/potencia/muscular) y **cadenceProfile** (tipo de pedaleo: `flat` llano, `climb` escalada, `sprint` sprint).

**Decisiones de diseño clave:**
1. **La cadencia objetivo depende del profile, no de la zona.** En cycling real una canción a 80 rpm sirve para Z2, Z3 o Z4 según la resistencia y la energía del track.
2. **Cadencia es el ÚNICO criterio excluyente.** Energy y valence afectan al score (probabilidad de elección) pero NO descartan tracks. Esto evita que zonas con perfil sonoro estricto se queden sin candidatos por umbrales arbitrarios.

**Cadencia por profile** (rangos rpm — único filtro excluyente, vía 1:1 o 2:1 half-time):

| Profile | Cadencia (rpm) 1:1 | BPM canción 1:1 ∪ 2:1 | Aplicable a |
|---|---|---|---|
| `flat` | **70-90** | 70-90 ∪ 140-180 BPM | Z1, Z2, Z3, Z4 (pedaleo continuo sostenible) |
| `climb` | **55-80** | 55-80 ∪ 110-160 BPM | Z3, Z4, Z5 (escalada, cadencia baja, fuerza) |
| `sprint` | **90-115** | 90-115 ∪ 180-230 BPM | Z6 (anaeróbico, máxima cadencia) |

**Por qué los límites son 55-80 (climb) y 90-115 (sprint)**: la "zona muerta" 110-120 BPM en el catálogo musical concentra mucho rock y dance clásico (Bowie, Zeppelin, Hendrix, Queen, Metallica, MJ, Avicii…). Ampliar climb 1:1 a 55 rpm rescata todo ese rango como climb 2:1 (110-160 BPM), y sprint 1:1 a 115 rpm añade 110-115 BPM al pool de sprint. 55 rpm en escalada es válido para muros Z5 (fuerza pura); 115 rpm en sprint sigue siendo cadencia muy alta pero alcanzable en Z6 supramáximo de pocos segundos.

**Perfil sonoro IDEAL por zona** (afecta al score, no excluye):

| Zona | Nombre | %FTP | %FCmáx | Profiles válidos | Energy ideal | Valence ideal | Color |
|---|---|---|---|---|---|---|---|
| Z1 | Recuperación completa | <55% | <60% | flat | 0.30 | 0.40 | azul `#3b82f6` |
| Z2 | Recuperación activa | 55-75% | 60-70% | flat | 0.55 | 0.50 | verde `#22c55e` |
| Z3 | Tempo / MLSS | 75-90% | 70-80% | flat **o** climb | 0.70 | 0.55 | amarillo `#eab308` |
| Z4 | Potencia umbral / VT2 | 90-105% | 80-90% | flat **o** climb | 0.80 | 0.60 | naranja `#f97316` |
| Z5 | VT2 / PAM (muros) | 105-120% | 90-100% | climb (fijo) | 0.90 | 0.65 | rojo `#ef4444` |
| Z6 | Supramáxima (sprint) | >120% | (FC saturada) | sprint (fijo) | 0.95 | 0.70 | morado `#7e22ce` |

Tracks con `energy`/`valence` lejos del ideal puntúan más bajo pero siguen siendo elegibles. El motor maximiza el score conjunto.

Si el usuario marca "todo con energía", `energyIdeal` de Z1-Z2 sube a 0.70 (ideal, no umbral).

### Plantillas de sesión científicas (`src/core/segmentation/sessionTemplates.ts`)

Cada `SessionTemplate` lleva un campo `sport: 'bike' | 'run'`. La galería del `SessionBuilder` filtra por `sport` (las de bike no aparecen en sesiones de running y viceversa). Plantillas predefinidas basadas en literatura de entrenamiento — el usuario puede partir de una y editarla, o construir desde cero.

**Ciclismo (`sport: 'bike'`)**:

- **SIT** (Sprint Interval Training): 6 sprints de 30 s en **Z6 + sprint** + recuperaciones largas Z1 + flat.
- **HIIT 10-20-30** (Bangsbo): el intervalo de 10 s es **Z6 + sprint**; los de 20 s Z3 + flat; los de 30 s Z2 + flat.
- **Noruego 4×4** (Helgerud et al., NTNU): 4 × (4 min Z4 + flat / 3 min Z2 + flat). VO₂max.
- **Z2 continuo**: sesión sostenida Z2 + flat.

**Carrera (`sport: 'run'`)**:

- **Easy run** (E-pace de Daniels): rodaje continuo en Z2. Base aeróbica del plan de fondo (5 K → marathon → ultra).
- **Yasso 800s** (Bart Yasso): 10 × 800 m en Z5 con 400 m de recovery suave Z2. Predictor clásico de tiempo de marathon (el tiempo medio de los 800 m en min:seg ≈ tiempo objetivo en h:min).
- **Daniels Intervals (vVO₂max)**: 5 × 1000 m en Z5 con 2:30 de recovery Z1 trotando muy suave. Mejora el techo cardiovascular.
- **Threshold Cruise** (Daniels T-pace): 3 × 1500 m en Z4 con 90 s de recovery Z1. El ritmo "más rápido que puedes sostener una hora" — capacidad de tolerar lactato.
- **HIIT 30-30**: 10 × (30 s Z5 + 30 s Z2). Estímulo VO₂max de tiempo total breve, alta densidad.

En running el campo `cadenceProfile` de los bloques se rellena por convención a `'flat'`: el matching musical en running se acopla a la zona, no al terreno (ver siguiente sección).

### Tests fisiológicos guiados (`kind: 'test'`)

Algunas `SessionTemplate` llevan `kind: 'test'` además de `kind: 'workout'` (default). Son **plantillas-test** que el usuario ejecuta en Modo TV y, al terminar, introduce los datos clave del test en un modal genérico (`TestResultDialog`) que aplica un `compute()` puro sobre la fórmula correspondiente y persiste el delta resultante en `cadenciaStore.userInputs` (sincronizado con Drive si está conectado). Las fórmulas viven en [src/core/physiology/tests.ts](src/core/physiology/tests.ts) con tests golden TDD.

**Ciclismo (3 tests)**:

- **Rampa lineal** (`bike-test-ramp`): +25 W/min hasta agotamiento. `FTP = 0,75 × MAP` (Michalik 2019, Valenzuela 2018). El usuario introduce la potencia minuto pico (MAP). Disclaimer hardware: el rodillo debe estar configurado en modo NIVEL/SLOPE para que la rampa avance correctamente.
- **5-min PAM all-out** (`bike-test-map5`): 5 minutos all-out tras calentamiento. Estima `VO₂max = 16,6 + 8,87 × (P5min/peso)` (Sitko 2021, regresión bayesiana sobre 46 ciclistas amateur, R² 95% CI 0,61–0,77) y captura la FCmáx pico del usuario.
- **3MT all-out** (`bike-test-3mt`): 3 minutos all-out con resistencia FIJA. `CP = potencia media de los últimos 30 s`; `W' = trabajo total − CP·180` (Vanhatalo 2007, Black 2013). Disclaimer crítico: el rodillo debe ir en **NIVEL/SLOPE**, NO en modo ERG (en ERG la resistencia se auto-ajusta y el resultado es inválido sin error visible).

**Running (3 tests, todos HR-only — sin potenciómetro)**:

- **Daniels FCmáx** (`run-test-hrmax-daniels`): 4 min duro + 1 min recuperación + 3 min all-out. La FC pico registrada es la FCmáx real del usuario (más fiable que cualquier estimación por edad/sexo). Protocolo de Zhou 2001 + Daniels Running Formula.
- **5-min all-out run** (`run-test-5min`): captura FCmáx (pico) y estima LTHR ≈ FC media de los 5 min (en un esfuerzo all-out de 5 min la FC media cae en el 92-95 % de la FCmáx y se aproxima a la LTHR de Joe Friel).
- **30-15 IFT** (`run-test-30-15-ift`): test intermitente Buchheit 2011. 30 s corriendo + 15 s descanso, velocidad creciente +0,5 km/h por estadio. Stage 1 = 8 km/h. `vMAS = 8 + 0,5·(stage−1)`. Disclaimer hardware: requiere conos a 40 m y app de audio oficial Buchheit. vMAS es informativa en V1 (no alimenta el matching); el valor real está en la FCmáx pico capturada.

**Arquitectura UI**: cada `TestProtocol` declara `inputs[]` (preguntas numéricas con id/label/unit/min/max), un `compute()` puro que devuelve `TestResult { delta: Partial<UserInputsRaw>, derived: TestDerivedValue[] }`, y `citationDois[]` con los DOIs (la UI los renderiza como links a doi.org). Si `hardwareDisclaimer` está presente, antes de abrir Modo TV se muestra el `TestSetupDialog` con el aviso crítico (rampa, 3MT, 30-15 IFT). Al completar la sesión, `SessionTVMode` lee `templateId` del `TVHandoffPayload` y, si la plantilla activa es un test, dispara el `TestResultDialog` que itera sobre `inputs[]` — añadir un séptimo test no requiere código nuevo de UI, solo declarar la nueva entrada en `SESSION_TEMPLATES` con su `testProtocol`.

La galería del `SessionBuilder` muestra una **pestaña «Tests»** separada de la de plantillas de entrenamiento (filtrado vía `templatesBy(sport, 'test' | 'workout')`).

### Algoritmo de matching (determinista)

**Multisport — qué cambia entre bike y run**: el motor de matching es el mismo (mismo scoring, misma regla cero-repeticiones, misma política strict/best-effort/repeated). Lo único distinto es **el filtro de cadencia**: en cycling la cadencia musical (rpm pedaleando 1:1 al beat o 2:1 half-time) depende del `cadenceProfile` del bloque (flat/climb/sprint); en running la cadencia natural se acopla a la zona (cadencia de zancada ~160-180 spm es bastante uniforme), por lo que el `cadenceProfile` deja de discriminar y los rangos de cadencia musical aplican en función directa de la zona Z1-Z6. El resto del pipeline (energy/valence ideales por zona, género preferido, scoring, fallback cross-zone) es idéntico.

**Regla cero repeticiones (vinculante):** ninguna canción aparece dos veces en la playlist final. Esto vale en ambos deportes y en ambos modos (`overlap` GPX y `discrete` sesión).

**Filtro por cadencia con dual-range** (`src/core/matching/candidates.ts`): un track encaja con una `(zona, profile)` si su `tempoBpm` cae en uno de los dos rangos válidos:

- **Match 1:1**: `tempoBpm ∈ [cadenceMin, cadenceMax]`. Track de 80 BPM se pedalea a 80 rpm (una pedalada por beat).
- **Match 2:1 (half-time)**: `tempoBpm ∈ [2·cadenceMin, 2·cadenceMax]`. Track de 145 BPM se pedalea a 72.5 rpm (golpe fuerte cada 2 pedaladas).

Esto compensa el sesgo half-time del algoritmo de tempo de Spotify, que etiqueta muchas canciones rock/pop al doble de su tempo perceptual. Con el filtro dual, "Born to Be Wild" (BPM Spotify ~145) cae correctamente en Z5 + climb (cadencia objetivo 55-75 rpm).

Para cada segmento `(zona, profile, duración)`:

1. **Filtrar candidatos SOLO por cadencia** (1:1 ∪ 2:1). Energy, valence y género NO descartan, son scores.
2. Ordenar por `score = 0.30 × cadencia + 0.30 × energy + 0.20 × valence + 0.20 × género`. Cada componente es 0..1:
   - `cadencia` = `max(score 1:1, score 2:1)`, lineal triangular contra el midpoint del rango.
   - `energy` = `(1 - |track.energy - zone.energyIdeal|)²` — **cuadrática**: penaliza más fuerte los outliers, importante en zonas con ideal extremo (Z1 ideal 0.30, Z6 ideal 0.95).
   - `valence` = `(1 - |track.valence - zone.valenceIdeal|)²` — cuadrática igual que energy.
   - `género` = 1 si match preferencia, 0 si no, 0.5 si lista vacía.
3. Seleccionar el track con mayor `score`. Política de selección con prioridad:
   - **`strict`**: candidato fresh con cadencia OK (idealmente).
   - **`best-effort` cross-zone**: si todos los strict de la zona están usados, busca CUALQUIER track no usado del catálogo entero (cadencia puede no encajar) y elige el mejor según el ideal de la zona. Prioriza variedad sobre coincidencia exacta de cadencia.
   - **`repeated`**: solo cuando TODO el catálogo ha sido usado en la playlist. Repite el mejor track del ranking de cadencia. Es el último recurso.
   - **`insufficient`** (`track: null`): solo cuando el catálogo está literalmente vacío. La UI muestra banner rojo.

   Esto garantiza que NUNCA se repita una canción mientras quede una alternativa fresca, aunque su cadencia no sea ideal. La UI marca los `best-effort` y `repeated` para que el usuario sepa que mejorará subiendo más listas.
4. **Una entrada por canción**: si una canción es lo bastante larga para cubrir varios segmentos consecutivos de la misma zona, aparece una sola vez en la playlist. Comportamiento controlado por `crossZoneMode: 'overlap' | 'discrete'` (overlap por defecto en modo GPX, discrete en modo sesión).

**Pre-check de cobertura** (`src/core/matching/poolCoverage.ts`): `MusicStep` invoca `analyzePoolCoverage(segments, tracks, preferences)`. **NO bloquea el avance** — es informativo. Si `neededTotal > availableTotal`, la UI muestra un panel sugiriendo subir más listas para evitar repeticiones, pero el usuario puede seguir adelante (la playlist se genera con repeticiones marcadas).

**Sustitución manual ("Otro tema")** (`src/core/matching/replaceTrack.ts` → `getAlternativesForSegment`, `replaceTrackInSegment`): el usuario puede sustituir cualquier track de la playlist final desde un dropdown que muestra alternativas válidas no repetidas. Política en dos niveles:

1. **Strict primero**: por defecto solo se ofrecen tracks que pasan filtro de cadencia (1:1 ∪ 2:1) y no están en uso en otro slot.
2. **Fallback al catálogo entero**: si ningún strict queda libre (catálogo agotado o sin candidatos ideales para esa zona), cae al resto del catálogo libre, ordenado por score. Garantiza que el dropdown nunca aparezca vacío mientras quede algún track no usado.
3. **Aviso pre-elección**: cada `AlternativeCandidate` lleva un flag `passesCadence: boolean`. Si todas las opciones del dropdown son `passesCadence: false`, la UI pinta una cabecera dorada **"Sin opciones ideales libres"** antes del listado para avisar al usuario.
4. **Calidad del nuevo slot**: se recalcula track-a-track via `passesCadenceFilter` al sustituir (no se hereda del slot anterior). Si el track elegido encaja en cadencia → `'strict'`; si no → `'best-effort'`.
5. **Buscador por título o artista** (en el dropdown «Otro tema» de `PlaylistTrackRow`): filtro client-side sobre el ranking ya calculado, manteniendo el orden por score (las mejores opciones siguen apareciendo arriba). Diacritic- y case-insensitive (`"cafe"` matchea `"Café"`). Autofocus al abrir el popover, reset al cerrar, botón X para limpiar. El banner «Sin opciones ideales libres» se computa sobre la lista original (no sobre la filtrada) para no parpadear. Cero cambios en `src/core/`: el filtrado vive en la UI sobre lo que ya devuelve `getAlternativesForSegment`, así que la garantía cero-repeticiones se mantiene.

**Banner "Encaje libre" global** (`@ui/components/BestEffortBanner`): en `MusicStep` y `ResultStep`, si la playlist tiene ≥1 segmento con `matchQuality === 'best-effort'`, se muestra un banner dorado explicando el concepto y recomendando subir más listas. Reemplaza al chip pequeño que antes pasaba desapercibido.

**Determinista dada una semilla**: misma entrada `(segments, tracks, preferences, seed)` → misma salida. El motor admite variedad controlada vía `MatchPreferences.seed` (entero 32 bits): cuando está definida, en cada slot strict se hace **weighted sampling entre los top-K=5** candidatos del ranking de cadencia (PRNG mulberry32 con sub-semilla `hashSeed(seed, slotIndex)` por tramo, asegurando reproducibilidad por slot). Cuando es `undefined`, comportamiento legacy 100% determinista (top-1). La UI auto-genera una semilla en el primer mount y la persiste con el resto de `musicPreferences` en `sessionStorage`, así el callback OAuth de Spotify regenera la misma playlist. El botón "🎲 Regenerar lista" en `ResultStep` cambia la semilla y dispara un rematch — pensado para sesiones recurrentes (Noruego 4×4 cada martes con música distinta sin perder calidad). Las alternativas del dropdown "Otro tema" siguen siendo deterministas: el usuario espera ver las MEJORES, no más variedad ahí.

**Referencias bibliográficas (PubMed):**
- Dunst et al. 2024, *Frontiers in Physiology*: cadencia óptima por umbral metabólico — LT1 66 rpm, MLSS 82 rpm, VO₂max 84 rpm, sprint sin fatiga 135 rpm. [DOI: 10.3389/fphys.2024.1343601](https://doi.org/10.3389/fphys.2024.1343601)
- Hebisz & Hebisz 2024, *PLoS One*: HIIT a baja cadencia (50-70 rpm) produce mayor mejora aeróbica que a cadencia libre. [DOI: 10.1371/journal.pone.0311833](https://doi.org/10.1371/journal.pone.0311833)

---

## Librería de tracks

El catálogo nativo unificado vive en `src/data/tracks/all.csv` (un solo archivo, ~800 tracks) y se carga con un único `import` (`vite ?raw`). Se **compila** desde las listas individuales en `src/data/tracks/sources/` mediante el script `scripts/build-tracks.mjs`, ejecutable con `pnpm build:tracks`.

El compilador:

- **Deduplica por `Track URI`** (first-wins) entre listas que se solapan.
- **Descarta huérfanos**: tracks cuyo `tempoBpm` no encaja en NINGUNA cadencia válida (60-80 ∪ 70-90 ∪ 90-115 ∪ 110-160 ∪ 140-180 ∪ 180-230 BPM). El motor jamás los consideraría — dejarlos solo añade peso al bundle.
- **Anota la columna `Source`** con el nombre del CSV origen (informativo, para trazabilidad humana al inspeccionar `all.csv`).

Para añadir o reemplazar listas: deja el CSV nuevo (export de Spotify) en `src/data/tracks/sources/` y vuelve a ejecutar `pnpm build:tracks`. Commitea el CSV fuente nuevo + el `all.csv` regenerado en el mismo commit. Los rangos válidos en el script deben mantenerse en sync con `src/core/matching/zoneCriteria.ts`.

Columnas usadas:

- `Tempo` → BPM
- `Energy`, `Valence` → discriminadores principales para zonas
- `Genres` → matching de género preferido
- `Track URI` → identificador único + uso directo para añadir a playlist Spotify
- `Source` → trazabilidad informativa (no usado en el matching)

En `MusicStep` el usuario elige fuente: `'predefined'` (solo `all.csv`), `'mine'` (solo CSVs propios subidos en runtime) o `'both'` (mergea ambos en memoria, dedup por URI). El catálogo activo viaja como prop a `ResultStep` (state `livePool` en `App.tsx`, no persistido en `sessionStorage` para no inflarlo) — así la sustitución manual ("Otro tema") busca alternativas en el mismo pool con el que se generó la playlist.

---

## Integraciones externas

| Servicio | Uso | Token |
|---|---|---|
| **Spotify** | OAuth PKCE solo al pulsar "Crear playlist" | `sessionStorage`, expira con la pestaña |
| **Google Drive** | OAuth GIS opt-in para sincronizar ajustes y sesiones entre dispositivos. Scope `drive.appdata` (carpeta privada del usuario, invisible en su UI normal de Drive) | `localStorage` (`cadencia:gdrive:token`), expiry 1h con silent refresh |
| **Strava** | Import GPX manual (el usuario exporta el GPX desde Strava y lo sube) | — |
| **Komoot** | Import GPX manual (su API requiere partner comercial) | — |

**Ningún token de Spotify va a `localStorage`, a un backend, ni a logs.** El token de Google Drive sí va a `localStorage` (el patrón GIS lo requiere) pero nunca a backend ni a logs. Las dos superficies OAuth de la app son **Spotify** (al pulsar "Crear playlist") y **Google Drive** (al pulsar "Conectar mi Google Drive"); ambas son opt-in explícito y la app funciona sin ninguna de ellas.

### Endpoints Spotify usados

```http
POST /v1/me/playlists                                  # crear playlist privada
POST /v1/playlists/{playlist_id}/items                 # añadir tracks por URI
GET  /v1/search?q=track:{n}+artist:{a}&type=track      # solo si falta URI
```

Scope: `playlist-modify-private`.

> **Nota — rename feb-2026 de Spotify**: los endpoints antiguos `POST /v1/users/{user_id}/playlists` y `POST /v1/playlists/{id}/tracks` fueron retirados en febrero de 2026 y devuelven **403 silencioso** (sin razón, sin error legible). Los endpoints actuales son los listados arriba: `/me/playlists` para crear y `/items` para añadir tracks (renombrado para soportar episodios de podcast). Si en algún momento algo devuelve 403 en el OAuth flow después de autenticar correctamente, este es el primer sospechoso.

### Modelo BYOC ("Bring Your Own Client ID") — puro

**Por qué este modelo y no Extended Quota Mode**: Spotify endureció Extended Quota Mode el **15-mayo-2025** y solo lo concede a **organizaciones legalmente registradas con ≥250.000 MAU + revenue verificable + servicio lanzado**. En paralelo, Development Mode quedó limitado a **5 testers por Client ID** (no 25 como decía la doc anterior). Esto crea un círculo vicioso imposible para apps indie: necesitas 250k MAU para crecer pero solo puedes mostrar la app a 4 personas más para conseguirlos. Cadencia es un proyecto de código fuente público (uso no comercial) sin SL ni monetización, así que la única vía de uso público es **BYOC**: cada usuario crea SU PROPIO Client ID en `developer.spotify.com` (3 minutos, gratis) y lo pega en Cadencia. Cada usuario es entonces dueño de su propia cuota de Development Mode.

Resolución del Client ID activo, en [src/integrations/spotify/clientId.ts](src/integrations/spotify/clientId.ts):

```
1. Client ID custom guardado por el usuario (cadencia:spotify:custom-client-id:v1 en localStorage) → lo usamos
2. → null → la UI abre el modal BYOC al pulsar "Crear playlist"
```

**No hay fallback compartido**. La operadora del repo no mantiene un Client ID por defecto en producción: todo el mundo (incluida ella misma) configura su propio Client ID via el wizard. Esto evita el cuello de botella de tener que curar manualmente una lista de 5 testers cuando llegan visitantes nuevos.

Tres superficies coordinadas:

1. **`ByocTutorialDialog`** ([src/ui/components/ByocTutorialDialog.tsx](src/ui/components/ByocTutorialDialog.tsx)): wizard de 5 pantallas (intro + 4 pasos: crear app, rellenar formulario, añadir tu cuenta como tester en User Management, copiar+pegar Client ID). Capturas reales del dashboard de Spotify (`/byoc/step-N.png`) ampliables a lightbox. Input con validación inline (regex `/^[a-f0-9]{32}$/i`) + read-after-write para detectar fallos silenciosos de localStorage. Se dispara desde dos puntos: (a) `ResultStep` al pulsar «Crear playlist» si `getSpotifyClientId()` es null, (b) `MyPreferencesPage` desde la sub-sección «Tu Client ID». Tras `setStoredClientId`, invoca `onSaved(newId)` para que el caller reintente el flujo OAuth con el id fresco (override explícito, no del closure).
2. **`SpotifyAccessSection`** en [MyPreferencesPage](src/ui/pages/MyPreferencesPage.tsx): card unificado «Conexión con Spotify» con dos sub-secciones numeradas:
   - **(1) Tu Client ID** — `ClientIdSubsection`. Dos estados: configurado (muestra preview del id con 28 puntos + últimos 4 chars por privacidad visual + botones «Cambiar» / «Borrar» con `ConfirmDialog`) o sin configurar (CTA «Configurar el mío» que abre el wizard).
   - **(2) Tu sesión** — `SessionSubsection`. Estado de la sesión OAuth en este tab (sessionStorage). Botón «Desconectar» si hay sesión.
3. **`SpotifyAccessDeniedDialog`** ([src/ui/components/SpotifyAccessDeniedDialog.tsx](src/ui/components/SpotifyAccessDeniedDialog.tsx)): modal del 403. En el modelo BYOC puro solo hay una causa para ese 403: el usuario olvidó añadir su cuenta a «Users and Access» en SU PROPIA app. Le mandamos al dashboard con instrucciones paso a paso. El `ResultStep` captura `SpotifyAuthorizationError` y abre este dialog en lugar del banner genérico de error.

### Manejo explícito de errores de Spotify (reportabilidad)

**Principio**: cualquier error de Spotify que escape al usuario debe ser **explícito y copiable**. Sin DevTools de por medio. Aplicado en dos capas:

**Capa de integración** (`src/integrations/spotify/`):

- `fetchSpotify` (api.ts) lanza `SpotifyAuthorizationError` ante un 403 (clase exportada desde el barrel `@integrations/spotify`) y `Error` con mensaje formato `Spotify API <status> en <method> <path>: <detail>` para el resto. `console.error` etiquetado con `[Spotify API error]` y body raw truncado a 500 chars.
- `postTokenRequest` (auth.ts) parsea el JSON estándar OAuth `{error, error_description}` para mostrar `error_description` legible en lugar del raw body. Logueado con `[Spotify OAuth error]`.
- `callPlayer` (player.ts) propaga `method` y `path` a los kinds reportables (`'unknown'`, `'network'`) del discriminador `PlayerError`. Los kinds esperados (`'no-active-device'`, `'not-premium'`, `'token-expired'`) NO los llevan: son estados normales, no bugs reportables.

**Capa de UI** (`src/ui/components/`):

- **`SpotifyErrorReporter`** ([src/ui/components/SpotifyErrorReporter.tsx](src/ui/components/SpotifyErrorReporter.tsx)): componente compartido que muestra el mensaje técnico en `<pre>` monoespaciado + botón **«Copiar detalles»** (clipboard) + enlace **«Avisar por Telegram»** ([t.me/wellfitness_trainer](https://t.me/wellfitness_trainer)). Variantes `'light'` (fondo blanco para `ResultStep`) y `'dark'` (fondo negro semitransparente para Modo TV).
- **`ResultStep.tsx`**: el `error` (string) se renderiza con `<SpotifyErrorReporter>` directamente. El catch detecta `instanceof SpotifyAuthorizationError` para abrir `SpotifyAccessDeniedDialog` (con la variante BYOC adecuada) en lugar del reporter.
- **`MusicControlBar.tsx`** del Modo TV: línea pequeña de error como antes; **si** el error es reportable (`kind === 'unknown' | 'network'`), aparece un botón «Detalles» que abre un `<dialog>` oscuro embebiendo el `SpotifyErrorReporter` en variant dark. Los kinds esperados (`not-premium`, `token-expired`, `no-active-device`) no muestran ese botón — su mensaje amistoso ya basta.

Catch silencioso aceptable: solo el guardado del historial de playlist (`createPlaylistHistoryEntry`) y los fallbacks de `clipboard.writeText`. El primero loguea con `[Cadencia historial]` para que aparezca en captura de DevTools.

### Configuración del Client ID

El usuario abre Cadencia, llega al paso final y pulsa «Crear playlist». Si no tiene Client ID configurado, se abre `ByocTutorialDialog` con 5 pantallas que le guían a crear su propia app de Spotify y añadir su email a Users and Access. Tras pegar su id válido se persiste en `localStorage` (`cadencia:spotify:custom-client-id:v1`) y el flujo OAuth arranca automáticamente. Después puede gestionarlo desde `/preferencias` → «Conexión con Spotify» → sub-sección «Tu Client ID» (cambiar / borrar).

Cero configuración técnica del lado del operador del repo: el código no lee ningún `VITE_SPOTIFY_CLIENT_ID` ni necesita `.env.local` para Spotify. Cada usuario es 100% autónomo.

**Nota sobre `127.0.0.1` vs `localhost`**: Spotify dejó de aceptar `http://localhost` a finales de 2024. En desarrollo abre la app en `http://127.0.0.1:5173/`, no en `localhost`. El usuario debe registrar como Redirect URI en su app de Spotify la URL EXACTA del deploy donde corre Cadencia (en producción `https://cadencia.movimientofuncional.app/callback`); el wizard la muestra dinámicamente vía `getRedirectUri()`.

**No usar Client Secret**: PKCE prescinde del secret a propósito. Aunque Spotify lo muestre en el dashboard, el usuario no necesita copiarlo a ningún sitio.

### Limitaciones conocidas (otras plataformas musicales)

**Solo Spotify** está soportado. Las alternativas comunes no son viables con la arquitectura cliente-only actual:

- **Apple Music**: requiere un Developer Token JWT firmado con clave privada de equipo Apple Developer. Esa clave NO puede vivir en código que se descarga al cliente. Necesitaría un backend que firme tokens, lo que rompe la regla "sin servidores".
- **Amazon Music**: no expone API pública para crear playlists.
- **YouTube Music**: no tiene API oficial; las soluciones no oficiales (ytmusicapi y similares) requieren cookies del usuario y violan ToS.

Si en el futuro se quisiera soportar otras plataformas, requeriría cambio arquitectónico (mini-backend que firme tokens).

### Sincronización opcional con Google Drive

Para que el usuario pueda llevar sus datos entre el móvil y el ordenador sin registrarse en Cadencia, se ofrece sincronización opcional con Google Drive usando el scope **`drive.appdata`** — una carpeta oculta privada del propio usuario, invisible incluso para él en la UI normal de Drive. Solo Cadencia (con el Client ID configurado) puede leer y escribir en esa carpeta, y solo en la cuenta del usuario. Nosotros no vemos ningún dato.

**Qué se sincroniza** (un único archivo `cadencia_data.json`):

- `userInputs`: peso, FTP, FCmáx, FC reposo, año de nacimiento, sexo biológico, tipo y peso de bici.
- `musicPreferences`: géneros preferidos, semilla de generación, "todo con energía", modo de fuente.
- `savedSessions`: planes de sesión indoor que el usuario haya guardado con un nombre desde el botón "Guardar como mi sesión" en `SessionBuilder`.
- `uploadedCsvs`: listas CSV propias subidas por el usuario. Persistimos el `csvText` raw (re-parseable con `parseTrackCsv` en cada device) en lugar de los tracks parseados — más compacto, source-of-truth honesta y resistente a cambios futuros del catálogo de Spotify.
- `nativeCatalogPrefs`: denylist (`excludedUris`) de canciones del catálogo nativo desmarcadas en `CatalogEditorPage`. Modelo denylist en lugar de allowlist porque típicamente <50 URIs vs 800.
- `dismissedTrackUris`: URIs descartadas globalmente. Dos puntos de entrada: (a) botón «No la quiero» en cada track de `ResultStep`; (b) botón rojo de cada fila del catálogo nativo en `CatalogEditorPage` (icono `do_not_disturb_on`). Aplicables a cualquier source. El livePool del wizard las filtra antes del matching y la pestaña «Catálogo nativo» las oculta de su lista (siguen accesibles en «Descartadas» con su botón «Recuperar»). Distinto del checkbox de inclusión/exclusión del catálogo nativo, que solo afecta a la denylist `nativeCatalogPrefs.excludedUris` (catálogo bundled), mientras que `dismissedTrackUris` es cross-source.
- `plannedEvents`: entradas del **calendario de planificación** (`/calendario`) — entrenamientos futuros que el usuario ha programado. Pueden ser puntuales o recurrentes semanales (`recurrence.daysOfWeek`), de tipo `indoor` (referencia a una `SavedSession` por id) o `outdoor` (nombre + URL externa opcional, sin GPX persistido). Borrado lógico vía `deletedAt` con expiry 30 días. Ver «Calendario de planificación» abajo.
- `playlistHistory`: historial de las playlists creadas en Spotify. Snapshot frozen capturado solo tras éxito de `createPlaylistWithTracks` en `ResultStep` (no en generaciones intermedias o abandonadas). Cada entrada lleva los tracks que llegaron a Spotify (uri, name, artist joineado, genres, tempoBpm, zona, duración del segmento, matchQuality, `wasReplaced` per-track), zoneDurations agregadas, deporte, modo (gpx/session) y la seed del motor. Mismo patrón de array merge LWW + tombstones que `savedSessions`. Alimenta la pestaña **Estadísticas** (`/catalogo?tab=stats`): top 20 tracks, top 15 artistas, top 10 géneros (ponderado por duración), distribución de zonas, ratio de sustituciones manuales y vista cronológica de las últimas 30 listas creadas. Funciones puras en `src/core/playlist/historyStats.ts`.
- `tvModePrefs`: preferencias del Modo TV. Por ahora una única clave (`voiceEnabled: boolean`, default `true`) que controla si la voz del entrenador (Web Speech API) anuncia cada nuevo bloque. Se sincroniza con Drive como sección atomic LWW: silenciar la voz en el móvil propaga al portátil. Editable también desde [/preferencias](src/ui/pages/MyPreferencesPage.tsx) (sección «Modo TV»).

**Qué NO se sincroniza** (deliberadamente):

- Estado del wizard ephemeral (paso actual, ruta procesada, lista casada, índices reemplazados): vive solo en `sessionStorage` y se borra al cerrar la pestaña. No tiene sentido sincronizarlo.
- GPX subidos: pueden ser MB; el usuario ya los tiene en Strava/Komoot.
- Tokens de Spotify ni de Drive: nunca se exfiltran.

**Arquitectura del motor de sync**:

`src/core/sync/` (puro, testable sin DOM):

```typescript
// types.ts
export interface SyncedData {
  schemaVersion: 1;
  updatedAt: string;
  _sectionMeta: {
    userInputs?: SectionMeta;
    musicPreferences?: SectionMeta;
    savedSessions?: SectionMeta;
    uploadedCsvs?: SectionMeta;
    nativeCatalogPrefs?: SectionMeta;
    dismissedTrackUris?: SectionMeta;
    plannedEvents?: SectionMeta;
    playlistHistory?: SectionMeta;
    tvModePrefs?: SectionMeta;
  };
  userInputs: UserInputsRaw | null;
  musicPreferences: MatchPreferences | null;
  savedSessions: SavedSession[];
  uploadedCsvs: UploadedCsvRecord[];
  nativeCatalogPrefs: NativeCatalogPrefs | null;
  dismissedTrackUris: string[];
  plannedEvents: PlannedEvent[];
  playlistHistory: PlaylistHistoryEntry[];
  tvModePrefs: TvModePrefs | null;
}
```

- **Atomic LWW por sección** (`userInputs`, `musicPreferences`, `nativeCatalogPrefs`, `dismissedTrackUris`, `tvModePrefs`): el lado con `_sectionMeta[section].updatedAt` mayor gana. En empate exacto wins remote (idempotencia tras pull-merge-push) y se anota conflicto.
- **Array merge por id con tombstones** (`savedSessions`, `uploadedCsvs`, `plannedEvents`, `playlistHistory`): unión item-level por `id`. LWW por `updatedAt` de cada item. Borrado lógico vía `deletedAt` (tombstone) que se propaga via sync antes de purgarse a los 30 días (`cleanExpiredTombstones`).
- **Anti-regresión**: si local está vacío y remote tiene datos, aplica remote sin merge. Si local tiene <30% de la riqueza de remote (instalación nueva), también aplica remote directo.
- **Anti-ciclo**: flag `_applyingRemote` evita que `pull` dispare `push` tras actualizar `cadenciaStore` con datos descargados.

`src/integrations/gdrive/` (auth + REST, depende de `core/sync`):

- `auth.ts`: GIS popup, tokens en `localStorage` con buffer 5min antes del expiry real.
- `drive-api.ts`: REST puro contra Drive v3, retry automático en 401 vía `setTokenRefresher`.
- `sync.ts`: orquestador. Push debounceado (2s), pull periódico (30s) ligero (solo metadata), pull en `visibilitychange`. `init()` registra los listeners y hace silent sync inicial si el usuario ya estaba conectado.

`src/ui/state/cadenciaStore.ts`: single source of truth en `localStorage` con la key `cadencia:data:v1`. Cada `updateSection` bumpea el meta de la sección y dispara el evento `cadencia-data-saved` que el motor de sync observa.

`src/ui/components/sync/`: `GoogleSyncCard` (botón conectar/desconectar) y `SyncStatusBadge` (indicador de salud).

### Endpoints Drive API usados

```http
GET  /drive/v3/files?spaces=appDataFolder&q=name='cadencia_data.json'   # findFile
GET  /drive/v3/files/{id}?alt=media                                      # readFile
GET  /drive/v3/files/{id}?fields=id,version,modifiedTime                 # getFileMetadata (poll)
POST /upload/drive/v3/files?uploadType=multipart                         # createFile
PATCH /upload/drive/v3/files/{id}?uploadType=multipart                   # updateFile
```

Scope: `https://www.googleapis.com/auth/drive.appdata` (no requiere verificación de Google porque es "non-sensitive").

### Configuración del Client ID Google

Se configura por `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

Pasos:
1. https://console.cloud.google.com/apis/credentials → Create Credentials → OAuth client ID → Web application.
2. Authorized JavaScript origins: `http://127.0.0.1:5173` (dev) y `https://cadencia.movimientofuncional.app` (prod).
3. Authorized redirect URIs: ninguno (GIS usa popup, no redirect).
4. OAuth consent screen: añadir scope `https://www.googleapis.com/auth/drive.appdata`. App publishing puede quedarse en "Testing" — el scope es non-sensitive y no necesita verificación.
5. Copiar el Client ID al `.env.local`.

**Sin Client Secret**: PKCE no lo necesita (igual que Spotify). Aunque Google lo muestre, no debe meterse en `.env.local` con prefijo `VITE_*` — acabaría visible en el bundle JS público.

**`127.0.0.1` no `localhost`**: por consistencia con Spotify (Spotify lo exige; Google es más laxo pero conviene unificar).

---

## Calendario de planificación

`/calendario` permite al usuario programar entrenamientos futuros sin salir de Cadencia. La entrada del calendario es un `PlannedEvent` (en [src/core/calendar/types.ts](src/core/calendar/types.ts)) y NO contiene el plan en sí — solo la metadata para localizarlo o describirlo. Esta separación entre «evento del calendario» y «contenido del entrenamiento» mantiene `plannedEvents` ligero (~200 bytes/entrada) aunque haya cientos de entradas a lo largo de los años.

### Tipos de entrada

| Tipo | Qué referencia | Al pulsar «Cargar» en la entrada |
|---|---|---|
| `indoor` | `savedSessionId` que apunta a una `SavedSession` del propio store | Rehidrata el plan completo (bloques, zonas, cadencias) en el `SessionBuilder` y salta el wizard al paso de Música |
| `outdoor` | `name` + `externalUrl` opcional (Strava, Komoot, RideWithGPS) | Resetea el wizard a modo GPX y, si hay URL, la abre en pestaña nueva para que el usuario descargue el GPX el día del entrenamiento |

El GPX **nunca** se persiste en `plannedEvents`. Razón: pueden ser MB y el usuario ya los tiene en Strava/Komoot. La planificación outdoor es solo un recordatorio con enlace.

### Recurrencia

```typescript
recurrence: { daysOfWeek: number[] } | null   // null = puntual; array = recurrente semanal
skippedDates: string[]                         // YYYY-MM-DD excluidos de la serie
```

- `null` → entrada puntual, aparece solo en `event.date`.
- `{ daysOfWeek: [2, 4] }` → cada martes y jueves desde `event.date`. **Sin fecha de fin** (las series no expiran).
- Para saltar una semana sin borrar la serie: añadir la fecha a `skippedDates`. La UI ofrece «Saltar este día» en cada `EventInstance`.
- Editar la entrada modifica **toda la serie**: no hay edición por instancia. Si el usuario quiere una excepción, debe saltar la instancia y crear una entrada puntual nueva ese día.

`expandRecurrences(events, from, to)` (en `events.ts`) genera el array de `EventInstance` resueltas en una ventana de fechas — usado por la vista mes y por el `TodayBadge`.

### Tombstones y sincronización

- Borrado lógico igual que `savedSessions`/`uploadedCsvs`: campo `deletedAt`, propagación via array merge LWW, purga automática a los 30 días con `cleanExpiredTombstones`.
- Sincroniza vía `plannedEvents` en `SyncedData` (sección con tombstones, no atomic LWW). Si el usuario crea una entrada en el móvil y borra otra en el portátil, ambos cambios sobreviven al merge.

### Acceso rápido desde el wizard

El **`TodayBadge`** (`src/ui/components/TodayBadge.tsx`) se ancla en el header del wizard y muestra:

- El próximo `EventInstance` (puntual o recurrente) cuya fecha sea `>= hoy`.
- Un botón directo «Cargar este entreno» que invoca `loadPlannedEventToWizard` ([src/ui/lib/loadPlannedEvent.ts](src/ui/lib/loadPlannedEvent.ts)) — si hay progreso del wizard sin guardar, abre `ConfirmDialog` antes de sobrescribir.

Si el usuario no tiene entradas, el badge se oculta. No hay notificaciones nativas (PWA) — el badge sustituye a las push, evitando complicar el flujo de permisos del navegador.

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
5. **Convenciones de código y copy**: nombres de variables, funciones y archivos en **inglés**. Comentarios y commits en **castellano** correcto (con ñ y tildes). En **copy de usuario** (UI, FAQs, artículos de ayuda) evitar anglicismos innecesarios — usar el equivalente castellano cuando exista:

   | No usar | Usar |
   |---|---|
   | wizard | asistente |
   | playlist (en narrativa) | lista / sesión |
   | tab | pestaña |
   | popup | ventana emergente |
   | dropdown | menú |
   | track (en narrativa) | tema / canción |
   | setup | configuración |
   | default | predeterminado / por defecto |

   Excepción: términos del léxico oficial de un servicio cuando son nombres propios (ej. botón "Crear playlist en Spotify" porque Spotify llama a su entidad «playlist»). Para términos técnicos del dominio sin equivalente castellano natural se mantiene el original (FTP, GPX, BPM, OAuth, JSON, Karvonen, Coggan). Comillas tipográficas «...» en lugar de "..." cuando el texto es narrativo.
6. **Pre-commit Husky** ejecuta `pnpm typecheck` + `pnpm lint`. **Nunca `git commit --no-verify`**: si un check falla, arreglar la causa.

---

## Licencia y contribuciones

- Licencia: **PolyForm Noncommercial 1.0.0** ([LICENSE](./LICENSE)). Uso, modificación y redistribución libres **para fines no comerciales** (personal, estudio, hobby, investigación, organizaciones sin ánimo de lucro). Uso comercial requiere permiso expreso del autor (escribir a movimientofuncional.net@gmail.com). Mantener el aviso `Required Notice: Copyright (c) 2026 Elena Cruces — Movimiento Funcional` en cualquier copia o trabajo derivado.
- Contribuciones externas: **no se aceptan pull requests**. Issues bienvenidos en GitHub para reportar bugs o proponer mejoras. Ver [CONTRIBUTING.md](./CONTRIBUTING.md).
- Las dependencias instaladas son todas licencias permisivas (MIT, ISC, Apache-2.0, BSD), compatibles con redistribución bajo PolyForm Noncommercial. Si se va a añadir una dependencia con licencia copyleft fuerte (GPL, AGPL) o con cláusulas anti-comerciales propias, parar y preguntar primero.

---

## Subagentes (definidos en `.claude/agentes.md`)

| Tarea                                                    | Subagente                       |
| -------------------------------------------------------- | ------------------------------- |
| Feature nueva desde cero (con type-check + lint + tests) | `web-quality-enforcer`          |
| Limpiar errores TypeScript / ESLint existentes           | `typescript-eslint-fixer`       |
| UI/componentes / verificación visual                     | `ui-ux-designer`                |
| Revisar contra los estándares de este archivo            | `project-aware-code-reviewer`   |

`supabase-database-specialist` no aplica (no hay BD).
