# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Objetivo

**Vatios con Ritmo** — App **source-available** (PolyForm Noncommercial — colaboración abierta, uso comercial reservado a la autora) que recibe un archivo **GPX** de una ruta ciclista, estima el perfil de **potencia (vatios)** por segmentos y genera una **playlist de Spotify ordenada** donde el BPM/energy (**ritmo**) de cada track encaja con la intensidad del segmento correspondiente.

Sin registros, sin base de datos, sin backend. Toda la lógica corre en cliente.

---

## Targets de distribución

| Target | Cómo se construye | Dónde se publica |
|---|---|---|
| **Webapp** | `pnpm build` → `dist/` estático | Hostinger (subir a `public_html` por SFTP) |
| **APK Android** | Capacitor 6 envuelve `dist/` → Android Studio → APK firmado | Google Play Store |

Ambos targets comparten **100% del código fuente**. La APK es una WebView de Chrome embedded; el comportamiento debe ser idéntico al web salvo donde un plugin de Capacitor lo extienda explícitamente.

---

## Stack

- **Build**: Vite 6
- **UI**: React 18 + TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Estilos**: Tailwind CSS 3
- **Wrapper Android**: Capacitor 6
- **Gestor de paquetes**: **pnpm** (nunca `npm` ni `yarn`)
- **PWA**: `vite-plugin-pwa` (manifest + service worker)
- **Charts**: Recharts (sobre puntos ya downsampleados a bloques de 60 s)
- **Tests unit**: Vitest + Testing Library + jsdom
- **Tests E2E**: Playwright
- **OAuth**: PKCE flow puro en cliente, **solo Spotify** y solo al crear la playlist. En Capacitor: `@capacitor/browser` (Custom Tabs + deep link).

---

## Comandos

```bash
pnpm install              # Instalar deps
pnpm dev                  # Vite dev server (http://localhost:5173)
pnpm build                # Build de producción → dist/
pnpm preview              # Preview del build
pnpm typecheck            # tsc --noEmit
pnpm lint                 # ESLint
pnpm lint:fix             # ESLint con autofix
pnpm test                 # Vitest unit, modo watch
pnpm test:run             # Vitest unit, run-once
pnpm test:coverage        # Cobertura sobre src/core/
pnpm test:e2e             # Playwright E2E
pnpm cap:sync             # Sincronizar dist/ con proyecto Android
pnpm cap:android          # Abrir Android Studio
```

---

## Arquitectura

Separación estricta entre **lógica pura** y **UI**, para que los cálculos sean unitestables y funcionen idénticos en web y dentro del WebView de Capacitor.

```
src/
  core/                    # TypeScript puro, SIN imports de React ni del DOM
    physiology/            # FC máx (Gulati), zonas Karvonen y Coggan
    gpx/                   # Parser GPX (DOMParser), haversine, pendiente
    power/                 # Ecuación de potencia (gravedad + rodadura + aero)
    segmentation/          # Bloques de 60 s, clasificación en zonas
    matching/              # Motor de scoring zona ↔ track
    tracks/                # Carga y deduplicación de CSVs

  integrations/
    spotify/               # OAuth PKCE + endpoints search/playlists/tracks

  ui/
    components/
    pages/

  data/tracks/             # CSVs embebidos (cinelli_rider, mix_alegre, trainingpeaks_virtual)

android/                   # Proyecto Capacitor (se genera con `pnpm dlx cap add android`)
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
Peso corporal (kg)               obligatorio
FTP en vatios (W)                opcional
  └── Si no hay FTP:
      FC máxima (bpm)            opcional
      FC en reposo (bpm)         opcional (necesaria para Karvonen)
      Año de nacimiento          obligatorio si no hay FC máx
```

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

### Cálculo de potencia por segmento

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

Agrupar puntos en bloques de **60 segundos** estimados. Para cada bloque:

- Potencia media
- Zona (Z1–Z5) según FTP o FC disponibles
- Duración en segundos

Output: `Array<{ zone: 1|2|3|4|5; durationSec: number }>`.

### Mapeo zona → metadatos de track

| Zona | BPM objetivo | Energy min | Valence  | Descripcion       |
| ---- | ------------ | ---------- | -------- | ----------------- |
| Z1   | 90-110       | 0.40       | cualq.   | Recuperacion      |
| Z2   | 110-120      | 0.55       | > 0.40   | Aerobico base     |
| Z3   | 120-130      | 0.70       | > 0.50   | Tempo sostenido   |
| Z4   | 130-145      | 0.80       | > 0.60   | Umbral            |
| Z5   | 145-175      | 0.90       | > 0.70   | Maximo / sprint   |

Si el usuario marca "todo con energía", `Energy mín = 0.70` también en Z1–Z2.

### Algoritmo de matching (determinista)

Para cada segmento `[zona, duración]`:

1. Filtrar tracks por **zona → BPM + Energy + género preferido**.
2. Ordenar por `score = 0.5 × match_genero + 0.3 × ajuste_BPM + 0.2 × energy`.
3. Seleccionar el track con mayor `score` **no usado en los últimos 5 tracks**.
4. Si la duración del track > duración del segmento, permitir solapamiento al siguiente.
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

El usuario puede subir CSVs adicionales en runtime (mismo formato), que se mergean en memoria con los embebidos.

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
POST /v1/users/{user_id}/playlists                    # crear playlist privada
POST /v1/playlists/{playlist_id}/tracks               # añadir tracks por URI
GET  /v1/search?q=track:{n}+artist:{a}&type=track     # solo si falta URI
```

Scope: `playlist-modify-private`.

### Configuración del Client ID

PKCE no necesita Client Secret, pero sí un Client ID. Se configura por `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID=tu-client-id-aqui
```

Pasos para obtenerlo:
1. https://developer.spotify.com/dashboard → "Create an App".
2. Añade Redirect URIs: `http://127.0.0.1:5173/callback` (dev), `https://sincro.movimientofuncional.app/callback` (prod), `vatiosconritmo://callback` (APK).
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

Si en el futuro se quisiera soportar otras plataformas, requeriría cambio arquitectónico (mini-backend que firme tokens o app nativa por plataforma).

---

## Diseño UI

- **Estética**: light mode, design-system de Movimiento Funcional (`.claude/skills/design-system/SKILL.md`). Optimizado para legibilidad, accesibilidad WCAG 2.1 AA y zonas táctiles ≥44px.
- **Paleta UI**:
  - Primary: `turquesa-600 #00bec8` (CTAs, navegación, focus rings).
  - Critical: `rosa-600 #e11d48` (acciones destructivas, máx 1-2 por pantalla).
  - Info: `tulipTree-500 #eab308` (tips, datos complementarios).
  - Neutrales: paleta `gris-{50..900}` (texto principal `gris-800` sobre fondo blanco).
- **Paleta de zonas Z1-Z5** (`colors.zone.{1..5}` en `tailwind.config.ts`): **exclusivamente para visualización de datos** — gauges de potencia, bandas en charts de elevación (Recharts), `ZoneBadge`. **No se usa para UI general**.
- **Tipografía**: `Righteous` (display, solo H1/H2 y logos) + `ABeeZee` (sans, cuerpo y formularios). Importadas desde Google Fonts en `index.html`. Tamaño base 16px móvil / 18px desktop, escala 1.25.
- **Iconografía**: Material Icons (`<MaterialIcon name="..."/>`). **Nunca emojis** en componentes UI.
- **Componentes clave**: drag & drop GPX, gráfico de elevación con bandas por zona (Recharts), cards de tracks con `ZoneBadge`, stepper *Datos → Ruta → Música → Resultado*.

---

## Normas del proyecto

1. **No introducir backend, base de datos, ni sistema de cuentas.** Si una feature parece requerirlo, parar y preguntar antes de codificar.
2. **Cálculos físicos viven en `src/core/`** y no tocan React/DOM. Cada fórmula nueva entra con su test unitario.
3. **Nada de `any`** en TypeScript. Si un tipo es genuinamente desconocido, `unknown` + narrowing explícito.
4. **El motor de matching debe ser determinista**: misma entrada → misma salida.
5. **Open source colaborativo**: nombres de variables, funciones y archivos en **inglés**. Comentarios y commits en español aceptables.
6. **Capacitor no debe romper lo que funciona en web**. Si algo se ve bien con `pnpm dev` pero falla en el APK, el bug está en el plugin/configuración; no se "soluciona" bifurcando lógica de `core/` por plataforma.
7. **Pre-commit Husky** ejecuta `pnpm typecheck` + `pnpm lint`. **Nunca `git commit --no-verify`**: si un check falla, arreglar la causa.

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
