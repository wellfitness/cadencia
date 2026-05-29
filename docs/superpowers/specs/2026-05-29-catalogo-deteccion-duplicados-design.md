# Detección de duplicados en los catálogos

**Fecha**: 2026-05-29
**Estado**: aprobado para implementación
**Ámbito**: pestaña «Catálogo nativo» y pestaña «Mis listas» de `/catalogo`

---

## Objetivo

Permitir al usuario **localizar canciones duplicadas** en sus catálogos, incluido
el caso difícil de **versiones de la misma canción con URI distinta** (remasters,
directos, *radio edits*, ediciones *feat.*…), que hoy no se detectan como
duplicado porque su `uri` de Spotify es diferente.

Se persigue con tres capacidades combinadas, sobre **ambos** catálogos:

1. **Ordenar** alfabéticamente por título y luego por artista, para que las
   versiones de un mismo tema queden contiguas.
2. **Detectar** qué temas son «el mismo» mediante una clave normalizada
   (título limpio + artista).
3. **Agrupar/filtrar**: un toggle «Solo duplicados» que deja en pantalla
   únicamente las canciones que pertenecen a un grupo de 2+ versiones, y un
   chip «N versiones» en cada fila afectada.

### Dos tipos de duplicado que cubrimos

| Tipo | Cómo se detecta | Ejemplo |
|---|---|---|
| **Misma grabación repetida** | misma `uri` (o misma clave normalizada) | la misma pista en dos listas distintas |
| **Versiones del mismo tema** | misma **clave normalizada** (título limpio + artista), URI distinta | «We Are The Champions» y «We Are The Champions - Remastered 2011» de Queen |

Evidencia en `src/data/tracks/all.csv`: ~580 sufijos del tipo `- Remastered/Live/…`
y ~1751 paréntesis del tipo `(feat./Live/Remix…)`. La función es útil también en
el catálogo nativo, no solo en las listas del usuario.

---

## Arquitectura

Enfoque **A** (núcleo puro + cableado local en cada pestaña). La lógica de
normalización, ordenación y agrupación vive en `src/core/`, es 100% testeable
sin DOM, y cada pestaña aplica esas funciones puras dentro de su `useMemo` de
`filteredTracks`, igual que hoy aplica buscador/BPM.

Cumple las reglas de capas del proyecto: `src/core/` no importa de `ui/` ni de
`integrations/`; las pestañas (UI) orquestan el núcleo sin contener lógica de
normalización.

**No afecta al matching.** Los dos editores (`CatalogEditorPage` y `MyListsTab`)
son **solo visualización**: cargan tracks por su cuenta (`loadNativeTracks`,
`hydrateUploadedCsvs`) y no alimentan el `livePool` del wizard. Reordenar su
display no puede alterar el determinismo del motor.

---

## Componente 1 — Núcleo puro: `src/core/tracks/duplicates.ts`

Módulo nuevo, sin React/DOM, con su test unitario `duplicates.test.ts`.

### API pública

```ts
/** Normaliza un título para agrupar versiones: minúsculas, sin tildes,
 *  sin sufijos de versión, sin puntuación, espacios colapsados. */
export function cleanTitleForDedup(name: string): string;

/** Normaliza la lista de artistas a una clave order-insensitive. */
export function normalizeArtistsForDedup(artists: readonly string[]): string;

/** Clave de agrupación de un track: `cleanTitle \0 artistasNormalizados`.
 *  Devuelve '' si el título queda vacío (no agrupable). */
export function dedupKey(track: Pick<Track, 'name' | 'artists'>): string;

/** Ordena de forma estable por título limpio → artista → nombre crudo,
 *  con localeCompare('es'). Genérico: sirve para Track y para envoltorios. */
export function sortByTitleThenArtist<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  artistsOf: (item: T) => readonly string[],
): T[];

export interface AnnotatedItem<T> {
  item: T;
  /** Clave de agrupación; '' si no agrupable. */
  dupKey: string;
  /** Cuántos items comparten la clave en TODO el conjunto analizado (>=1). */
  groupSize: number;
}

/** Anota cada item con su clave y el tamaño de su grupo dentro del conjunto. */
export function annotateDuplicates<T>(
  items: readonly T[],
  trackOf: (item: T) => Pick<Track, 'name' | 'artists'>,
): AnnotatedItem<T>[];
```

### Reglas de normalización del título (`cleanTitleForDedup`)

Orden de pasos:

1. `toLowerCase()`.
2. Quitar diacríticos: `normalize('NFD').replace(/\p{Diacritic}/gu, '')` (mismo
   criterio que `normalizeForSearch` ya usado en `MyListsTab`).
3. **Quitar segmento `feat.`**: desde `feat.` / `ft.` / `featuring` hasta el
   final del título (los artistas invitados van al final). Cubre tanto
   `Song feat. X` como `Song (feat. X)`.
4. **Quitar sufijo tras separador** ` - ` / ` – ` / ` — ` (guion, raya, raya em)
   cuando el texto posterior contiene una **palabra clave de versión**.
5. **Quitar paréntesis/corchetes** `(...)` / `[...]` cuando su contenido
   contiene una palabra clave de versión.
6. Quitar puntuación restante (conservar alfanuméricos y espacios), colapsar
   espacios, `trim()`.
7. **Salvaguarda**: si tras todo queda cadena vacía pero el nombre original no
   lo estaba (p. ej. el título era solo `(Live)`), usar el nombre normalizado
   de los pasos 1–2 sin recortes. Nunca «vaciar» un título no vacío.

**Palabras clave de versión (set inicial, extensible):**
`remaster`, `remastered`, `live`, `radio edit`, `radio mix`, `single version`,
`single edit`, `album version`, `mono`, `stereo`, `acoustic`, `demo`, `remix`,
`club mix`, `extended mix`, `extended version`, `dance mix`, `dub`, `edit`,
`version`, `anniversary`, `deluxe`, `bonus`, `re-recorded`, `rerecorded`,
y años sueltos asociados (`19xx`/`20xx`) en el segmento de versión (p. ej.
`- 2011 Remaster`, `- Remastered 2011`).

**Fuera del set en V1** (decisión consciente, para minimizar falsos positivos):
`instrumental` (un instrumental es una pista genuinamente distinta), y cualquier
paréntesis SIN palabra clave (p. ej. `(Part 2)`, `(Theme from …)`) se conserva.

### Clave de artista (`normalizeArtistsForDedup`)

Cada artista → minúsculas + sin tildes + `trim()`; descartar vacíos; **ordenar**;
unir con `|`. Así «A; B» y «B; A» comparten clave. Mantener el artista en la
clave evita falsos positivos graves: «Imagine - Remastered 2010» (John Lennon) y
«Imagine - Live» (Madonna) **no** se agrupan, porque difiere el artista.

### Orden (`sortByTitleThenArtist`)

Copia + sort estable. Criterio: `cleanTitleForDedup(name)` →
`normalizeArtistsForDedup(artists)` → `name` crudo, todos con
`localeCompare('es', { sensitivity: 'base' })`. Es genérico para reutilizarse
con `Track` (nativo) y con el envoltorio `{ track, listId, listName }` (mis listas).

---

## Componente 2 — Pestaña «Catálogo nativo» (`CatalogEditorPage.tsx`)

- **Orden permanente** por título → artista (hoy se renderiza en orden de CSV).
  `filteredTracks` termina siempre con `sortByTitleThenArtist`.
- Estado nuevo `onlyDuplicates: boolean`.
- Cálculo memoizado a partir de `allTracks`:
  - `dupCountByUri: Map<string, number>` (uri → `groupSize`). En el catálogo
    nativo los URIs son únicos (el `all.csv` viene pre-dedupado por URI en build,
    vía `scripts/build-tracks.mjs`; el render actual ya usa `key={t.uri}` sin
    colisiones), así que indexar por URI es seguro.
  - `tracksInGroups: number` = nº de tracks con `groupSize >= 2` (alimenta `N`).
- Cadena de `filteredTracks`: buscador/BPM/origen (actual) → si `onlyDuplicates`,
  conservar `(dupCountByUri.get(t.uri) ?? 1) >= 2` → `sortByTitleThenArtist`.
- **UI del toggle**: pastilla **«Solo duplicados (N)»** dentro de `FiltersPanel`,
  junto a BPM / limpiar. `N` = `tracksInGroups`. Oculta si `N === 0`.
  `aria-pressed`, área táctil ≥ 32 px (coherente con `SourceFilter`/`BulkActions`).
- `TrackRow` recibe prop nueva opcional `duplicateCount?: number`. Si `>= 2`,
  muestra un chip sobrio **«{n} versiones»** (estilo neutro `bg-gris-100`,
  Material Icon `library_music` o `content_copy`), sin alterar el resto de la fila.
- **Limpieza sin acciones nuevas**: el usuario desmarca (allowlist) o pulsa «No la
  quiero» (descarte global), botones que ya existen en la fila.

---

## Componente 3 — Pestaña «Mis listas» (`MyListsTab.tsx`)

### Vista combinada «Todas las listas»

- En el `<select>` actual, **primera opción**: «Todas las listas», con valor
  centinela `'__all__'`.
- Modelo de datos unificado: en ambos modos se construye un array de envoltorios
  `{ rowId, track, listId, listName }`:
  - modo «una lista»: envoltorios de esa lista.
  - modo «todas»: **fusión** de los envoltorios de todas las listas.
  - `rowId` estable = `` `${listId}#${uri}#${i}` `` (índice dentro de su lista de
    origen), para servir de `key` de React de forma robusta aunque la misma `uri`
    aparezca en varias listas, o (caso raro) repetida dentro de una.
- Mismo URI en dos listas → **dos filas** (no se deduplica): así el duplicado
  exacto entre listas se ve, en vez de ocultarse. Quedan contiguas por el orden.

### Detección, orden y toggle

- `annotateDuplicates(items, w => w.track)` sobre el conjunto de la vista actual
  (todas, o la lista suelta). `groupSize` se calcula en ese ámbito.
- **Orden siempre activo** por título → artista en ambos modos.
- Toggle **«Solo duplicados (N)»** disponible en ambos modos (junto al filtro de
  BPM). En «todas» detecta entre listas; en una lista, dentro de ella.
  `N` = nº de tracks con `groupSize >= 2`. Oculto si `N === 0`.
- `UploadedTrackRow` recibe props nuevas opcionales:
  - `listName?: string` → insignia de lista de origen (solo se muestra en modo
    «todas»; en una lista suelta es redundante y se omite).
  - `duplicateCount?: number` → mismo chip «{n} versiones» que en el nativo.

### Detalles de UI en modo «todas»

- Botón «borrar esta lista» **deshabilitado** (no hay una lista concreta
  seleccionada). «Subir nueva lista» sigue disponible.
- La línea de resumen se adapta: total de canciones entre todas las listas +
  nº de duplicados detectados.
- El descarte sigue siendo **global por URI** (`dismissedTrackUris`): si una `uri`
  está en dos listas (dos filas), descartarla afecta a ambas filas
  coherentemente, porque el estado se lee del set global por URI.
- Acciones masivas «Descartar/Recuperar visibles» operan sobre las filas
  visibles (ya filtradas), igual que hoy.

---

## Componente 4 — Exports y tests

### Barrel `src/core/tracks/index.ts`

Añadir:

```ts
export {
  cleanTitleForDedup,
  normalizeArtistsForDedup,
  dedupKey,
  sortByTitleThenArtist,
  annotateDuplicates,
  type AnnotatedItem,
} from './duplicates';
```

### Tests `src/core/tracks/duplicates.test.ts` (Vitest, estilo del repo)

Casos mínimos:

1. `cleanTitleForDedup` quita `- Remastered 2011`, `- Live`, `- Radio Edit`,
   `- 2009 Remaster`, `(feat. X)`, `[Deluxe]`, `(2011 Remaster)`.
2. `cleanTitleForDedup` **conserva** `(Part 2)` y títulos sin palabra clave.
3. Diacrítico-insensible: «Café» y «cafe» → misma clave.
4. `dedupKey`: «We Are The Champions» == «We Are The Champions - Remastered 2011»
   (mismo artista Queen).
5. `dedupKey`: «Imagine»/John Lennon ≠ «Imagine»/Madonna.
6. `normalizeArtistsForDedup` order-insensitive: `['A','B']` == `['B','A']`.
7. `annotateDuplicates`: `groupSize` correcto; item único → `groupSize === 1`;
   título vacío → `dupKey === ''` y nunca agrupa con otro vacío.
8. `sortByTitleThenArtist`: orden estable y correcto (título→artista→nombre).
9. Salvaguarda: título `(Live)` no produce clave vacía.

### Rendimiento

`annotateDuplicates` sobre ~10k tracks del nativo es O(n) con un `Map`, ejecutado
una vez por `useMemo` (dependencia: la lista de tracks, estable tras el mount).
Sin impacto perceptible.

---

## Fuera de alcance (YAGNI)

- **Fusión automática** de duplicados o «quedarse con la mejor versión»
  automáticamente: el usuario decide manualmente con las acciones existentes.
- **Panel/sub-pestaña** «Posibles duplicados» dedicada: se descartó a favor del
  toggle-filtro, más simple y reutilizando el patrón de filtros.
- **Resaltado intrusivo** de filas (fondos por grupo): se limita al chip sobrio.
- `instrumental` y otros sufijos ambiguos en el set de palabras clave: se podrán
  añadir más adelante si aparecen falsos negativos molestos.
- Cualquier cambio en el motor de matching o en el `livePool`.

---

## Convenciones

- Código (nombres, funciones, archivos) en **inglés**; comentarios y copy de
  usuario en **castellano** correcto, con «comillas tipográficas» en narrativa.
- Sin `any`; tipos estrictos (el proyecto usa `exactOptionalPropertyTypes` y
  `noUncheckedIndexedAccess`).
- Material Icons, nunca emojis. Áreas táctiles ≥ 44 px en controles principales,
  ≥ 32 px en pastillas secundarias. WCAG 2.1 AA.
- Pre-commit Husky (`typecheck` + `lint`) debe pasar sin saltarse validaciones.
