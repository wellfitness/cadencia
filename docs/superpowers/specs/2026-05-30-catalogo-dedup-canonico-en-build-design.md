# Deduplicación canónica del catálogo nativo en el build

**Fecha**: 2026-05-30
**Estado**: implementado
**Ámbito**: `scripts/build-tracks.mjs`, `src/core/tracks/duplicates.ts`, `src/data/tracks/sources/`, `src/data/tracks/all.csv`, `package.json`

---

## Objetivo

Garantizar que `src/data/tracks/all.csv` contenga **10.000 canciones realmente distintas** (cero
versiones duplicadas de un mismo tema), y rellenar hasta ese número integrando 8 listas nuevas
exportadas por el usuario.

---

## Causa raíz

Hoy existen **dos definiciones distintas de «duplicado»** en el repo y no coinciden:

| Capa | Función | Fuerza |
|---|---|---|
| **Build** (`scripts/build-tracks.mjs`) | `normalizeTitle` + `softKey` (solo primer artista, pocas keywords) | **Débil** |
| **UI** (`src/core/tracks/duplicates.ts`) | `dedupKey` (artistas order-insensitive, ~26 keywords: remix, edit, version, deluxe, bonus…) | **Fuerte** |

`all.csv` se compiló con la regla **débil**, por eso el editor de catálogos (que usa la **fuerte**,
añadida el 2026-05-29) muestra duplicados que el build dejó pasar.

### Diagnóstico con datos reales

Aplicando la clave **fuerte** (`dedupKey`) sobre el `all.csv` actual:

| Métrica | Valor |
|---|---|
| Filas en `all.csv` | 10.000 |
| Grupos con duplicados | 614 |
| Copias sobrantes (eliminables) | 709 |
| **Canciones realmente únicas** | **9.291** |

El pool de `sources/` con dedup fuerte da 9.609 únicas (déficit de 391 para 10.000). Las 8 listas
nuevas aportan **+450 únicas** → **10.059**, que supera el cap de 10.000 (el recorte por
popularidad elimina las 59 menos populares → exactamente 10.000).

---

## Decisiones de diseño (acordadas con el usuario)

1. **Fuente única de verdad**: el build importa la lógica canónica de `src/core/tracks/duplicates.ts`.
   Para que un script pueda importar TypeScript de `src/core/`, se ejecuta con **`tsx`**
   (devDependency nueva). **El script se mantiene como `.mjs`** (no `.ts`): un `.ts` en
   `scripts/` rompería ESLint, que aplica reglas *type-checked* a `**/*.{ts,tsx}` con
   `parserOptions.project: ['./tsconfig.json']`, y `scripts/` no está en el `include` del
   tsconfig. tsx permite que un `.mjs` importe TypeScript en runtime, así que se logra la
   fuente única igual y sin tocar la config de lint ni de tsc.
2. **Regla de superviviente: «versión limpia + popular gana»** (ver Componente 2).
3. **Integrar las 8 listas** del usuario (se quedan todas, incluso la de bajo rendimiento).
4. **Cap de 10.000 sin cambios**: techo de seguridad; recorta por `Popularity` ascendente.

---

## Componente 1 — `scripts/build-tracks.mjs` (reescritura, ejecutado con `tsx`)

### Importación de la lógica canónica

```js
// Import RELATIVO (tsx/esbuild no resuelve los alias @core de tsconfig por defecto).
import { dedupKey, titleHasVersionMarker } from '../src/core/tracks/duplicates';
```

Se **eliminan** del script las funciones locales `normalizeTitle`, `normalizeFirstArtist` y
`softKey`. La clave de dedup blando del build pasa a ser **exactamente** `dedupKey`.

> Consecuencia deseada: tras el build, la pestaña «Catálogo nativo» mostrará el toggle
> «Solo duplicados (N)» con **N = 0**, porque build y UI comparten la misma clave.

### Adaptación de tipos

`dedupKey` recibe `Pick<Track, 'name' | 'artists'>` con `artists: string[]`. El CSV trae
«Artist Name(s)» como cadena delimitada por `,`/`;`. El script construye el objeto:
`{ name, artists: artistField.split(/[,;]/).map(s => s.trim()).filter(Boolean) }`.

### Filtros previos (sin cambios)

Por cada fila, en este orden: tempo numérico → **dedup estricto por URI** (first-wins) →
**encaje en alguna cadencia** (`FIT_RANGES`) → **`Duration (ms)` válido y > 0**. Se conserva la
columna `Source` (nombre de archivo de origen).

---

## Componente 2 — Dos pasadas: agrupar y elegir superviviente

El build pasa de *first-wins en streaming* a **dos pasadas**:

**Pasada 1 — recolectar y agrupar.** Tras los filtros, se acumula `byUri: Map<uri, Row>`
(first-wins por URI) y se agrupa por clave canónica: `groups: Map<dedupKey, uri[]>`. Las filas con
**clave vacía** (`dedupKey === ''`, título no normalizable) **no se agrupan**: cada una es su propio
singleton y se conserva (nunca se funden entre sí).

**Pasada 2 — elegir un superviviente por grupo.** Para cada grupo de 2+ versiones, se ordena por:

1. **`hasVersionMarker` ascendente** (las versiones «limpias» primero). Se usa la nueva función
   pública `titleHasVersionMarker(name)` de `duplicates.ts`: compara `cleanTitleForDedup(name)`
   con la normalización **sin** recorte de versión; si difieren, al título se le quitó un
   sufijo/paréntesis/`feat.` → es una versión.
2. **`Popularity` descendente** (0–100; ausente = 0).
3. **Longitud del nombre ascendente** (desempate: nombre más corto = más limpio).
4. **URI ascendente** (desempate final determinista).

Se queda el **primero**. Ejemplos: sobrevive «Faded» y no «Faded - Slowed Remix»; «Take a Bow» y
no «Take a Bow - Edit».

> Resuelto en implementación: se añadió `titleHasVersionMarker` a `duplicates.ts` (con su test),
> reutilizando internamente `cleanTitleForDedup` + la normalización base. No se exportan helpers
> de bajo nivel ni se duplica lógica. No se añade al barrel `index.ts` (solo lo consume el build
> vía import relativo — YAGNI).

---

## Componente 3 — Integración de las 8 listas

Mover de la raíz del proyecto a `src/data/tracks/sources/` (donde el build las recoge). `sources/`
pasa de 16 a 24 archivos. Aporte neto medido (dedup fuerte contra el pool):

| Lista | Filas | Nuevas únicas |
|---|---|---|
| Rock_Workout_Motivation_-_Best_Gym_Rock_Music | 238 | 195 |
| Dance_Party | 150 | 87 |
| Gym_Hits | 80 | 48 |
| Las_100_Canciones_Mas_Escuchadas_De_La_Historia | 100 | 34 |
| Corre_con_Rock | 80 | 31 |
| Julio_3 | 50 | 19 |
| The_Most_Popular_Gym_Music | 50 | 19 |
| Workout_Gym_-_90s_2000s | 126 | 17 |
| **TOTAL** | | **+450** |

Todas pasan el filtro de cadencia (0 huérfanas) y traen duración válida; 0 repeticiones internas.

---

## Componente 4 — Cap de 10.000 (sin cambios)

`MAX_CATALOG_SIZE = 10000`. Tras dedup + superviviente quedan ~10.059 candidatas; el recorte por
`Popularity` ascendente elimina las 59 menos populares. Resultado: exactamente 10.000. Orden de
escritura final por `Tempo` ascendente (igual que hoy).

---

## Componente 5 — `package.json` y dependencias

- `pnpm add -D tsx` (instala `tsx@4.21.0` + binarios de esbuild en devDependencies).
- `"build:tracks": "tsx scripts/build-tracks.mjs"` (antes `node scripts/build-tracks.mjs`).
- Se **mantiene** el archivo como `.mjs` (ver Decisión 1): no entra en el bloque
  `**/*.{ts,tsx}` de ESLint, así que no necesita estar en el `tsconfig`.
- Efecto colateral observado: `pnpm add` corrigió un *drift* previo del lockfile (`recharts`
  pasó de `2.15.4` resuelto a `2.13.0`, que es el valor **exacto** declarado en `package.json`).

---

## Verificación (resultados reales)

1. `pnpm build:tracks`: Leídos 12.338 · URI-dupes 729 · canónicos colapsados 1.547 · sin duración 1
   · huérfanos 2 · recorte por cap 59 · **total final 10.000**. ✅
2. **Cero duplicados**: `all.csv` pasado por la `dedupKey` canónica → 0 URIs repetidos, 0 grupos con
   `groupSize ≥ 2`, 0 copias sobrantes. ✅
3. **Cobertura por zona** (mejoró en las finas): 60-80 → **90** (antes ~85), 70-90 → 210,
   90-115 → 1.398, 110-160 → 8.438, 140-180 → 849, 180-230 → **82** (antes ~72). Ninguna zona
   quedó pelada. ✅
4. `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test:run` ✅ **1.059 tests** (incluye 4 nuevos de
   `titleHasVersionMarker`).
5. Scripts temporales de análisis borrados — no se commitean. ✅

---

## Riesgos y trade-offs

- **Pérdida de versiones con BPM distinto**: colapsar «misma canción» descarta remixes/extended de
  BPM diferente que técnicamente servirían a otra zona. Aceptado: (a) coherencia con la UI (la
  misma clave), (b) más variedad de canciones distintas reduce monotonía, (c) el catálogo tiene
  tracks de sobra por zona. Se valida en el paso 3 de Verificación.
- **`tsx` resuelve alias**: usar import **relativo** en el script, no `@core/*`.
- **Separador de clave** (` `) es interno a `dedupKey`; nunca se escribe al CSV.

---

## Fuera de alcance (YAGNI)

- Cambios en el motor de matching o en el `livePool`.
- Dedup automático en las listas del usuario (`/catalogo`): sigue siendo manual, como define el spec
  del 2026-05-29.
- Ampliar el set de keywords de versión (se hace en `duplicates.ts` si aparecen falsos negativos).
- Exportar más listas para diversificar géneros (el dance domina); opcional y futuro.

---

## Convenciones

- Código en **inglés**; comentarios y copy en **castellano** correcto con «comillas tipográficas».
- Sin `any`; tipos estrictos (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Pre-commit Husky (`typecheck` + `lint`) debe pasar sin `--no-verify`.
