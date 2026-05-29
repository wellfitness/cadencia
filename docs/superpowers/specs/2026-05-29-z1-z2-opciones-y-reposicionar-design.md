# Más opciones en Z1/Z2 y reposicionar canciones usadas — Diseño

> Diseño validado con la usuaria el 2026-05-29. El plan de implementación
> (tarea a tarea) se redacta aparte con `superpowers:writing-plans`.

## Problema

Dos asuntos relacionados, reportados sobre la pantalla **Resultado** en modo
ruta (GPX, bici):

1. **Z1/Z2 dan pocas opciones.** En una ruta real se pasa la mayor parte del
   tiempo en Z1/Z2 (llano, descansos, bajadas), así que esas zonas necesitan
   muchísimos slots. Pero Z1 y Z2 comparten el perfil `flat`
   (`VALID_PROFILES_BY_ZONE` en `src/core/segmentation/sessionPlan.ts`), cuya
   cadencia objetivo es 70-90 rpm → solo aceptan tracks de **70-90 BPM (1:1)
   o 140-180 BPM (2:1)**. La regla cardinal «cero repeticiones» vacía ese pool
   compartido y los slots caen a `best-effort` / `repeated`.

2. **Control sobre las canciones ya usadas.** La usuaria quiere:
   - que **«Aleatorio»** nunca elija una canción que ya está en la lista, y
   - que **«Otro tema»** muestre marcadas las canciones ya usadas (con su
     tramo) para poder **moverlas de posición**.

### Causa raíz de (1): estructural, no de catálogo

El perfil `flat` esquiva la banda de tempo donde se concentra casi toda la
música popular (≈110-130 BPM). A 1:1 esa banda exige 110-130 rpm; a 2:1 exige
55-65 rpm (dividir). El techo de `flat` está en 90 rpm: correcto para
tempo/umbral, pero **artificialmente bajo para recuperación**, donde a baja
carga la cadencia se desacopla de la resistencia y se puede pedalear suave a
90-110 rpm.

**Importante (restricción de razonamiento):** la justificación NO se apoya en
la distribución del catálogo bundled `src/data/tracks/all.csv`. Un usuario
puede generar playlists solo con sus propios CSVs (modo «Solo mis CSV»), con
cualquier distribución de BPM. La solución debe ser **agnóstica del catálogo**.

## Objetivos

- Ampliar las opciones **reales** de Z1/Z2 en bici, con base fisiológica, sin
  romper «cero repeticiones» ni el determinismo del motor.
- «Aleatorio» nunca repite (acción del usuario, no del motor).
- «Otro tema» muestra las usadas marcadas con su tramo; seleccionarlas mueve la
  canción a este tramo y rellena el hueco de origen.

## No-objetivos

- No tocar **running** (su cadencia ya está acoplada a la zona, 150-190 spm).
- No tocar Z3-Z6 ni el perfil `flat` en tempo/umbral.
- No introducir repetición de canciones (la usuaria descartó el toggle
  «permitir repetir en Z1/Z2»).
- No prometer una cifra de cobertura: depende del catálogo del usuario.

---

## Sección 1 — Motor: cadencia de recuperación en Z1/Z2 (bici)

### Cambio

Solo bici, solo Z1 y Z2 (zona-aware). Se aprovecha que Z1/Z2 ya están
restringidas a perfil `flat`.

- **Match 1:1**: se amplía el techo de **90 → 110 rpm**. Captura la banda media
  (90-110 BPM) al ritmo del track, sin dividir.
- **Match 2:1**: se mantiene en **[140, 180] BPM** (track rápido a 70-90 rpm
  cada 2 beats — mecánica clásica de spinning). **No** se baja el floor: nada de
  dividir 110→55 rpm.
- **111-139 BPM**: siguen fuera de Z1/Z2 a propósito (ni 1:1 ni 2:1 son
  naturales ahí). Pertenecen a zonas más altas.

El 1:1 y el 2:1 dejan de ser simplemente «×1 y ×2 del mismo rango»: el 1:1 sube
a 110 mientras el 2:1 sigue derivando de la cadencia cómoda [70,90]. Por eso se
representan de forma asimétrica (ver más abajo).

### Justificación (agnóstica del catálogo)

1. **Fisiológica**: a baja intensidad la cadencia se desacopla de la carga;
   girar a 90-110 rpm en llano/bajada es spin suave válido para Z1/Z2. Cierto
   exista o no una canción concreta en la lista del usuario.
2. **Monotonía**: ampliar el techo del filtro 1:1 solo puede **añadir**
   candidatas a Z1/Z2, nunca quitar. Para cualquier catálogo:
   `candidatas(después) ⊇ candidatas(antes)`. La magnitud depende del catálogo
   del usuario; el sentido (nunca empeora) está garantizado.

**Límite honesto**: si el catálogo del usuario no tiene nada en [70,110] ni
[140,180] BPM, seguirá escaso en Z1/Z2; eso no lo arregla ningún rango, solo
subir más listas.

### Interacción con el score (evita hundir las canciones lentas)

El score de cadencia (`src/core/matching/score.ts`) premia la **cercanía al
punto medio** del rango. Si se ampliara el rango a [70,110] manteniendo el
score triangular, el punto medio se movería a 90 y un track *chill* de 70 BPM
puntuaría 0 en cadencia. Para evitarlo:

- En Z1/Z2 el componente 1:1 del score pasa de **triángulo a meseta**: cualquier
  cadencia dentro de la banda 1:1 aceptada puntúa 1.0 (girar a 75 o a 105 rpm es
  igual de válido en recuperación). Esto es además estrictamente mejor que hoy,
  donde los extremos del rango ya puntuaban 0.
- El resto de zonas conserva el score triangular actual → **cero cambios de
  ranking ni de tests** fuera de Z1/Z2.

### Representación de datos

`ZoneMusicCriteria` (`src/core/matching/types.ts`) gana un campo opcional:

```ts
/**
 * Techo de cadencia para el match 1:1, cuando difiere de cadenceMax. Solo lo
 * fija getZoneCriteria para zonas de recuperación (bici Z1/Z2), donde a baja
 * carga la cadencia se desacopla y se admite spin más alegre. undefined =
 * usar cadenceMax (comportamiento de todas las demás zonas).
 *
 * Su presencia ES la señal de "banda ancha de recuperación": activa el score
 * en meseta para el componente 1:1.
 */
cadenceMaxPrimary?: number;
```

- `cadenceMin`/`cadenceMax` siguen siendo la **cadencia cómoda** [70,90]: de ahí
  derivan el 2:1 (`getAlternativeBpmRange` → [140,180], sin cambios) y, en el
  resto de zonas, el score.
- `getZoneCriteria(zone, profile, 'bike')` con `zone ∈ {1,2}` añade
  `cadenceMaxPrimary: 110`. Por `exactOptionalPropertyTypes`, el campo se asigna
  solo cuando aplica (objeto construido condicionalmente, nunca `= undefined`).

### Archivos del motor afectados

- `src/core/matching/types.ts` — nuevo campo `cadenceMaxPrimary?`.
- `src/core/matching/zoneCriteria.ts` — `getZoneCriteria` fija el techo en bici
  Z1/Z2; `getAlternativeBpmRange` sin cambios (sigue derivando de
  cadenceMin/cadenceMax).
- `src/core/matching/candidates.ts` — `passesCadenceFilter`: el límite superior
  del 1:1 usa `cadenceMaxPrimary ?? cadenceMax`.
- `src/core/matching/score.ts` — `scoreTrack`: componente 1:1 en meseta sobre
  `[cadenceMin, cadenceMaxPrimary]` cuando el campo está presente; triángulo
  sobre `[cadenceMin, cadenceMax]` en caso contrario.
- `src/core/matching/match.ts` — `bpmDistanceToCriteria` usa el mismo techo 1:1.
- `src/core/matching/poolCoverage.ts` — sin cambios de código (recalcula vía
  `findCandidates`); sus tests reflejan el nuevo recuento Z1/Z2.

---

## Sección 2 — «Otro tema» marca usadas + mover/rellenar; «Aleatorio» nunca repite

### Modelo de datos

`AlternativeCandidate` (`src/core/matching/replaceTrack.ts`) gana:

```ts
/** Tramo (índice 0-based en `matched`) donde la canción ya está colocada, o
 *  null si está libre. La UI muestra `usedAtIndex + 1` como "tramo N". */
usedAtIndex: number | null;
```

### Núcleo: alternativas incluyen las usadas, marcadas

`getAlternativesForSegment(matched, index, tracks, preferences)` deja de
excluir las URIs usadas. En su lugar:

- Excluye **solo** la canción del propio tramo `index` (no «sustituir por sí
  misma»).
- Cada candidata lleva `usedAtIndex`: índice de su tramo si ya está en `matched`
  (primera aparición), o `null` si está libre.
- El filtro de cadencia se aplica igual a frescas y usadas: la lista sigue
  significando «temas que encajan **aquí**», estén libres o ya colocados. Se
  conserva el modo *fallback* actual (si no hay ninguna que pase cadencia, se
  ofrece el resto marcado `passesCadence: false`).
- Orden: frescas primero por score; después las usadas por score. La UI las
  separa visualmente.

**Dos rankings conviven (clave de correctness):** tras este cambio hay dos
políticas de candidatos y NO deben mezclarse:
- *incluye-usadas-marcadas* → solo para **mostrar** el dropdown
  (`getAlternativesForSegment`).
- *solo-libres* (excluye todas las URIs en uso, comportamiento del actual
  `rankAvailableCandidates`) → para **sustituir** (`replaceTrackInSegment`,
  sin cambios) y para el **relleno** de `moveTrackToSegment`.
Si el relleno usara la política «incluye-usadas» podría elegir una canción ya
presente y duplicarla. El relleno y la sustitución siempre van por «solo-libres».

### Núcleo: mover + rellenar

Nueva función pura:

```ts
interface MoveResult {
  matched: MatchedSegment[];
  moved: boolean;
  /** Índices modificados: [targetIndex, sourceIndex] cuando moved=true. */
  changedIndices: number[];
}

function moveTrackToSegment(
  matched: readonly MatchedSegment[],
  targetIndex: number,
  sourceUri: string,
  tracks: readonly Track[],
  preferences: MatchPreferences,
): MoveResult;
```

Algoritmo:

1. `sourceIndex` = primer tramo cuya `track.uri === sourceUri`. Si no existe, o
   `sourceIndex === targetIndex`, o `targetIndex` fuera de rango → `moved:false`.
2. Coloca `sourceTrack` en `targetIndex`; recalcula su `matchQuality` (`strict`
   si pasa cadencia para la zona del target, si no `best-effort`).
3. **Rellena `sourceIndex`** con la mejor alternativa libre para su zona,
   prohibiendo todas las URIs presentes tras el paso 2 (incluida `sourceUri`,
   ya en el target). Reutiliza el ranking de `getAlternativesForSegment`/
   `replaceTrackInSegment`.
   - Si no hay fresca → cae a `best-effort`/`repeated`; si el catálogo se agota
     para esa zona → `track:null` / `insufficient` (caso límite).
4. Devuelve `matched` nuevo + `changedIndices`.

**Propiedad clave (cero repeticiones):** tras mover, `sourceUri` aparece una
sola vez (en el target) y el relleno se elige excluyendo todo lo usado. El track
desplazado del target (A) queda libre y el relleno **puede** reutilizarlo si es
el mejor para el origen — degradando de forma natural a un intercambio cuando
eso es lo óptimo, sin duplicar nunca.

### UI

`src/ui/components/PlaylistTrackRow.tsx`:

- **`RandomPickButton`** filtra a `usedAtIndex === null` **antes** de sortear →
  nunca repite. Si no quedan frescas, se deshabilita (mover es deliberado, no
  aleatorio). Comportamiento neto idéntico al actual: «Aleatorio» no repite.
- **`AlternativesPicker`**: las frescas arriba (como ahora); luego un separador
  **«Ya en tu lista (mover aquí)»** y debajo las usadas, cada una con badge
  **«en tu lista · tramo N»**. El buscador filtra ambos grupos.
- El callback de selección pasa la `AlternativeCandidate` (o `{uri, usedAtIndex}`)
  en vez de solo el `uri`, para que el padre decida mover vs. sustituir.

`src/ui/pages/ResultStep.tsx`:

- El handler enruta: `usedAtIndex === null` → `replaceTrackInSegment` (sustituir,
  como hoy); si no → `moveTrackToSegment` (mover + rellenar).
- Marca como cambiados **ambos** índices en `replacedIndices` (icono ✎ ya
  existente en `PlaylistTrackRow`).
- Toast breve reutilizando el patrón actual de descartes: «Movida desde el tramo
  N · el N ahora suena «X»».

### Lo que NO cambia

- Determinismo del motor: mover y aleatorio son acciones explícitas del usuario.
- Regla cero-repeticiones: mover no duplica (una sale del origen, otra entra).
- Flujo «No la quiero» (descarte global) intacto.

---

## Manejo de errores y casos límite

- **`sourceUri` no encontrado / mismo tramo / índice inválido** → `moved:false`,
  `matched` sin cambios.
- **Origen sin relleno posible** (catálogo agotado para esa zona) → el tramo
  origen queda `track:null` / `insufficient`; la UI ya pinta ese estado con CTA
  «Subir más temas».
- **URI repetida en varios tramos** (calidad `repeated`, último recurso):
  `usedAtIndex` apunta a la **primera** aparición; mover opera sobre ese tramo.
- **`exactOptionalPropertyTypes`**: `cadenceMaxPrimary` y los props opcionales se
  asignan solo cuando están definidos; nunca se pasa `undefined` explícito.

## Testing

**Motor (Vitest, `src/core/matching/*.test.ts`):**
- `zoneCriteria`: bici Z1/Z2 → `cadenceMaxPrimary === 110`; 2:1 sigue [140,180];
  Z3-Z6 sin `cadenceMaxPrimary`; running sin cambios.
- `candidates`: un track de 100 BPM pasa el filtro para bici Z1 (antes no);
  111-139 BPM siguen fuera; 2:1 [140,180] intacto.
- `score`: en Z1/Z2 los tracks de 70 y 110 BPM puntúan 1.0 en cadencia (meseta);
  en Z3 el score triangular es idéntico al actual (test de no-regresión).
- **Propiedad de monotonía**: para tracks aleatorios, el conjunto de candidatas
  de Z1/Z2 tras el cambio es superconjunto del de antes.
- `replaceTrack`: `getAlternativesForSegment` incluye usadas con `usedAtIndex`
  correcto y excluye la del propio tramo; `moveTrackToSegment` coloca origen→
  target, rellena el hueco, preserva cero-repeticiones, devuelve `changedIndices`
  correctos, es no-op en los casos límite, y reutiliza el track desplazado cuando
  es óptimo.

**UI (Testing Library, `src/ui/components/*.test.tsx`):**
- `RandomPickButton` ignora las usadas y se deshabilita sin frescas.
- `AlternativesPicker` pinta la sección «Ya en tu lista» y el badge «tramo N».
- `ResultStep` enruta mover vs. sustituir y marca ambos índices.

## Orden de implementación sugerido

1. Sección 1 (motor): tipos → `getZoneCriteria` → `passesCadenceFilter` →
   `scoreTrack` → `bpmDistanceToCriteria`, con sus tests. Es independiente y
   verificable sola.
2. Sección 2 (núcleo): `AlternativeCandidate.usedAtIndex` →
   `getAlternativesForSegment` → `moveTrackToSegment`, con tests.
3. Sección 2 (UI): `RandomPickButton` → `AlternativesPicker` → handler en
   `ResultStep`, con tests.

## Riesgos y decisiones tomadas

- **Score meseta solo en Z1/Z2** (quirúrgico) en lugar de unificar a meseta todas
  las zonas: menor blast radius, tests del resto intactos. La usuaria aprobó la
  versión quirúrgica.
- **Techo 1:1 en 110 rpm** (realista) en vez de 120-129 (que capturaría el pico
  típico 120-129 BPM): se prioriza honestidad fisiológica sobre cobertura. La
  banda 111-139 BPM se queda deliberadamente para zonas altas.
- **Mover + rellenar** (no swap): el origen se rellena con la mejor libre, que
  puede acabar siendo el track desplazado del target si es lo óptimo. Cascada
  visible vía toast + iconos. La usuaria aceptó la cascada.
