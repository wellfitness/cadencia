# Mejoras de física GPX y export GPX→.zwo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres mejoras independientes pero ordenadas: (1) suavizado de elevación GPS para eliminar falsos picos de potencia; (2) exportar rutas GPX como workouts `.zwo` para Zwift y similares; (3) Normalized Power riguroso al estilo Coggan (rolling 30s sobre malla de 1s).

**Architecture:** Capa `src/core/` permanece pura, sin React ni DOM. Cada mejora añade un módulo nuevo, deja los tipos públicos intactos y mantiene 100% de los tests existentes verdes. La integración UI se limita a un botón nuevo en `ResultStep` (modo GPX).

**Tech Stack:** TypeScript estricto, Vitest para unit tests. Sin nuevas dependencias.

**Orden vinculante:** Task 1 → Task 2 → Task 3. Task 2 se beneficia de la elevación ya limpia (zonas más realistas en el `.zwo`); Task 3 amplifica el ruido por `^4` y solo debe correr sobre datos suavizados.

---

## File Structure

**Crear:**
- `src/core/gpx/elevationSmoothing.ts` — helper puro que produce array de elevaciones suavizadas por ventana de distancia.
- `src/core/gpx/elevationSmoothing.test.ts` — tests unitarios del helper.
- `src/core/segmentation/normalizedPower.ts` — cálculo Coggan riguroso (resample 1s + rolling 30s + ^4).
- `src/core/segmentation/normalizedPower.test.ts` — tests unitarios.
- `src/core/sessionFormats/fromClassifiedSegments.ts` — adaptador `ClassifiedSegment[] → EditableSessionPlan` con merge de bloques contiguos de misma `(zone, cadenceProfile)` y heurística de `phase`.
- `src/core/sessionFormats/fromClassifiedSegments.test.ts` — tests unitarios.

**Modificar:**
- `src/core/gpx/segments.ts` — `computeSegments` calcula slope sobre elevaciones suavizadas (delegando al helper); el slope clamp ±30% se mantiene como red de seguridad.
- `src/core/segmentation/blocks.ts` — `segmentInto60SecondBlocks` reemplaza el cálculo NP por la nueva función.
- `src/core/sessionFormats/index.ts` — exporta `gpxToEditableSessionPlan`.
- `src/ui/pages/ResultStep.tsx` — botón "Descargar .zwo" visible solo cuando `sourceType === 'gpx'`.
- `src/ui/App.tsx` — pasa `sourceType` y `segments` a `ResultStep`.

---

## Task 1: Suavizado de elevación GPS

**Files:**
- Create: `src/core/gpx/elevationSmoothing.ts`
- Test: `src/core/gpx/elevationSmoothing.test.ts`
- Modify: `src/core/gpx/segments.ts`
- Existing tests: `src/core/gpx/segments.test.ts` deben seguir verdes.

### 1.1 Escribir test del helper aislado

- [ ] **Step 1: Crear test file con casos clave**

Crear `src/core/gpx/elevationSmoothing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { smoothElevation } from './elevationSmoothing';
import type { GpxPoint } from './types';

function pt(lat: number, lon: number, ele: number): GpxPoint {
  return { lat, lon, ele, time: null };
}

describe('smoothElevation', () => {
  it('devuelve array de la misma longitud', () => {
    const points = [pt(42, -8, 100), pt(42.001, -8, 102), pt(42.002, -8, 101)];
    const smoothed = smoothElevation(points, 50);
    expect(smoothed).toHaveLength(points.length);
  });

  it('elevación constante: salida idéntica', () => {
    const points = Array.from({ length: 10 }, (_, i) => pt(42 + 0.0001 * i, -8, 100));
    const smoothed = smoothElevation(points, 50);
    for (const e of smoothed) expect(e).toBeCloseTo(100, 5);
  });

  it('diente de sierra ±2m sobre línea base llana: amplitud reducida', () => {
    // Puntos cada ~11.1 m (0.0001 grado lat) con elevación 100/102/100/102…
    const points = Array.from({ length: 21 }, (_, i) =>
      pt(42 + 0.0001 * i, -8, i % 2 === 0 ? 100 : 102),
    );
    const smoothed = smoothElevation(points, 50); // ~5 puntos por ventana
    // Los puntos centrales deben converger hacia la media (~101)
    const middle = smoothed.slice(5, 15);
    for (const e of middle) {
      expect(e).toBeGreaterThan(100.4);
      expect(e).toBeLessThan(101.6);
    }
  });

  it('escalón real (subida sostenida): se conserva la pendiente media', () => {
    // 20 puntos cada ~11 m, elevación que sube linealmente 0→40 m (pendiente real ~18%)
    const points = Array.from({ length: 20 }, (_, i) =>
      pt(42 + 0.0001 * i, -8, i * 2),
    );
    const smoothed = smoothElevation(points, 50);
    // El primer y último punto suavizados conservan grosso modo el rango
    expect(smoothed[0]!).toBeLessThan(10);
    expect(smoothed[smoothed.length - 1]!).toBeGreaterThan(30);
  });

  it('window=0 o ventana sin vecinos: pasa-through', () => {
    const points = [pt(42, -8, 100), pt(42.001, -8, 105)];
    const smoothed = smoothElevation(points, 0);
    expect(smoothed[0]!).toBe(100);
    expect(smoothed[1]!).toBe(105);
  });

  it('array vacío: devuelve array vacío', () => {
    expect(smoothElevation([], 50)).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

Ejecutar:
```bash
pnpm test:run src/core/gpx/elevationSmoothing.test.ts
```
Esperado: FAIL "Cannot find module './elevationSmoothing'".

### 1.2 Implementar helper

- [ ] **Step 3: Crear `src/core/gpx/elevationSmoothing.ts`**

```typescript
import { haversineDistanceMeters } from './haversine';
import type { GpxPoint } from './types';

/**
 * Suaviza la altimetría sobre una ventana de distancia en metros (no nº de
 * puntos: GPX con muestreo irregular romperían el promedio uniforme).
 *
 * Para cada punto i, devuelve la media aritmética de la elevación de todos
 * los puntos cuya distancia acumulada en el track caiga en
 * [d_i - W/2, d_i + W/2]. Si W <= 0 devuelve el array original sin cambios.
 *
 * Por qué: los altímetros GPS de relojes/ciclocomputadores tienen ruido
 * típico de ±1-3 m incluso parados. Computar pendiente punto-a-punto
 * amplifica ese jitter en falsos muros del 10-15% durante 2-3 m de track,
 * que la ecuación de potencia convierte en picos irreales de ~600 W. Una
 * ventana de 30-50 m (estándar industrial: Strava, Garmin Connect) plancha
 * el ruido sin perder la información de pendientes reales sostenidas.
 */
export function smoothElevation(points: readonly GpxPoint[], windowMeters: number): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (windowMeters <= 0) return points.map((p) => p.ele);

  // Distancia acumulada desde el primer punto.
  const cumulative = new Array<number>(n);
  cumulative[0] = 0;
  for (let i = 1; i < n; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cumulative[i] = cumulative[i - 1]! + haversineDistanceMeters(a.lat, a.lon, b.lat, b.lon);
  }

  const half = windowMeters / 2;
  const out = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    const target = cumulative[i]!;
    // Avanzar hi mientras esté dentro de [target - half, target + half]
    while (hi < n && cumulative[hi]! <= target + half) {
      sum += points[hi]!.ele;
      count++;
      hi++;
    }
    // Avanzar lo mientras esté fuera del extremo inferior
    while (lo < hi && cumulative[lo]! < target - half) {
      sum -= points[lo]!.ele;
      count--;
      lo++;
    }
    out[i] = count > 0 ? sum / count : points[i]!.ele;
  }
  return out;
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
pnpm test:run src/core/gpx/elevationSmoothing.test.ts
```
Esperado: 6 PASS.

### 1.3 Integrar en `computeSegments`

- [ ] **Step 5: Test de integración: track diente de sierra produce slopes suaves**

Añadir al final de `src/core/gpx/segments.test.ts`:

```typescript
  it('diente de sierra GPS: pendiente suavizada se mantiene cercana a 0%', () => {
    // Puntos cada ~11 m con elevación oscilando ±2 m sobre 100m base llano.
    // Sin smoothing producirían pendientes ±18% alternantes; con smoothing,
    // < ±5%.
    const points = Array.from({ length: 21 }, (_, i) => ({
      lat: 42 + 0.0001 * i,
      lon: -8,
      ele: i % 2 === 0 ? 100 : 102,
    }));
    const track = makeTrack(points);
    const segments = computeSegments(track);
    // Ignorar primer y último segmento (efectos de borde de la ventana)
    const middle = segments.slice(2, segments.length - 2);
    for (const s of middle) {
      expect(Math.abs(s.slopePercent)).toBeLessThan(5);
    }
  });
```

- [ ] **Step 6: Ejecutar el test, verificar que falla**

```bash
pnpm test:run src/core/gpx/segments.test.ts
```
Esperado: el nuevo test falla con slopePercent ≈ ±18%, los demás pasan.

- [ ] **Step 7: Modificar `computeSegments` para usar elevación suavizada**

En `src/core/gpx/segments.ts`:

Añadir import al principio del fichero:
```typescript
import { smoothElevation } from './elevationSmoothing';
```

Justo encima de `function clampSlope`, añadir la constante:
```typescript
/**
 * Ventana de distancia (metros) para suavizar la altimetría GPS antes de
 * derivar la pendiente. 50 m es un estándar industrial y plancha el jitter
 * típico (±1-3 m) sin enmascarar repechos reales sostenidos.
 */
const ELEVATION_SMOOTHING_WINDOW_METERS = 50;
```

Reemplazar el cuerpo de `computeSegments` (líneas 37-77) por:

```typescript
export function computeSegments(track: GpxTrack): DistanceSegment[] {
  const out: DistanceSegment[] = [];
  const smoothedEle = smoothElevation(track.points, ELEVATION_SMOOTHING_WINDOW_METERS);

  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    if (!a || !b) continue;

    const distance = haversineDistanceMeters(a.lat, a.lon, b.lat, b.lon);
    // Pendiente sobre elevación suavizada para descartar jitter GPS.
    // elevationDeltaMeters reporta el delta SUAVIZADO porque es lo que
    // alimenta la ecuación de potencia y la clasificación cadenceProfile.
    const elevDelta = (smoothedEle[i + 1] ?? b.ele) - (smoothedEle[i] ?? a.ele);

    const rawSlope = distance > 0 ? (100 * elevDelta) / distance : 0;
    const slope = clampSlope(rawSlope);

    let duration: number;
    let speed: number;
    if (track.hasTimestamps && a.time !== null && b.time !== null) {
      duration = (b.time.getTime() - a.time.getTime()) / 1000;
      if (duration <= 0) {
        speed = estimateSpeedMps(slope);
        duration = speed > 0 ? distance / speed : 0;
      } else {
        speed = duration > 0 ? distance / duration : 0;
      }
    } else {
      speed = estimateSpeedMps(slope);
      duration = speed > 0 ? distance / speed : 0;
    }

    out.push({
      fromIndex: i,
      toIndex: i + 1,
      distanceMeters: distance,
      elevationDeltaMeters: elevDelta,
      slopePercent: slope,
      durationSeconds: duration,
      speedMps: speed,
    });
  }
  return out;
}
```

Actualizar el JSDoc de `computeSegments` (líneas 26-36) para reflejar el suavizado:
```typescript
/**
 * Convierte el track de puntos en una lista de segmentos consecutivos
 * (par i, i+1) con distancia, pendiente, duracion y velocidad.
 *
 * Antes de derivar la pendiente, la altimetría se suaviza con una ventana
 * de 50 m para eliminar jitter GPS típico (±1-3 m) que produce falsos muros.
 *
 * - Si hasTimestamps: duracion real desde los timestamps; velocidad = dist/duracion.
 * - Si no: duracion estimada via velocidad heuristica por pendiente.
 *
 * Pendiente clampada a +/-30% como red de seguridad final por si quedase
 * algun outlier despues del suavizado (track GPS muy malo o ele saltada).
 */
```

- [ ] **Step 8: Ejecutar TODA la suite de gpx + segmentation**

```bash
pnpm test:run src/core/gpx
pnpm test:run src/core/segmentation
```
Esperado: 100% PASS. Si algún test "real" del proyecto rompe (típicamente el de cuesta arriba con pendiente esperada ~10%), revisar por qué — es probable que el rango de validación del test fuera estrecho y haya que ampliarlo ligeramente porque ahora la pendiente reportada es la suavizada.

- [ ] **Step 9: Verificar que typecheck y lint pasan**

```bash
pnpm typecheck
pnpm lint
```
Esperado: 0 errores.

- [ ] **Step 10: Commit**

```bash
git add src/core/gpx/elevationSmoothing.ts src/core/gpx/elevationSmoothing.test.ts src/core/gpx/segments.ts src/core/gpx/segments.test.ts
git commit -m "$(cat <<'EOF'
feat(gpx): suavizado de altimetría con ventana de 50 m antes de derivar pendiente

Los altímetros GPS tienen jitter típico de ±1-3 m que la pendiente
punto-a-punto amplifica en falsos muros del 10-15% sobre 2-3 m, lo que
la ecuación de potencia convertía en picos irreales de ~600 W. Suavizar
la elevación antes de derivar la pendiente plancha el ruido sin
enmascarar pendientes reales sostenidas. El clamp ±30% se mantiene
como red de seguridad.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Adaptador GPX → EditableSessionPlan + botón export `.zwo`

**Files:**
- Create: `src/core/sessionFormats/fromClassifiedSegments.ts`
- Test: `src/core/sessionFormats/fromClassifiedSegments.test.ts`
- Modify: `src/core/sessionFormats/index.ts`
- Modify: `src/ui/pages/ResultStep.tsx`
- Modify: `src/ui/App.tsx`

### 2.1 Test del adaptador puro

- [ ] **Step 11: Crear test file con casos clave**

Crear `src/core/sessionFormats/fromClassifiedSegments.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gpxToEditableSessionPlan } from './fromClassifiedSegments';
import type { ClassifiedSegment } from '../segmentation/types';

function seg(
  zone: 1 | 2 | 3 | 4 | 5 | 6,
  cadence: 'flat' | 'climb' | 'sprint',
  durationSec: number,
): ClassifiedSegment {
  return {
    startSec: 0,
    durationSec,
    avgPowerWatts: 200,
    zone,
    cadenceProfile: cadence,
    startDistanceMeters: 0,
    endDistanceMeters: 0,
    startElevationMeters: 0,
    endElevationMeters: 0,
    startLat: 0,
    startLon: 0,
  };
}

describe('gpxToEditableSessionPlan', () => {
  it('vacío → plan vacío con name', () => {
    const plan = gpxToEditableSessionPlan([], 'Mi ruta');
    expect(plan.name).toBe('Mi ruta');
    expect(plan.items).toEqual([]);
  });

  it('un único segmento → un único item block', () => {
    const plan = gpxToEditableSessionPlan([seg(3, 'flat', 60)], 'Test');
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toEqual({
      type: 'block',
      block: expect.objectContaining({
        zone: 3,
        cadenceProfile: 'flat',
        durationSec: 60,
      }),
    });
  });

  it('tres segmentos consecutivos misma (zona, cadenceProfile) se mergean', () => {
    const segments = [
      seg(2, 'flat', 60),
      seg(2, 'flat', 60),
      seg(2, 'flat', 60),
    ];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0]!;
    expect(item.type).toBe('block');
    if (item.type === 'block') {
      expect(item.block.durationSec).toBe(180);
      expect(item.block.zone).toBe(2);
    }
  });

  it('cambio de zona rompe el merge', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(3);
  });

  it('cambio de cadenceProfile (mismo zone) rompe el merge', () => {
    const segments = [seg(3, 'flat', 60), seg(3, 'climb', 60), seg(3, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    expect(plan.items).toHaveLength(3);
  });

  it('primer bloque Z1-Z2 se etiqueta como warmup', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const first = plan.items[0]!;
    if (first.type === 'block') expect(first.block.phase).toBe('warmup');
    else throw new Error('expected block');
  });

  it('último bloque Z1-Z2 se etiqueta como cooldown', () => {
    const segments = [seg(4, 'flat', 60), seg(1, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const last = plan.items[plan.items.length - 1]!;
    if (last.type === 'block') expect(last.block.phase).toBe('cooldown');
    else throw new Error('expected block');
  });

  it('Z1-Z2 intermedio se etiqueta como recovery', () => {
    const segments = [seg(4, 'flat', 60), seg(2, 'flat', 60), seg(4, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const middle = plan.items[1]!;
    if (middle.type === 'block') expect(middle.block.phase).toBe('recovery');
    else throw new Error('expected block');
  });

  it('Z3-Z6 intermedio se etiqueta como work', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const middle = plan.items[1]!;
    if (middle.type === 'block') expect(middle.block.phase).toBe('work');
    else throw new Error('expected block');
  });

  it('IDs únicos y estables', () => {
    const segments = [seg(2, 'flat', 60), seg(4, 'flat', 60), seg(2, 'flat', 60)];
    const plan = gpxToEditableSessionPlan(segments, 'Test');
    const ids = plan.items.map((it) => (it.type === 'block' ? it.block.id : ''));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reconcilia profile inválido para zona (Z5+sprint → Z5+climb)', () => {
    // Z5 solo permite climb. Si el GPX clasificó algo como Z5+sprint (no
    // debería pasar por construcción, pero si pasa el adaptador lo arregla),
    // se reconcilia al default de la zona.
    const plan = gpxToEditableSessionPlan([seg(5, 'sprint' as never, 60)], 'Test');
    const item = plan.items[0]!;
    if (item.type === 'block') expect(item.block.cadenceProfile).toBe('climb');
    else throw new Error('expected block');
  });

  it('round-trip via exportZwo no lanza', async () => {
    const { exportZwo } = await import('./zwo');
    const segments = [
      seg(2, 'flat', 120),
      seg(4, 'flat', 180),
      seg(5, 'climb', 60),
      seg(2, 'flat', 120),
    ];
    const plan = gpxToEditableSessionPlan(segments, 'Mi ruta del domingo');
    const xml = exportZwo(plan);
    expect(xml).toContain('<workout_file>');
    expect(xml).toContain('<name>Mi ruta del domingo</name>');
    expect(xml).toContain('<SteadyState');
  });
});
```

- [ ] **Step 12: Verificar que el test falla**

```bash
pnpm test:run src/core/sessionFormats/fromClassifiedSegments.test.ts
```
Esperado: FAIL "Cannot find module './fromClassifiedSegments'".

### 2.2 Implementar adaptador

- [ ] **Step 13: Crear `src/core/sessionFormats/fromClassifiedSegments.ts`**

```typescript
import type { ClassifiedSegment } from '../segmentation/types';
import {
  reconcileCadenceProfile,
  type EditableSessionPlan,
  type Phase,
  type SessionBlock,
  type SessionItem,
} from '../segmentation/sessionPlan';
import type { HeartRateZone } from '../physiology/karvonen';

/**
 * Heurística de fase para un bloque del plan generado a partir de un GPX.
 *
 * - Primer bloque: warmup si Z1-Z2; en otro caso work (la ruta empieza
 *   directamente en intensidad media-alta).
 * - Último bloque: cooldown si Z1-Z2; en otro caso work.
 * - Intermedios: recovery si Z1-Z2; work si Z3-Z6.
 *
 * No buscamos perfeccion: phase no afecta a la fisica del .zwo, solo a
 * iconos/labels. La heuristica es robusta a ordenes raros (rutas que
 * empiezan en bajada, etc.).
 */
function inferPhaseForGpx(zone: HeartRateZone, indexInPlan: number, totalItems: number): Phase {
  const isFirst = indexInPlan === 0;
  const isLast = indexInPlan === totalItems - 1;
  const isRecoveryZone = zone <= 2;

  if (isFirst && isRecoveryZone) return 'warmup';
  if (isLast && isRecoveryZone) return 'cooldown';
  if (isRecoveryZone) return 'recovery';
  return 'work';
}

/**
 * Adapta una ruta GPX ya clasificada (`ClassifiedSegment[]`) a un
 * `EditableSessionPlan` listo para serializar como .zwo o cargar en el
 * SessionBuilder. Hace dos cosas clave:
 *
 * 1. **Merge de bloques contiguos**: agrupa segmentos consecutivos con
 *    igual `(zone, cadenceProfile)` en un único `SessionBlock` cuya
 *    duración es la suma. Sin esto, una ruta de 1h produciría 60 bloques
 *    de 60s en el .zwo, ilegible en Zwift y absurdo desde punto de vista
 *    de entrenamiento estructurado.
 *
 * 2. **Asignación de phase**: heurística por posición + zona (ver
 *    `inferPhaseForGpx`). En el .zwo final esto decide warmup/cooldown
 *    con rampa vs SteadyState plano.
 *
 * El adaptador NO requiere FTP: los porcentajes %FTP en el .zwo se
 * derivan de la zona Coggan a través del mapeo `ZONE_TO_POWER` en
 * `zwo.ts`, y el smart trainer del usuario aplicará su propio FTP local
 * al reproducir el workout.
 *
 * Determinista: misma entrada → misma salida. IDs estables por posición
 * (`gpx-{index}`) para que el plan se pueda re-renderizar sin colisiones
 * de React keys.
 */
export function gpxToEditableSessionPlan(
  segments: readonly ClassifiedSegment[],
  routeName: string,
): EditableSessionPlan {
  if (segments.length === 0) {
    return { name: routeName, items: [] };
  }

  // Paso 1: merge de contiguos.
  type Merged = { zone: HeartRateZone; cadenceProfile: SessionBlock['cadenceProfile']; durationSec: number };
  const merged: Merged[] = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && last.zone === s.zone && last.cadenceProfile === s.cadenceProfile) {
      last.durationSec += s.durationSec;
    } else {
      merged.push({
        zone: s.zone,
        cadenceProfile: s.cadenceProfile,
        durationSec: s.durationSec,
      });
    }
  }

  // Paso 2: convertir a SessionItem[] con phase inferida.
  const items: SessionItem[] = merged.map((m, i) => {
    const phase = inferPhaseForGpx(m.zone, i, merged.length);
    const cadenceProfile = reconcileCadenceProfile(m.zone, m.cadenceProfile);
    const block: SessionBlock = {
      id: `gpx-${i}`,
      phase,
      zone: m.zone,
      cadenceProfile,
      durationSec: Math.max(1, Math.round(m.durationSec)),
    };
    return { type: 'block', block };
  });

  return { name: routeName, items };
}
```

- [ ] **Step 14: Exportar desde el barrel**

Modificar `src/core/sessionFormats/index.ts`:

```typescript
export { exportZwo, importZwo } from './zwo';
export type { ZwoExportOptions, ZwoImportResult } from './zwo';
export { gpxToEditableSessionPlan } from './fromClassifiedSegments';
```

- [ ] **Step 15: Ejecutar tests**

```bash
pnpm test:run src/core/sessionFormats
```
Esperado: 100% PASS (los tests de zwo existentes + los nuevos).

- [ ] **Step 16: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```
Esperado: 0 errores.

### 2.3 Botón "Descargar .zwo" en ResultStep (modo GPX)

- [ ] **Step 17: Mirar la firma actual de `ResultStep`**

Leer `src/ui/pages/ResultStep.tsx` líneas 1-110 para confirmar la interfaz `ResultStepProps`. Apuntar:
- ¿Recibe ya `segments` o solo `routeMeta`?
- ¿Recibe `sourceType`?

Si NO los recibe, hay que añadirlos a `ResultStepProps` y pasarlos desde `App.tsx`. Si sí, saltar al Step 19.

- [ ] **Step 18: Extender `ResultStepProps` y `App.tsx` con `sourceType` y `segments`**

En `src/ui/pages/ResultStep.tsx`, en la interfaz `ResultStepProps` añadir (manteniendo el resto):

```typescript
import type { ClassifiedSegment, RouteMeta } from '@core/segmentation';
// (si no estaba)

export interface ResultStepProps {
  // ...lo que ya hubiera...
  routeMeta: RouteMeta;
  /** Solo presente cuando sourceType === 'gpx'. */
  sourceType: 'gpx' | 'session';
  /** Segmentos clasificados de la ruta. Necesarios para exportar a .zwo. */
  segments: readonly ClassifiedSegment[];
}
```

En `src/ui/App.tsx`, donde se renderiza `<ResultStep ... />` (alrededor de la línea 532), añadir las props:

```tsx
<ResultStep
  /* ...props existentes... */
  sourceType={sourceType ?? 'gpx'}
  segments={routeSegments ?? []}
/>
```

(Los `??` son defensivos: si por algún motivo el flujo llega a ResultStep sin sourceType definido, asumimos `gpx` para no romper.)

- [ ] **Step 19: Añadir el botón de export en ResultStep**

En la cabecera de `src/ui/pages/ResultStep.tsx`, junto a los otros imports añadir:

```typescript
import { exportZwo, gpxToEditableSessionPlan } from '@core/sessionFormats';
```

Dentro del componente `ResultStep`, añadir el handler antes del `return`:

```typescript
const handleDownloadZwo = (): void => {
  if (sourceType !== 'gpx' || segments.length === 0) return;
  const plan = gpxToEditableSessionPlan(segments, routeMeta.name || 'Ruta GPX');
  const xml = exportZwo(plan);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilenameForZwo(routeMeta.name || 'cadencia-ruta') + '.zwo';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

Y el helper local justo antes del componente:

```typescript
function sanitizeFilenameForZwo(raw: string): string {
  // Solo a-z 0-9 - _ y espacios → "_". Sin extensiones, sin slashes.
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 _-]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'cadencia-ruta';
}
```

En el JSX, junto a los demás CTAs del ResultStep (típicamente cerca del botón "Crear playlist en Spotify"), añadir un botón de export visible solo en modo GPX:

```tsx
{sourceType === 'gpx' && segments.length > 0 && (
  <Button
    variant="secondary"
    onClick={handleDownloadZwo}
    aria-label="Descargar la ruta como workout .zwo para Zwift, TrainerRoad o similares"
  >
    Descargar .zwo
  </Button>
)}
```

(Adaptar `variant` y estilos al sistema de `Button` que ya use el archivo. El texto exacto del `aria-label` puede ajustarse para ser más natural en el contexto.)

- [ ] **Step 20: Verificar manualmente en el navegador**

```bash
pnpm dev
```

En `http://127.0.0.1:5173`:
1. Subir un GPX de prueba (o usar uno existente de `tests/fixtures` si lo hubiera).
2. Llegar al ResultStep.
3. Pulsar "Descargar .zwo" → debe descargar un archivo `<nombre>.zwo`.
4. Abrir el archivo con un editor: comprobar que es XML válido, contiene `<workout_file>`, `<name>` con el nombre de la ruta, y al menos un `<SteadyState>` o `<Warmup>`.
5. Cambiar al modo Sesión Indoor y comprobar que el botón "Descargar .zwo" NO aparece en ResultStep (porque ya existe en SessionBuilder y no queremos duplicarlo).

Si algo falla, depurar antes de continuar.

- [ ] **Step 21: Typecheck + lint + tests**

```bash
pnpm typecheck
pnpm lint
pnpm test:run
```
Esperado: 0 errores, 100% PASS.

- [ ] **Step 22: Commit**

```bash
git add src/core/sessionFormats/fromClassifiedSegments.ts src/core/sessionFormats/fromClassifiedSegments.test.ts src/core/sessionFormats/index.ts src/ui/pages/ResultStep.tsx src/ui/App.tsx
git commit -m "$(cat <<'EOF'
feat(sessionFormats,ui): export GPX → .zwo desde ResultStep

Permite descargar una ruta GPX procesada como workout .zwo (Zwift,
TrainerRoad, Wahoo SYSTM, MyWhoosh, TrainingPeaks Virtual). El
adaptador mergea bloques contiguos de misma zona+cadenceProfile, asigna
warmup/cooldown a tramos Z1-Z2 inicial/final y recovery/work al resto.
No requiere FTP en Cadencia: el .zwo usa %FTP estándar Coggan y el
smart trainer aplica el FTP del usuario al reproducir.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Normalized Power riguroso (Coggan estricto)

**Files:**
- Create: `src/core/segmentation/normalizedPower.ts`
- Test: `src/core/segmentation/normalizedPower.test.ts`
- Modify: `src/core/segmentation/blocks.ts`
- Existing tests: `src/core/segmentation/blocks.test.ts` deben seguir verdes (la assertion `NP >= averagePower` se mantiene matemáticamente).

### 3.1 Test del cálculo NP aislado

- [ ] **Step 23: Crear test file con casos clave**

Crear `src/core/segmentation/normalizedPower.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateNormalizedPower } from './normalizedPower';

describe('calculateNormalizedPower', () => {
  it('vacío → 0', () => {
    expect(calculateNormalizedPower([])).toBe(0);
  });

  it('potencia constante → NP === media', () => {
    // 60s a 200W
    const samples = Array.from({ length: 60 }, () => ({ powerWatts: 200, durationSec: 1 }));
    const np = calculateNormalizedPower(samples);
    expect(np).toBeCloseTo(200, 1);
  });

  it('potencia variable → NP > media', () => {
    // 60s a 100W + 30s a 600W (sprint corto). Media = (60·100 + 30·600)/90 ≈ 266.7W
    // NP debe ser claramente mayor por el peso ^4.
    const samples = [
      ...Array.from({ length: 60 }, () => ({ powerWatts: 100, durationSec: 1 })),
      ...Array.from({ length: 30 }, () => ({ powerWatts: 600, durationSec: 1 })),
    ];
    const np = calculateNormalizedPower(samples);
    const total = samples.reduce((a, s) => a + s.powerWatts * s.durationSec, 0);
    const avg = total / samples.reduce((a, s) => a + s.durationSec, 0);
    expect(np).toBeGreaterThan(avg + 20);
  });

  it('rolling 30s suaviza picos sub-30s (sprint de 5s no domina)', () => {
    // 5s a 1000W aislado dentro de 600s a 200W. Sin rolling 30s, el ^4
    // explotaria; con rolling 30s, el pico se promedia sobre la ventana
    // y el NP queda solo ligeramente sobre 200W.
    const samples = [
      ...Array.from({ length: 300 }, () => ({ powerWatts: 200, durationSec: 1 })),
      ...Array.from({ length: 5 }, () => ({ powerWatts: 1000, durationSec: 1 })),
      ...Array.from({ length: 295 }, () => ({ powerWatts: 200, durationSec: 1 })),
    ];
    const np = calculateNormalizedPower(samples);
    // Sin rolling: NP ≈ 280-300+. Con rolling 30s: NP ≈ 220-240.
    expect(np).toBeGreaterThan(210);
    expect(np).toBeLessThan(260);
  });

  it('serie demasiado corta (< 30s) cae a la media simple', () => {
    const samples = Array.from({ length: 10 }, () => ({ powerWatts: 250, durationSec: 1 }));
    expect(calculateNormalizedPower(samples)).toBeCloseTo(250, 1);
  });

  it('soporta segmentos con duracionSec > 1 (resamplea correctamente)', () => {
    // 60s a 200W expresado como 6 segmentos de 10s cada uno.
    const samples = Array.from({ length: 6 }, () => ({ powerWatts: 200, durationSec: 10 }));
    expect(calculateNormalizedPower(samples)).toBeCloseTo(200, 1);
  });

  it('NP siempre >= media', () => {
    const samples = [
      { powerWatts: 100, durationSec: 30 },
      { powerWatts: 150, durationSec: 30 },
      { powerWatts: 350, durationSec: 30 },
      { powerWatts: 200, durationSec: 30 },
    ];
    const np = calculateNormalizedPower(samples);
    const total = samples.reduce((a, s) => a + s.powerWatts * s.durationSec, 0);
    const avg = total / samples.reduce((a, s) => a + s.durationSec, 0);
    expect(np).toBeGreaterThanOrEqual(avg - 0.001);
  });
});
```

- [ ] **Step 24: Verificar que el test falla**

```bash
pnpm test:run src/core/segmentation/normalizedPower.test.ts
```
Esperado: FAIL "Cannot find module './normalizedPower'".

### 3.2 Implementar NP riguroso

- [ ] **Step 25: Crear `src/core/segmentation/normalizedPower.ts`**

```typescript
/**
 * Muestra de potencia (vatios) durante un intervalo. Permite series con dt
 * irregular (ej. GPX donde algunos puntos están a 1s y otros a 5-10s).
 */
export interface PowerSample {
  powerWatts: number;
  durationSec: number;
}

const ROLLING_WINDOW_SEC = 30;

/**
 * Normalized Power (NP) según el algoritmo original de Andrew Coggan:
 *
 *   1. Resamplear la potencia a una malla de 1 s (aquí: replicar el valor
 *      del segmento original en cada segundo que cubre).
 *   2. Aplicar una media móvil de 30 s sobre la malla 1 s.
 *   3. Elevar cada valor de la media móvil a la 4ª potencia.
 *   4. Calcular la media aritmética.
 *   5. Tomar la raíz 4ª.
 *
 * Por qué: la 4ª potencia modela la respuesta metabólica desproporcionada
 * a esfuerzos altos. La media móvil de 30 s captura la inercia
 * fisiológica (no respondes instantáneamente a un sprint de 3 s). Versión
 * sobre bloques de 60 s (la previa) sobre-suavizaba: un sprint de 30 s
 * dentro de un bloque de 60 s desaparece, y NP subestimaba.
 *
 * Si la serie total es < 30 s no hay ventana suficiente para el rolling
 * y devolvemos la media simple (caso degenerado de rutas muy cortas).
 */
export function calculateNormalizedPower(samples: readonly PowerSample[]): number {
  if (samples.length === 0) return 0;

  // 1. Resample a malla de 1s. Para cada segmento de duracionSec=N, replicamos
  //    el valor N veces. Si durationSec no es entero, usamos floor; el resto
  //    se acumula al siguiente segmento (no perdemos energía total).
  const power1s: number[] = [];
  let carry = 0;
  for (const s of samples) {
    const total = s.durationSec + carry;
    const whole = Math.floor(total);
    carry = total - whole;
    for (let i = 0; i < whole; i++) power1s.push(s.powerWatts);
  }
  if (carry >= 0.5 && samples.length > 0) {
    power1s.push(samples[samples.length - 1]!.powerWatts);
  }

  if (power1s.length === 0) return 0;

  // 2. Caso degenerado: serie demasiado corta para la ventana de 30s.
  if (power1s.length < ROLLING_WINDOW_SEC) {
    return power1s.reduce((a, b) => a + b, 0) / power1s.length;
  }

  // 3. Rolling mean de 30s con prefix-sum incremental.
  let windowSum = 0;
  for (let i = 0; i < ROLLING_WINDOW_SEC; i++) windowSum += power1s[i]!;

  let np4Sum = Math.pow(windowSum / ROLLING_WINDOW_SEC, 4);
  let count = 1;

  for (let i = ROLLING_WINDOW_SEC; i < power1s.length; i++) {
    windowSum += power1s[i]! - power1s[i - ROLLING_WINDOW_SEC]!;
    np4Sum += Math.pow(windowSum / ROLLING_WINDOW_SEC, 4);
    count++;
  }

  return Math.pow(np4Sum / count, 0.25);
}
```

- [ ] **Step 26: Ejecutar tests del helper**

```bash
pnpm test:run src/core/segmentation/normalizedPower.test.ts
```
Esperado: 7 PASS.

### 3.3 Reemplazar el cálculo NP en `blocks.ts`

- [ ] **Step 27: Modificar `src/core/segmentation/blocks.ts`**

Añadir import al principio:
```typescript
import { calculateNormalizedPower, type PowerSample } from './normalizedPower';
```

Dentro del bucle principal (alrededor de la línea 99, donde itera `distSegments`), recolectar las muestras de potencia 1s. Concretamente, justo después de calcular `power` con `estimatePowerWatts`, añadir un acumulador. Modificar la sección:

Reemplazar las líneas que ahora calculan NP sobre bloques (135-139):

```typescript
  // Normalized Power: NP = (sum(P^4 * dt) / totalDuration)^(1/4) sobre los bloques.
  // Nota: Coggan original usa moving avg 30s, no bloques fijos. Esta es una
  // aproximacion razonable para esta primera version.
  const npNumerator = blocks.reduce(
    (acc, b) => acc + Math.pow(b.avgPowerWatts, 4) * b.durationSec,
    0,
  );
  const np = totalDuration > 0 ? Math.pow(npNumerator / totalDuration, 0.25) : 0;
```

Por:

```typescript
  // Normalized Power Coggan riguroso: rolling 30s sobre malla 1s. Calculamos
  // las muestras de potencia por DistanceSegment (no por bloque de 60s) para
  // preservar la información de micro-esfuerzos (sprints, repechos cortos)
  // que el ^4 amplifica.
  const np = calculateNormalizedPower(powerSamples);
```

Y añadir la recolección de `powerSamples` dentro del bucle principal. La forma menos invasiva: junto a las otras variables de estado al inicio de la función, añadir:

```typescript
  const powerSamples: PowerSample[] = [];
```

Y dentro del bucle, justo después de `const power = estimatePowerWatts(...)`:

```typescript
    powerSamples.push({ powerWatts: power, durationSec: ds.durationSeconds });
```

- [ ] **Step 28: Ejecutar TODA la suite de segmentation**

```bash
pnpm test:run src/core/segmentation
```
Esperado: 100% PASS. La assertion clave del test existente (`NP >= averagePower`) se mantiene matemáticamente para cualquier definición de NP.

- [ ] **Step 29: Ejecutar suite completa por seguridad**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
```
Esperado: 0 errores, 100% PASS.

- [ ] **Step 30: Commit**

```bash
git add src/core/segmentation/normalizedPower.ts src/core/segmentation/normalizedPower.test.ts src/core/segmentation/blocks.ts
git commit -m "$(cat <<'EOF'
feat(segmentation): NP riguroso (Coggan) sobre malla 1s con rolling 30s

Reemplaza el NP aproximado sobre bloques de 60s por el algoritmo
original de Coggan: resamplear potencia a 1s, aplicar media móvil de
30s, elevar a la 4ª, promediar y raíz 4ª. Sobre bloques de 60s un
sprint de 30s desaparecía y NP subestimaba; ahora la cifra cuadra con
TrainingPeaks/Garmin Connect para la misma serie.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (post implementación)

Antes de cerrar la rama:

- [ ] **Step 31: Suite completa + build de producción**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
```
Esperado: 0 errores, 100% PASS, build genera `dist/` sin warnings.

- [ ] **Step 32: Comprobación manual del flujo GPX completo**

```bash
pnpm dev
```

En el navegador:
1. Subir un GPX real (preferentemente con relieve y ruido GPS típico).
2. Verificar que la métrica NP de la cabecera del ResultStep es razonable (más alta que average power, no astronómica).
3. Comprobar que el chart de elevación tiene aspecto suave (sin dientes de sierra anormales).
4. Pulsar "Descargar .zwo" → abrir el `.zwo` y revisar el XML.
5. (Opcional) Importar el `.zwo` en Zwift Workout Editor o TrainerRoad para confirmar que parsea sin errores.

---

## Notas de cierre

- Las tres mejoras son **internamente compatibles**: no cambian APIs públicas de `core/`, no rompen ningún flujo existente, y mantienen la regla "core nunca importa de ui".
- Ningún `any` añadido, ningún `--no-verify` necesario. El pre-commit Husky debe pasar limpio en cada commit.
- La rama queda con 3 commits atómicos, uno por mejora, en orden de dependencia. Si por algún motivo se decide deshacer alguna, `git revert <SHA>` del commit correspondiente es seguro.
