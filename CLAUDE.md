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
pnpm build:tracks         # Recompila src/data/tracks/all.csv desde sources/
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
| 2 | **Ruta** | `RouteStep` → bifurca a `GpxRouteFlow` o a `SessionBuilder` según el modo elegido. | Outdoor: sube GPX y procesa segmentos. Indoor: construye sesión por bloques desde plantilla o desde cero; cada bloque muestra los rangos bpm/W del usuario para su zona. |
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
    physiology/               # FC máx (Gulati ♀ / Tanaka ♂), zonas Karvonen y Coggan
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
Peso corporal (kg)               obligatorio en modo gpx; opcional en modo session (default 70)
FTP en vatios (W)                opcional (suma rangos de potencia al builder y al modo TV)
FC máxima (bpm)                  obligatoria en session si no hay birthYear + sex
FC en reposo (bpm)               opcional (necesaria para zonas Karvonen completas)
Año de nacimiento                obligatorio en session si no hay FC máxima
Sexo biológico                   obligatorio si se estima FC máxima por edad
```

**Validación bifurcada por modo** (`src/core/user/validation.ts`):

| Campo | Modo `gpx` | Modo `session` |
|---|---|---|
| Peso | obligatorio (alimenta ecuación de potencia) | opcional, default 70 kg |
| FTP | opcional; junto con FC máx/birthYear, uno mínimo | opcional (suma rangos de vatios al builder y al modo TV) |
| FC máx **o** (birthYear + sex) | uno mínimo si no hay FTP | **mínimo obligatorio** — sin esto, el modo TV no podría mostrar pulsaciones objetivo y el builder se quedaría sin guía de bpm por bloque |
| FC reposo | opcional (necesaria para zonas Karvonen) | opcional (necesaria para zonas Karvonen) |
| Sexo biológico | obligatorio sii `birthYear && !maxHeartRate` (para elegir fórmula) | obligatorio sii `birthYear && !maxHeartRate` (misma regla) |

La pública objetivo prioritaria son **ciclistas con pulsómetro** (FC), no con potenciómetro (FTP). Por eso en `session` se exige FC al menos como dato derivable (FC máx o estimable por edad+sexo): sin ello, el `SessionBuilder` y el modo TV pierden la mitad de su valor (los rangos de pulsaciones por bloque). FTP es la excepción para usuarios avanzados con potenciómetro y suma rangos de vatios cuando se rellena.

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

**Modo GPX**: agrupar puntos en bloques de **60 segundos** estimados. Para cada bloque: potencia media, zona (Z1–Z6), `cadenceProfile` inferido por pendiente (>6% → `climb`, resto → `flat`), duración.

**Modo sesión indoor**: el usuario define `SessionBlock`s con `{durationSec, zone, cadenceProfile, label}`. La función `fromSessionBlocks` los convierte a `ClassifiedSegment[]` directamente — sin pasar por física, porque el usuario ya marca zona y perfil.

Output común a ambos modos: `Array<{ zone: 1|2|3|4|5|6; cadenceProfile: 'flat'|'climb'|'sprint'; durationSec: number }>`.

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
| Z6 | Supramáxima (sprint) | >120% | (FC saturada) | sprint (fijo) | 0.95 | 0.70 | carmesí `#7c2d12` |

Tracks con `energy`/`valence` lejos del ideal puntúan más bajo pero siguen siendo elegibles. El motor maximiza el score conjunto.

Si el usuario marca "todo con energía", `energyIdeal` de Z1-Z2 sube a 0.70 (ideal, no umbral).

### Plantillas de sesión científicas (`src/core/segmentation/sessionTemplates.ts`)

Plantillas predefinidas basadas en literatura de entrenamiento. Cada usuario puede partir de una y editarla, o construir desde cero:

- **SIT** (Sprint Interval Training): 6 sprints de 30s en **Z6 + sprint** + recuperaciones largas Z1 + flat.
- **HIIT 10-20-30** (Bangsbo): el intervalo de 10s es **Z6 + sprint**; los de 20s Z3 + flat; los de 30s Z2 + flat.
- **Noruego 4×4** (Helgerud et al., NTNU): 4 × (4 min Z4 + flat / 3 min Z2 + flat). VO₂max.
- **Z2 continuo**: sesión sostenida Z2 + flat.

### Algoritmo de matching (determinista)

**Regla cero repeticiones (vinculante):** ninguna canción aparece dos veces en la playlist final. Esto vale en ambos modos (`overlap` GPX y `discrete` sesión).

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
