# Google Drive Sync (Fase 1 + Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir sincronización opcional con Google Drive (`drive.appdata` scope) que persiste en la cuenta del propio usuario sus inputs fisiológicos, preferencias musicales y sesiones guardadas, accesibles desde cualquier dispositivo. La app sigue funcionando 100% sin Drive.

**Architecture:** localStorage como almacenamiento primario, Drive como capa de sync opcional. Patrón clonado de `D:/SOFTWARE/oraculo/js/gdrive/` (4 archivos: `auth-web.js`, `drive-api.js`, `sync.js`, `merge.js`) — probado en producción. Separación estricta `core/sync/` (lógica pura, TDD) vs `integrations/gdrive/` (auth + REST + orquestación). Merge engine declarativo con registro de secciones: `atomic` LWW para `userInputs` y `musicPreferences`; `array` con merge por `id` + tombstones para `savedSessions`. Push debounced 2 s tras cambios locales, poll 30 s para detectar cambios remotos, pull on `visibilitychange`.

**Tech Stack:** TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), React 18, Vite 6, Vitest, Google Identity Services (script externo en `index.html`), Drive API v3 vía `fetch()` REST puro (sin SDK).

---

## Decisiones de diseño locked-in

1. **Scope OAuth:** `https://www.googleapis.com/auth/drive.appdata`. Carpeta oculta, invisible al usuario en su Drive. No requiere verificación de Google.
2. **Archivo único en Drive:** `cadencia_data.json` en `appDataFolder`. Toda la data del usuario va en un solo JSON con secciones tipadas.
3. **localStorage-first:** la app funciona idéntica sin Drive. Todos los datos del usuario viven primero en `localStorage` y solo se sincronizan si conecta. La presencia de la conexión Drive NO es requisito para ninguna feature.
4. **Migración a localStorage**: `userInputs` ya tiene opt-in a localStorage (ver [src/core/user/storage.ts](src/core/user/storage.ts)). Se extiende ese patrón a `musicPreferences` (hoy en `wizardStorage` sessionStorage) y se añade nuevo store `savedSessions`.
5. **El estado del wizard sigue en sessionStorage**: `routeSegments`, `matchedList`, `currentStep`, `replacedIndices`, etc. son ephemeral por diseño (sobreviven al OAuth Spotify pero se descartan al cerrar la pestaña). Solo migran a localStorage los 3 stores del usuario duradero.
6. **Client ID por env:** `VITE_GOOGLE_CLIENT_ID` en `.env.local`. Se ofrece código completo con placeholder; la usuaria genera el Client ID en Google Cloud Console al final.
7. **Merge `atomic` LWW por sección:** wins el lado con `_sectionMeta[section].updatedAt` mayor. En empate, wins remote (idempotencia tras pull-merge-push).
8. **Merge `array` por `id`:** unión de items, LWW por item, tombstones (`deletedAt`) con expiry 30 días.
9. **Sin polling pesado:** GET `?fields=version` (~200 B). Solo pull completo si version cambia.

---

## File Structure

```
src/
  core/
    sync/                        ← NUEVO. PURO. Sin DOM, sin React, sin red.
      types.ts                   Tipos SyncedData, SectionMeta, SavedSession
      schema.ts                  empty(), schemaVersion, migración
      merge.ts                   mergeData() + section registry
      merge.test.ts              Tests TDD del merge engine
      richness.ts                calculateDataRichness() + isEmptyData()
      richness.test.ts
      tombstones.ts              cleanExpiredTombstones()
      tombstones.test.ts
    user/
      storage.ts                 ← MODIFICADO. Refactor a localStorage primary
                                 + integración con SyncedData store.
    music/                       ← NUEVO carpeta
      preferences.ts             EMPTY_MUSIC_PREFERENCES, load/save/clear
      preferences.test.ts
    sessions/                    ← NUEVO carpeta (Fase 2)
      saved.ts                   CRUD de SavedSession en localStorage
      saved.test.ts
  integrations/
    gdrive/                      ← NUEVO. Auth + REST. Depende de core/sync.
      config.ts                  SCOPE, CLIENT_ID, FILE_NAME, intervalos
      auth.ts                    signIn / getTokenSilent / refresh / signOut
      drive-api.ts               findFile / readFile / createFile / updateFile / getMetadata
      drive-api.test.ts          Tests con fetch mockeado
      sync.ts                    init / connect / disconnect / push / pull / polling
      sync.test.ts               Tests con auth+drive-api mockeados
  ui/
    components/
      sync/
        GoogleSyncCard.tsx       ← NUEVO. Botón conectar/desconectar + estado
        SyncStatusBadge.tsx      ← NUEVO. Indicador "sincronizado" / "error" / "offline"
      session-builder/
        SaveSessionDialog.tsx    ← NUEVO (Fase 2). Modal "Guardar como plantilla"
        MySavedSessionsTab.tsx   ← NUEVO (Fase 2). Lista de sesiones del usuario
        TemplateGallery.tsx      ← MODIFICADO. Añade tab "Mis sesiones"
    pages/
      EditDataPanel.tsx          ← MODIFICADO. Inserta GoogleSyncCard
    state/
      cadenciaStore.ts           ← NUEVO. Single source of truth localStorage
                                 + dispatcher 'cadencia-data-saved' event
      cadenciaStore.test.ts
public/
  privacidad-google.html         ← NUEVO. Política de privacidad específica
                                 para el scope de Drive
index.html                       ← MODIFICADO. <script src="https://accounts.google.com/gsi/client">
.env.example                     ← MODIFICADO. Añade VITE_GOOGLE_CLIENT_ID
```

---

## Task 1: Foundation — types y constantes

**Files:**
- Create: `src/core/sync/types.ts`
- Create: `src/core/sync/schema.ts`
- Test: (no test todavía — solo tipos)

- [ ] **Step 1: Crear tipos del data model sincronizado**

Archivo nuevo `src/core/sync/types.ts`:

```typescript
import type { UserInputsRaw } from '../user/userInputs';
import type { MatchPreferences } from '../matching';
import type { EditableSessionPlan } from '../segmentation';

export const SCHEMA_VERSION = 1;

export interface SectionMeta {
  /** ISO timestamp de la última modificación de esta sección. */
  updatedAt: string;
}

/**
 * Sesión indoor guardada por el usuario para reusarla. Distinta de las
 * plantillas built-in (`SessionTemplate`): aquellas son inmutables,
 * éstas viven solo en el almacenamiento del usuario.
 */
export interface SavedSession {
  /** UUID v4. Estable a lo largo del ciclo de vida del item. */
  id: string;
  name: string;
  description?: string;
  plan: EditableSessionPlan;
  createdAt: string;
  updatedAt: string;
  /**
   * ISO timestamp de borrado lógico. Cuando está presente, el item es
   * un tombstone: la UI lo oculta pero el merge sigue propagándolo a
   * otros dispositivos hasta que expire (30 días → cleanup automático).
   */
  deletedAt?: string;
}

/**
 * El blob completo que se persiste en localStorage y se sincroniza con
 * Drive. Cada sección tiene su propio meta para LWW granular.
 */
export interface SyncedData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** ISO timestamp del documento entero (max de los _sectionMeta). */
  updatedAt: string;
  _sectionMeta: {
    userInputs?: SectionMeta;
    musicPreferences?: SectionMeta;
    savedSessions?: SectionMeta;
  };
  userInputs: UserInputsRaw | null;
  musicPreferences: MatchPreferences | null;
  savedSessions: SavedSession[];
}

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'token_expired'
  | 'error';
```

- [ ] **Step 2: Schema helpers (empty data, version check)**

Archivo nuevo `src/core/sync/schema.ts`:

```typescript
import { SCHEMA_VERSION, type SyncedData } from './types';

export function emptySyncedData(): SyncedData {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    _sectionMeta: {},
    userInputs: null,
    musicPreferences: null,
    savedSessions: [],
  };
}

export function isSyncedData(value: unknown): value is SyncedData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schemaVersion'] === SCHEMA_VERSION &&
    typeof v['updatedAt'] === 'string' &&
    typeof v['_sectionMeta'] === 'object' &&
    v['_sectionMeta'] !== null &&
    Array.isArray(v['savedSessions'])
  );
}
```

- [ ] **Step 3: Verificar tsc**

Run: `pnpm typecheck`
Expected: PASS sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/core/sync/types.ts src/core/sync/schema.ts
git commit -m "feat(sync): tipos SyncedData y schema helpers"
```

---

## Task 2: Merge engine — atomic LWW + tests

**Files:**
- Create: `src/core/sync/merge.ts`
- Test: `src/core/sync/merge.test.ts`

- [ ] **Step 1: Test fallido — atomic LWW elige el lado más reciente**

Archivo nuevo `src/core/sync/merge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mergeData } from './merge';
import { emptySyncedData } from './schema';
import type { SyncedData } from './types';

function dataWith(section: 'userInputs' | 'musicPreferences', value: unknown, ts: string): SyncedData {
  const d = emptySyncedData();
  // @ts-expect-error tests usan unknown a propósito
  d[section] = value;
  d._sectionMeta[section] = { updatedAt: ts };
  d.updatedAt = ts;
  return d;
}

describe('mergeData — atomic LWW por sección', () => {
  it('local más reciente gana en userInputs', () => {
    const local = dataWith('userInputs', { weightKg: 70 }, '2026-04-29T10:00:00Z');
    const remote = dataWith('userInputs', { weightKg: 65 }, '2026-04-29T09:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs).toEqual({ weightKg: 70 });
  });

  it('remote más reciente gana en userInputs', () => {
    const local = dataWith('userInputs', { weightKg: 70 }, '2026-04-29T09:00:00Z');
    const remote = dataWith('userInputs', { weightKg: 65 }, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs).toEqual({ weightKg: 65 });
  });

  it('en empate exacto wins remote', () => {
    const ts = '2026-04-29T10:00:00Z';
    const local = dataWith('userInputs', { weightKg: 70 }, ts);
    const remote = dataWith('userInputs', { weightKg: 65 }, ts);
    const { merged, conflicts } = mergeData(local, remote);
    expect(merged.userInputs).toEqual({ weightKg: 65 });
    expect(conflicts).toHaveLength(1);
  });

  it('sección sin meta en un lado wins el otro', () => {
    const local = emptySyncedData();
    const remote = dataWith('userInputs', { weightKg: 65 }, '2026-04-29T10:00:00Z');
    const { merged } = mergeData(local, remote);
    expect(merged.userInputs).toEqual({ weightKg: 65 });
  });
});
```

- [ ] **Step 2: Run para confirmar fallo**

Run: `pnpm test:run src/core/sync/merge.test.ts`
Expected: FAIL — `Cannot find module './merge'`.

- [ ] **Step 3: Implementar merge atomic LWW**

Archivo nuevo `src/core/sync/merge.ts`:

```typescript
import type { SyncedData } from './types';
import { emptySyncedData } from './schema';

export interface MergeConflict {
  section: string;
  loserValue: unknown;
  loserTimestamp: string;
  winnerTimestamp: string;
  resolvedAt: string;
}

export interface MergeResult {
  merged: SyncedData;
  conflicts: MergeConflict[];
}

const ATOMIC_SECTIONS = ['userInputs', 'musicPreferences'] as const;
type AtomicSection = (typeof ATOMIC_SECTIONS)[number];

function getMetaTime(data: SyncedData, section: AtomicSection): number {
  const meta = data._sectionMeta[section];
  if (!meta) return -Infinity;
  return new Date(meta.updatedAt).getTime();
}

export function mergeData(local: SyncedData, remote: SyncedData): MergeResult {
  const merged: SyncedData = emptySyncedData();
  const conflicts: MergeConflict[] = [];

  // Atomic LWW por sección
  for (const section of ATOMIC_SECTIONS) {
    const localTime = getMetaTime(local, section);
    const remoteTime = getMetaTime(remote, section);

    if (localTime > remoteTime) {
      merged[section] = local[section] as never;
      merged._sectionMeta[section] = local._sectionMeta[section];
    } else {
      merged[section] = remote[section] as never;
      merged._sectionMeta[section] = remote._sectionMeta[section];
      // En empate, remote gana → si local tenía valor distinto, es conflicto
      if (localTime === remoteTime && localTime !== -Infinity) {
        const lv = local[section];
        const rv = remote[section];
        if (JSON.stringify(lv) !== JSON.stringify(rv)) {
          conflicts.push({
            section,
            loserValue: lv,
            loserTimestamp: local._sectionMeta[section]!.updatedAt,
            winnerTimestamp: remote._sectionMeta[section]!.updatedAt,
            resolvedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // savedSessions se implementa en Task 3 (este paso solo cubre atomic)
  merged.savedSessions = remote.savedSessions ?? [];
  if (remote._sectionMeta.savedSessions) {
    merged._sectionMeta.savedSessions = remote._sectionMeta.savedSessions;
  }

  // updatedAt = max de los meta de secciones
  const allTimes = Object.values(merged._sectionMeta)
    .filter((m): m is { updatedAt: string } => !!m)
    .map((m) => new Date(m.updatedAt).getTime());
  merged.updatedAt = allTimes.length
    ? new Date(Math.max(...allTimes)).toISOString()
    : new Date(0).toISOString();

  return { merged, conflicts };
}
```

- [ ] **Step 4: Run hasta verde**

Run: `pnpm test:run src/core/sync/merge.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/merge.ts src/core/sync/merge.test.ts
git commit -m "feat(sync): merge engine atomic LWW por sección con tests"
```

---

## Task 3: Merge engine — array merge por id + tombstones

**Files:**
- Modify: `src/core/sync/merge.ts`
- Modify: `src/core/sync/merge.test.ts`
- Create: `src/core/sync/tombstones.ts`
- Test: `src/core/sync/tombstones.test.ts`

- [ ] **Step 1: Tests fallidos — array merge por id**

Append a `src/core/sync/merge.test.ts`:

```typescript
import type { SavedSession } from './types';

function session(id: string, name: string, updatedAt: string, deletedAt?: string): SavedSession {
  const s: SavedSession = {
    id,
    name,
    plan: { name, items: [] },
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt,
  };
  if (deletedAt) s.deletedAt = deletedAt;
  return s;
}

describe('mergeData — savedSessions array merge', () => {
  it('unión: items presentes en cualquiera de los dos lados aparecen en merged', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    local._sectionMeta.savedSessions = { updatedAt: '2026-04-29T10:00:00Z' };
    const remote = emptySyncedData();
    remote.savedSessions = [session('b', 'B', '2026-04-29T11:00:00Z')];
    remote._sectionMeta.savedSessions = { updatedAt: '2026-04-29T11:00:00Z' };

    const { merged } = mergeData(local, remote);
    const ids = merged.savedSessions.map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('item con mismo id: LWW por updatedAt del item', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A-local', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [session('a', 'A-remote', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.name).toBe('A-remote');
  });

  it('tombstone gana sobre versión sin borrar si su timestamp es mayor', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T10:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBe('2026-04-29T11:00:00Z');
  });

  it('item resuscitado: versión sin deletedAt más reciente que tombstone gana', () => {
    const local = emptySyncedData();
    local.savedSessions = [session('a', 'A', '2026-04-29T12:00:00Z')];
    const remote = emptySyncedData();
    remote.savedSessions = [session('a', 'A', '2026-04-29T11:00:00Z', '2026-04-29T11:00:00Z')];
    const { merged } = mergeData(local, remote);
    expect(merged.savedSessions[0]?.deletedAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run para confirmar fallo**

Run: `pnpm test:run src/core/sync/merge.test.ts`
Expected: 4 PASS (atomic) + 4 FAIL (array merge nuevos).

- [ ] **Step 3: Implementar array merge en `merge.ts`**

Reemplazar la línea `merged.savedSessions = remote.savedSessions ?? [];` y siguientes en `merge.ts` por:

```typescript
  // Array merge por id, LWW por item
  const byId = new Map<string, SavedSession>();
  for (const item of local.savedSessions ?? []) byId.set(item.id, item);
  for (const remoteItem of remote.savedSessions ?? []) {
    const localItem = byId.get(remoteItem.id);
    if (!localItem) {
      byId.set(remoteItem.id, remoteItem);
      continue;
    }
    const localTime = new Date(localItem.updatedAt).getTime();
    const remoteTime = new Date(remoteItem.updatedAt).getTime();
    byId.set(remoteItem.id, remoteTime >= localTime ? remoteItem : localItem);
  }
  merged.savedSessions = Array.from(byId.values());

  // Meta de la sección: max de los item.updatedAt
  const sessionTimes = merged.savedSessions
    .map((s) => new Date(s.updatedAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (sessionTimes.length > 0) {
    merged._sectionMeta.savedSessions = {
      updatedAt: new Date(Math.max(...sessionTimes)).toISOString(),
    };
  }
```

Necesitará `import type { SavedSession } from './types';` arriba.

- [ ] **Step 4: Run hasta verde**

Run: `pnpm test:run src/core/sync/merge.test.ts`
Expected: 8 PASS.

- [ ] **Step 5: Tombstone cleanup utility**

Archivo nuevo `src/core/sync/tombstones.ts`:

```typescript
import type { SyncedData } from './types';

const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Elimina tombstones (`deletedAt` más antiguos que TOMBSTONE_MAX_AGE_MS)
 * del array savedSessions. Devuelve un nuevo objeto si hubo cambios, el
 * mismo si no.
 */
export function cleanExpiredTombstones(data: SyncedData, now: number = Date.now()): SyncedData {
  const cutoff = now - TOMBSTONE_MAX_AGE_MS;
  const filtered = data.savedSessions.filter((s) => {
    if (!s.deletedAt) return true;
    return new Date(s.deletedAt).getTime() > cutoff;
  });
  if (filtered.length === data.savedSessions.length) return data;
  return { ...data, savedSessions: filtered };
}
```

Tests en `src/core/sync/tombstones.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cleanExpiredTombstones } from './tombstones';
import { emptySyncedData } from './schema';
import type { SavedSession } from './types';

describe('cleanExpiredTombstones', () => {
  it('quita tombstones con deletedAt mayor a 30 días', () => {
    const data = emptySyncedData();
    const now = new Date('2026-04-29T00:00:00Z').getTime();
    const old: SavedSession = {
      id: 'old',
      name: 'old',
      plan: { name: 'old', items: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      deletedAt: '2026-01-01T00:00:00Z',
    };
    const recent: SavedSession = {
      id: 'recent',
      name: 'recent',
      plan: { name: 'recent', items: [] },
      createdAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      deletedAt: '2026-04-20T00:00:00Z',
    };
    data.savedSessions = [old, recent];
    const cleaned = cleanExpiredTombstones(data, now);
    expect(cleaned.savedSessions.map((s) => s.id)).toEqual(['recent']);
  });

  it('preserva items vivos', () => {
    const data = emptySyncedData();
    const live: SavedSession = {
      id: 'live',
      name: 'live',
      plan: { name: 'live', items: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    data.savedSessions = [live];
    const cleaned = cleanExpiredTombstones(data, Date.now());
    expect(cleaned.savedSessions).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run tombstones tests hasta verde**

Run: `pnpm test:run src/core/sync/tombstones.test.ts`
Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/sync/merge.ts src/core/sync/merge.test.ts src/core/sync/tombstones.ts src/core/sync/tombstones.test.ts
git commit -m "feat(sync): array merge por id + tombstones con expiry 30 días"
```

---

## Task 4: Richness check (anti-regresión)

**Files:**
- Create: `src/core/sync/richness.ts`
- Test: `src/core/sync/richness.test.ts`

- [ ] **Step 1: Tests fallidos**

Archivo nuevo `src/core/sync/richness.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDataRichness, isEmptyData } from './richness';
import { emptySyncedData } from './schema';
import type { SavedSession } from './types';

describe('isEmptyData', () => {
  it('true para emptySyncedData', () => {
    expect(isEmptyData(emptySyncedData())).toBe(true);
  });

  it('false si hay userInputs', () => {
    const d = emptySyncedData();
    d.userInputs = { weightKg: 70, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null };
    expect(isEmptyData(d)).toBe(false);
  });

  it('false si hay savedSessions vivas', () => {
    const d = emptySyncedData();
    const s: SavedSession = { id: 'a', name: 'A', plan: { name: 'A', items: [] }, createdAt: '', updatedAt: '' };
    d.savedSessions = [s];
    expect(isEmptyData(d)).toBe(false);
  });

  it('true si savedSessions solo tiene tombstones', () => {
    const d = emptySyncedData();
    const s: SavedSession = { id: 'a', name: 'A', plan: { name: 'A', items: [] }, createdAt: '', updatedAt: '', deletedAt: '2026-04-29T00:00:00Z' };
    d.savedSessions = [s];
    expect(isEmptyData(d)).toBe(true);
  });
});

describe('calculateDataRichness', () => {
  it('0 para empty', () => {
    expect(calculateDataRichness(emptySyncedData())).toBe(0);
  });

  it('cuenta secciones no vacías', () => {
    const d = emptySyncedData();
    d.userInputs = { weightKg: 70, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null };
    const s: SavedSession = { id: 'a', name: 'A', plan: { name: 'A', items: [] }, createdAt: '', updatedAt: '' };
    d.savedSessions = [s];
    expect(calculateDataRichness(d)).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Implementar**

Archivo nuevo `src/core/sync/richness.ts`:

```typescript
import type { SyncedData } from './types';

/**
 * Métrica simple: cuántas "unidades" de información tiene el blob. Se usa
 * en pull/push para detectar regresiones (ej: instalación recién hecha
 * mete localStorage vacío sobre Drive con datos → si remote es mucho más
 * rico que local, asumimos que local está stale y aplicamos remote).
 */
export function calculateDataRichness(data: SyncedData): number {
  let score = 0;
  if (data.userInputs) {
    score += Object.values(data.userInputs).filter((v) => v !== null && v !== undefined).length;
  }
  if (data.musicPreferences) {
    score += Object.keys(data.musicPreferences).length;
  }
  score += data.savedSessions.filter((s) => !s.deletedAt).length;
  return score;
}

export function isEmptyData(data: SyncedData): boolean {
  return calculateDataRichness(data) === 0;
}
```

- [ ] **Step 3: Run hasta verde**

Run: `pnpm test:run src/core/sync/richness.test.ts`
Expected: 6 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/sync/richness.ts src/core/sync/richness.test.ts
git commit -m "feat(sync): calculateDataRichness + isEmptyData para anti-regresión"
```

---

## Task 5: cadenciaStore — single source of truth en localStorage

**Files:**
- Create: `src/ui/state/cadenciaStore.ts`
- Test: `src/ui/state/cadenciaStore.test.ts`

- [ ] **Step 1: Tests fallidos**

Archivo nuevo `src/ui/state/cadenciaStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCadenciaData, saveCadenciaData, clearCadenciaData, updateSection } from './cadenciaStore';
import { isEmptyData } from '@core/sync/richness';

describe('cadenciaStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadCadenciaData devuelve empty si no hay nada', () => {
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });

  it('saveCadenciaData persiste en localStorage', () => {
    const data = loadCadenciaData();
    data.userInputs = { weightKg: 70, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null };
    data._sectionMeta.userInputs = { updatedAt: '2026-04-29T10:00:00Z' };
    saveCadenciaData(data);
    const reloaded = loadCadenciaData();
    expect(reloaded.userInputs?.weightKg).toBe(70);
  });

  it('updateSection bumpea _sectionMeta.updatedAt', () => {
    const before = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    updateSection('userInputs', { weightKg: 65, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null });
    const after = loadCadenciaData()._sectionMeta.userInputs?.updatedAt;
    expect(after).not.toBe(before);
    expect(after).toBeTruthy();
  });

  it('updateSection dispara evento cadencia-data-saved', () => {
    const handler = vi.fn();
    window.addEventListener('cadencia-data-saved', handler);
    updateSection('userInputs', { weightKg: 70, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null });
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('cadencia-data-saved', handler);
  });

  it('clearCadenciaData borra localStorage', () => {
    updateSection('userInputs', { weightKg: 70, ftpWatts: null, maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null });
    clearCadenciaData();
    expect(isEmptyData(loadCadenciaData())).toBe(true);
  });
});
```

- [ ] **Step 2: Implementar**

Archivo nuevo `src/ui/state/cadenciaStore.ts`:

```typescript
import { emptySyncedData, isSyncedData } from '@core/sync/schema';
import type { SyncedData } from '@core/sync/types';

const STORAGE_KEY = 'cadencia:data:v1';

/**
 * Single source of truth de los datos del usuario en localStorage.
 *
 * Estos datos sobreviven al cierre de pestaña y, si el usuario conecta
 * Google Drive, se sincronizan entre dispositivos. La presencia de Drive
 * NO es requisito: la app funciona idéntica solo con localStorage.
 *
 * El motor de Drive sync escucha el evento 'cadencia-data-saved' que se
 * dispara al final de updateSection / saveCadenciaData.
 */
export function loadCadenciaData(): SyncedData {
  try {
    if (typeof localStorage === 'undefined') return emptySyncedData();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptySyncedData();
    const parsed: unknown = JSON.parse(raw);
    if (!isSyncedData(parsed)) return emptySyncedData();
    return parsed;
  } catch {
    return emptySyncedData();
  }
}

export function saveCadenciaData(data: SyncedData): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('cadencia-data-saved', { detail: { data } }));
  } catch {
    // ignore (cuota, modo privado)
  }
}

export function clearCadenciaData(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cadencia-data-saved', { detail: { data: emptySyncedData() } }));
  } catch {
    // ignore
  }
}

type AtomicSectionKey = 'userInputs' | 'musicPreferences';

export function updateSection<K extends AtomicSectionKey>(
  section: K,
  value: SyncedData[K],
): void {
  const data = loadCadenciaData();
  const now = new Date().toISOString();
  data[section] = value;
  data._sectionMeta[section] = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}
```

- [ ] **Step 3: Run hasta verde**

Run: `pnpm test:run src/ui/state/cadenciaStore.test.ts`
Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/state/cadenciaStore.ts src/ui/state/cadenciaStore.test.ts
git commit -m "feat(state): cadenciaStore — localStorage single source of truth"
```

---

## Task 6: Migración de userInputs y musicPreferences al cadenciaStore

**Files:**
- Modify: `src/core/user/storage.ts`
- Modify: `src/ui/state/wizardStorage.ts`
- Modify: `src/ui/state/userInputsReducer.ts` (donde haya `saveUserInputs`)
- Modify: `App.tsx` (donde se hace dispatch de music preferences)

- [ ] **Step 1: Localizar callers actuales**

Run: `grep -rn "saveUserInputs\|saveWizardState" src/`

- [ ] **Step 2: Modificar `src/core/user/storage.ts` para escribir vía cadenciaStore**

Añadir al final de `storage.ts`:

```typescript
import { loadCadenciaData, updateSection } from '@ui/state/cadenciaStore';

/**
 * Escribe userInputs en el cadenciaStore (localStorage primary). Sigue
 * actualizando sessionStorage para que el OAuth de Spotify sobreviva.
 *
 * Reemplaza progresivamente a saveUserInputs(inputs, persistent): el flag
 * `persistent` deja de ser opcional — la app SIEMPRE persiste en
 * localStorage ahora (mejora UX: no rellenar datos al volver). Si el
 * usuario quiere "olvidarme", llama a clearAllUserInputs.
 */
export function saveUserInputsAuthoritative(inputs: UserInputsRaw): void {
  saveUserInputsToSession(inputs);
  updateSection('userInputs', inputs);
}

export function loadUserInputsAuthoritative(): UserInputsRaw | null {
  const fromCadencia = loadCadenciaData().userInputs;
  if (fromCadencia !== null) return fromCadencia;
  return loadUserInputsFromSession();
}
```

- [ ] **Step 3: Migración one-shot al cargar la app**

Crear `src/ui/state/migrateLegacyStorage.ts`:

```typescript
import { loadUserInputsFromLocal, clearUserInputsFromLocal } from '@core/user/storage';
import { loadCadenciaData, updateSection } from './cadenciaStore';

/**
 * Migración one-shot del storage legacy:
 *   - vatios:userInputs:persistent:v1 (opt-in localStorage previo) → cadencia:data:v1.userInputs
 *
 * Se ejecuta una sola vez al primer arranque tras el deploy. Idempotente:
 * si cadencia:data:v1 ya tiene userInputs, no toca nada.
 */
export function migrateLegacyStorageOnce(): void {
  const cadencia = loadCadenciaData();
  if (cadencia.userInputs !== null) return;
  const legacy = loadUserInputsFromLocal();
  if (legacy === null) return;
  updateSection('userInputs', legacy);
  clearUserInputsFromLocal();
  console.log('[Cadencia] Migrado userInputs legacy → cadenciaStore');
}
```

Llamarla en `src/main.tsx` antes del `createRoot`:

```typescript
import { migrateLegacyStorageOnce } from '@ui/state/migrateLegacyStorage';

migrateLegacyStorageOnce();
// ... createRoot existente
```

- [ ] **Step 4: musicPreferences — sacarlo de wizardStorage**

En `wizardStorage.ts`, mantener `musicPreferences` en `WizardState` pero **al guardar** propagar a cadenciaStore. El más limpio: en `App.tsx` o donde se hace `dispatch({ type: 'SET_MUSIC_PREFERENCES', ... })`, justo después llamar `updateSection('musicPreferences', preferences)`.

Localizar el caller con `grep -n "musicPreferences" src/App.tsx` y añadir al lado de `saveWizardState`:

```typescript
import { updateSection } from '@ui/state/cadenciaStore';
// ... cuando cambien preferences:
updateSection('musicPreferences', state.musicPreferences);
```

Y al hidratar el state inicial, leer de cadenciaStore primero:

```typescript
import { loadCadenciaData } from '@ui/state/cadenciaStore';
const initialPreferences = loadCadenciaData().musicPreferences ?? defaultMusicPreferences;
```

- [ ] **Step 5: Verificar no rompe nada**

Run: `pnpm typecheck && pnpm test:run`
Expected: PASS.

- [ ] **Step 6: Probar manual con dev server**

Run: `pnpm dev`. Abrir `http://127.0.0.1:5173`. Rellenar datos, refrescar la pestaña. Los datos siguen ahí. Cerrar y reabrir el navegador. Los datos siguen ahí.

- [ ] **Step 7: Commit**

```bash
git add src/core/user/storage.ts src/ui/state/migrateLegacyStorage.ts src/ui/state/wizardStorage.ts src/main.tsx src/App.tsx
git commit -m "feat(state): userInputs y musicPreferences en cadenciaStore (localStorage primary)"
```

---

## Task 7: SavedSession CRUD module (Fase 2 base)

**Files:**
- Create: `src/core/sessions/saved.ts`
- Test: `src/core/sessions/saved.test.ts`

- [ ] **Step 1: Tests fallidos**

Archivo nuevo `src/core/sessions/saved.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createSavedSession, listSavedSessions, getSavedSession, updateSavedSession, deleteSavedSession } from './saved';
import { clearCadenciaData } from '@ui/state/cadenciaStore';
import type { EditableSessionPlan } from '@core/segmentation';

const planA: EditableSessionPlan = { name: 'A', items: [] };

describe('savedSessions CRUD', () => {
  beforeEach(() => clearCadenciaData());

  it('createSavedSession devuelve un id válido y lo persiste', () => {
    const created = createSavedSession({ name: 'Mi Noruego', plan: planA });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(listSavedSessions()).toHaveLength(1);
  });

  it('listSavedSessions oculta tombstones', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    expect(listSavedSessions()).toHaveLength(0);
  });

  it('getSavedSession devuelve null para tombstones', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    expect(getSavedSession(a.id)).toBeNull();
  });

  it('updateSavedSession bumpea updatedAt', async () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    await new Promise((r) => setTimeout(r, 10));
    updateSavedSession(a.id, { name: 'A2' });
    const after = getSavedSession(a.id);
    expect(after?.name).toBe('A2');
    expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(new Date(a.updatedAt).getTime());
  });

  it('deleteSavedSession deja tombstone (no borra el item)', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    // Inspeccionar el storage crudo para confirmar tombstone
    const raw = localStorage.getItem('cadencia:data:v1');
    expect(raw).toContain('deletedAt');
  });
});
```

- [ ] **Step 2: Implementar**

Archivo nuevo `src/core/sessions/saved.ts`:

```typescript
import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import type { SavedSession } from '@core/sync/types';
import type { EditableSessionPlan } from '@core/segmentation';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback determinista solo para tests jsdom muy antiguos
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface CreateInput {
  name: string;
  description?: string;
  plan: EditableSessionPlan;
}

export function createSavedSession(input: CreateInput): SavedSession {
  const now = new Date().toISOString();
  const session: SavedSession = {
    id: uuid(),
    name: input.name,
    plan: input.plan,
    createdAt: now,
    updatedAt: now,
  };
  if (input.description !== undefined) session.description = input.description;

  const data = loadCadenciaData();
  data.savedSessions = [...data.savedSessions, session];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return session;
}

export function listSavedSessions(): SavedSession[] {
  return loadCadenciaData()
    .savedSessions
    .filter((s) => !s.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedSession(id: string): SavedSession | null {
  const found = loadCadenciaData().savedSessions.find((s) => s.id === id);
  if (!found || found.deletedAt) return null;
  return found;
}

interface UpdateInput {
  name?: string;
  description?: string;
  plan?: EditableSessionPlan;
}

export function updateSavedSession(id: string, patch: UpdateInput): SavedSession | null {
  const data = loadCadenciaData();
  const idx = data.savedSessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const current = data.savedSessions[idx]!;
  const updated: SavedSession = {
    ...current,
    ...patch,
    updatedAt: now,
  };
  data.savedSessions = [
    ...data.savedSessions.slice(0, idx),
    updated,
    ...data.savedSessions.slice(idx + 1),
  ];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
  return updated;
}

export function deleteSavedSession(id: string): void {
  const data = loadCadenciaData();
  const idx = data.savedSessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  const tombstone: SavedSession = {
    ...data.savedSessions[idx]!,
    deletedAt: now,
    updatedAt: now,
  };
  data.savedSessions = [
    ...data.savedSessions.slice(0, idx),
    tombstone,
    ...data.savedSessions.slice(idx + 1),
  ];
  data._sectionMeta.savedSessions = { updatedAt: now };
  data.updatedAt = now;
  saveCadenciaData(data);
}
```

- [ ] **Step 3: Run hasta verde**

Run: `pnpm test:run src/core/sessions/saved.test.ts`
Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/saved.ts src/core/sessions/saved.test.ts
git commit -m "feat(sessions): SavedSession CRUD con tombstones"
```

---

## Task 8: Drive integrations — config + auth

**Files:**
- Create: `src/integrations/gdrive/config.ts`
- Create: `src/integrations/gdrive/auth.ts`
- Modify: `index.html`
- Modify: `.env.example`

- [ ] **Step 1: index.html — cargar Google Identity Services**

En `index.html`, justo antes de `</head>`:

```html
    <script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: .env.example — añadir Client ID**

Añadir al final de `.env.example`:

```
# Google Drive sync (opcional). Crear en https://console.cloud.google.com/
# OAuth consent screen → External, scopes: drive.appdata.
# Authorized redirect URIs: http://127.0.0.1:5173, https://cadencia.movimientofuncional.app
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 3: config.ts**

Archivo nuevo `src/integrations/gdrive/config.ts`:

```typescript
export const GDRIVE_CONFIG = {
  /** Scope mínimo: solo carpeta oculta de la app, invisible en Drive del usuario. */
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  /** Nombre del archivo en appDataFolder. */
  FILE_NAME: 'cadencia_data.json',
  /** Client ID web inyectado por Vite desde .env.local */
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  /** API endpoints */
  API_FILES: 'https://www.googleapis.com/drive/v3/files',
  API_UPLOAD: 'https://www.googleapis.com/upload/drive/v3',
  /** Timing del sync */
  DEBOUNCE_MS: 2000,
  SYNC_COOLDOWN_MS: 5000,
  POLL_INTERVAL_MS: 30000,
};

export function isConfigured(): boolean {
  return GDRIVE_CONFIG.CLIENT_ID.length > 0;
}
```

- [ ] **Step 4: auth.ts (clonado de oraculo/auth-web.js, adaptado a TS)**

Archivo nuevo `src/integrations/gdrive/auth.ts`:

```typescript
import { GDRIVE_CONFIG } from './config';

const TOKEN_KEY = 'cadencia:gdrive:token';
const TOKEN_EXPIRY_KEY = 'cadencia:gdrive:tokenExpiry';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface SignInResult {
  token: string;
  email: string;
}

function ensureGisLoaded(): void {
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no cargado. Verifica el script en index.html.');
  }
}

export async function signIn(): Promise<SignInResult> {
  return new Promise((resolve, reject) => {
    ensureGisLoaded();
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CONFIG.CLIENT_ID,
      scope: GDRIVE_CONFIG.SCOPE,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
          return;
        }
        const token = response.access_token;
        const expiresIn = response.expires_in || 3600;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
        const email = await fetchUserEmail(token);
        resolve({ token, email });
      },
      error_callback: (err) => reject(new Error(err.message ?? 'Error en autenticación')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function getTokenSilent(): Promise<string | null> {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
  if (token && Date.now() < expiry - 5 * 60 * 1000) return token;
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

export async function refreshToken(): Promise<string | null> {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && window.google?.accounts.oauth2) {
    try { window.google.accounts.oauth2.revoke(token); } catch { /* noop */ }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function silentRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    ensureGisLoaded();
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CONFIG.CLIENT_ID,
      scope: GDRIVE_CONFIG.SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        localStorage.setItem(TOKEN_KEY, response.access_token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (response.expires_in || 3600) * 1000));
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error('Silent refresh failed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function fetchUserEmail(token: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const info = (await res.json()) as { email?: string };
      return info.email ?? '';
    }
  } catch {
    // No crítico — el email es solo para mostrarlo al usuario
  }
  return '';
}
```

- [ ] **Step 5: Verificar tsc**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/gdrive/config.ts src/integrations/gdrive/auth.ts index.html .env.example
git commit -m "feat(gdrive): config + auth con Google Identity Services"
```

---

## Task 9: Drive REST API + tests

**Files:**
- Create: `src/integrations/gdrive/drive-api.ts`
- Test: `src/integrations/gdrive/drive-api.test.ts`

- [ ] **Step 1: Tests fallidos (con fetch mockeado)**

Archivo nuevo `src/integrations/gdrive/drive-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findFile, readFile, getFileMetadata, setTokenRefresher } from './drive-api';

beforeEach(() => {
  vi.restoreAllMocks();
  setTokenRefresher(null);
});

describe('drive-api', () => {
  it('findFile devuelve null si no hay archivo', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );
    const result = await findFile('token123');
    expect(result).toBeNull();
  });

  it('findFile devuelve el primer match', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ files: [{ id: 'f1', name: 'cadencia_data.json', version: '7' }] }), { status: 200 })
    );
    const result = await findFile('token123');
    expect(result?.id).toBe('f1');
    expect(result?.version).toBe('7');
  });

  it('readFile parsea JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: 1, savedSessions: [] }), { status: 200 })
    );
    const result = await readFile('token', 'fileId');
    expect(result).toMatchObject({ schemaVersion: 1 });
  });

  it('retry automático en 401 si hay token refresher', async () => {
    const refresher = vi.fn().mockResolvedValue('newToken');
    setTokenRefresher(refresher);
    let calls = 0;
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve(new Response('', { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ id: 'f1', version: '1' }), { status: 200 }));
    });
    const result = await getFileMetadata('oldToken', 'fileId');
    expect(refresher).toHaveBeenCalledOnce();
    expect(result.id).toBe('f1');
    expect(calls).toBe(2);
  });

  it('lanza error con .status si respuesta no-OK y no hay refresher', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(getFileMetadata('token', 'fileId')).rejects.toMatchObject({ status: 500 });
  });
});
```

- [ ] **Step 2: Implementar drive-api.ts**

Archivo nuevo `src/integrations/gdrive/drive-api.ts`:

```typescript
import { GDRIVE_CONFIG } from './config';
import type { SyncedData } from '@core/sync/types';

const { API_FILES, API_UPLOAD, FILE_NAME } = GDRIVE_CONFIG;

let _tokenRefresher: (() => Promise<string | null>) | null = null;

export function setTokenRefresher(fn: (() => Promise<string | null>) | null): void {
  _tokenRefresher = fn;
}

class DriveApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'DriveApiError';
  }
}

async function fetchWithAuth(
  url: string,
  options: RequestInit,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const opts: RequestInit = { ...options, headers, cache: 'no-store' };

  let res = await fetch(url, opts);

  if (res.status === 401 && _tokenRefresher) {
    const newToken = await _tokenRefresher();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...opts, headers });
    }
  }

  if (!res.ok) {
    throw new DriveApiError(`Drive API ${res.status}: ${res.statusText}`, res.status);
  }
  return res;
}

export interface DriveFileMeta {
  id: string;
  name?: string;
  version: string;
  modifiedTime?: string;
}

export async function findFile(accessToken: string): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}'`,
    fields: 'files(id,name,modifiedTime,version)',
    pageSize: '1',
  });
  const res = await fetchWithAuth(`${API_FILES}?${params}`, {}, accessToken);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files && data.files.length > 0 ? data.files[0]! : null;
}

export async function readFile(accessToken: string, fileId: string): Promise<SyncedData> {
  const res = await fetchWithAuth(`${API_FILES}/${fileId}?alt=media`, {}, accessToken);
  return res.json() as Promise<SyncedData>;
}

export async function getFileMetadata(accessToken: string, fileId: string): Promise<DriveFileMeta> {
  const res = await fetchWithAuth(
    `${API_FILES}/${fileId}?fields=id,version,modifiedTime`,
    {},
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}

const BOUNDARY = 'cadencia_drive_boundary';

function buildMultipartBody(metadata: object, data: SyncedData): string {
  return [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(data),
    `--${BOUNDARY}--`,
  ].join('\r\n');
}

export async function createFile(accessToken: string, data: SyncedData): Promise<DriveFileMeta> {
  const metadata = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
  const body = buildMultipartBody(metadata, data);
  const res = await fetchWithAuth(
    `${API_UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime,version`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}

export async function updateFile(
  accessToken: string,
  fileId: string,
  data: SyncedData,
): Promise<DriveFileMeta> {
  const metadata = { mimeType: 'application/json' };
  const body = buildMultipartBody(metadata, data);
  const res = await fetchWithAuth(
    `${API_UPLOAD}/files/${fileId}?uploadType=multipart&fields=id,modifiedTime,version`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
    accessToken,
  );
  return res.json() as Promise<DriveFileMeta>;
}
```

- [ ] **Step 3: Run tests hasta verde**

Run: `pnpm test:run src/integrations/gdrive/drive-api.test.ts`
Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/gdrive/drive-api.ts src/integrations/gdrive/drive-api.test.ts
git commit -m "feat(gdrive): REST API client v3 con retry automático en 401"
```

---

## Task 10: Sync orchestration

**Files:**
- Create: `src/integrations/gdrive/sync.ts`

- [ ] **Step 1: Implementar sync.ts (clonado de oraculo, adaptado)**

Archivo nuevo `src/integrations/gdrive/sync.ts`:

```typescript
import { GDRIVE_CONFIG } from './config';
import { signIn, signOut, getTokenSilent, refreshToken } from './auth';
import {
  setTokenRefresher,
  findFile,
  readFile,
  createFile,
  updateFile,
  getFileMetadata,
} from './drive-api';
import { mergeData } from '@core/sync/merge';
import { isEmptyData, calculateDataRichness } from '@core/sync/richness';
import { cleanExpiredTombstones } from '@core/sync/tombstones';
import { loadCadenciaData, saveCadenciaData } from '@ui/state/cadenciaStore';
import type { SyncStatus } from '@core/sync/types';

const SYNC_STATE_KEY = 'cadencia:gdrive:syncState';

interface SyncState {
  connected?: boolean;
  email?: string;
  fileId?: string;
  fileVersion?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  syncHealth?: 'healthy' | 'token_expired' | 'error';
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _syncing = false;
let _applyingRemote = false;
let _lastSyncAt = 0;
let _initialized = false;

function getSyncState(): SyncState {
  try {
    return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) ?? '{}') as SyncState;
  } catch {
    return {};
  }
}

function setSyncState(updates: Partial<SyncState>): SyncState {
  const next = { ...getSyncState(), ...updates };
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next));
  return next;
}

export function isConnected(): boolean {
  return !!getSyncState().connected;
}

export function getSyncInfo(): SyncState {
  return getSyncState();
}

function notify(status: SyncStatus): void {
  window.dispatchEvent(new CustomEvent('gdrive-sync-status', { detail: { status } }));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  setTokenRefresher(() => refreshToken());

  if (isConnected()) {
    try {
      const token = await getTokenSilent();
      if (token) {
        await pull(token);
        startPolling();
      } else {
        setSyncState({ syncHealth: 'token_expired' });
        notify('token_expired');
      }
    } catch (err) {
      console.warn('[gdrive sync] error en sync inicial:', err);
    }
  }

  window.addEventListener('cadencia-data-saved', () => {
    if (isConnected() && !_applyingRemote) debouncedPush();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isConnected() && !_syncing) {
      void checkRemote();
    }
  });
}

export async function connect(): Promise<{ email: string }> {
  const result = await signIn();
  if (!result.token) throw new Error('No se obtuvo token');
  setSyncState({ connected: true, email: result.email, connectedAt: new Date().toISOString() });
  await pull(result.token);
  startPolling();
  notify('synced');
  return { email: result.email };
}

export async function disconnect(): Promise<void> {
  stopPolling();
  await signOut();
  localStorage.removeItem(SYNC_STATE_KEY);
  notify('disconnected');
}

function startPolling(): void {
  stopPolling();
  _pollTimer = setInterval(() => void checkRemote(), GDRIVE_CONFIG.POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = null;
}

async function checkRemote(): Promise<void> {
  if (document.visibilityState === 'hidden' || _syncing || !isConnected()) return;
  const state = getSyncState();
  if (!state.fileId) return;
  _syncing = true;
  try {
    const token = await getTokenSilent();
    if (!token) {
      setSyncState({ syncHealth: 'token_expired' });
      notify('token_expired');
      return;
    }
    const meta = await getFileMetadata(token, state.fileId);
    if (meta.version !== state.fileVersion) {
      await pull(token);
      notify('synced');
    }
    _lastSyncAt = Date.now();
  } catch (err) {
    console.warn('[gdrive sync] poll error:', err);
  } finally {
    _syncing = false;
  }
}

async function pull(token: string): Promise<void> {
  const state = getSyncState();
  let file = state.fileId
    ? await getFileMetadata(token, state.fileId).catch(() => null)
    : null;
  if (!file) file = await findFile(token);
  if (!file) {
    await push(token);
    return;
  }
  setSyncState({ fileId: file.id, fileVersion: file.version });
  const remote = await readFile(token, file.id);
  const local = loadCadenciaData();

  if (isEmptyData(local) && !isEmptyData(remote)) {
    applyRemote(remote);
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
    return;
  }

  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();

  if (remoteTime > localTime) {
    if (calculateDataRichness(local) < calculateDataRichness(remote) * 0.3) {
      applyRemote(remote);
      setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
      return;
    }
    const { merged } = mergeData(local, remote);
    const cleaned = cleanExpiredTombstones(merged);
    applyRemote(cleaned);
    const result = await updateFile(token, file.id, cleaned);
    setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
  } else if (localTime > remoteTime) {
    await push(token);
  } else {
    setSyncState({ lastSyncAt: new Date().toISOString(), fileVersion: file.version });
  }
}

async function push(token: string): Promise<void> {
  const local = loadCadenciaData();
  const state = getSyncState();
  if (state.fileId) {
    const meta = await getFileMetadata(token, state.fileId).catch(() => null);
    if (meta && state.fileVersion && meta.version !== state.fileVersion) {
      await pullAndMerge(token, state.fileId);
      return;
    }
    if (meta) {
      const result = await updateFile(token, state.fileId, local);
      setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
      return;
    }
  }
  const existing = await findFile(token);
  if (existing) {
    const remote = await readFile(token, existing.id);
    const { merged } = mergeData(local, remote);
    const cleaned = cleanExpiredTombstones(merged);
    const result = await updateFile(token, existing.id, cleaned);
    applyRemote(cleaned);
    setSyncState({ fileId: result.id, fileVersion: result.version, lastSyncAt: new Date().toISOString() });
  } else {
    const result = await createFile(token, local);
    setSyncState({ fileId: result.id, fileVersion: result.version, lastSyncAt: new Date().toISOString() });
  }
}

async function pullAndMerge(token: string, fileId: string): Promise<void> {
  const remote = await readFile(token, fileId);
  const meta = await getFileMetadata(token, fileId);
  const local = loadCadenciaData();
  const { merged } = mergeData(local, remote);
  const cleaned = cleanExpiredTombstones(merged);
  applyRemote(cleaned);
  try {
    const result = await updateFile(token, fileId, cleaned);
    setSyncState({ fileVersion: result.version, lastSyncAt: new Date().toISOString() });
  } catch {
    setSyncState({ fileVersion: meta.version, lastSyncAt: new Date().toISOString() });
  }
}

function applyRemote(data: ReturnType<typeof loadCadenciaData>): void {
  _applyingRemote = true;
  saveCadenciaData(data);
  setTimeout(() => { _applyingRemote = false; }, 0);
}

function debouncedPush(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    if (_syncing) return;
    if (Date.now() - _lastSyncAt < GDRIVE_CONFIG.SYNC_COOLDOWN_MS) return;
    _syncing = true;
    try {
      const token = await getTokenSilent();
      if (!token) {
        setSyncState({ syncHealth: 'token_expired' });
        notify('token_expired');
        return;
      }
      await push(token);
      _lastSyncAt = Date.now();
      notify('synced');
    } catch (err) {
      console.warn('[gdrive sync] push error:', err);
    } finally {
      _syncing = false;
    }
  }, GDRIVE_CONFIG.DEBOUNCE_MS);
}
```

- [ ] **Step 2: Verificar tsc + tests**

Run: `pnpm typecheck && pnpm test:run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/gdrive/sync.ts
git commit -m "feat(gdrive): orquestación push/pull/poll con merge engine"
```

---

## Task 11: UI — GoogleSyncCard

**Files:**
- Create: `src/ui/components/sync/GoogleSyncCard.tsx`
- Create: `src/ui/components/sync/SyncStatusBadge.tsx`
- Modify: `src/ui/pages/EditDataPanel.tsx` (o donde haya un buen sitio en Ajustes)
- Modify: `src/main.tsx` (init del sync)

- [ ] **Step 1: SyncStatusBadge**

Archivo nuevo `src/ui/components/sync/SyncStatusBadge.tsx`:

```typescript
import { useEffect, useState } from 'react';
import type { SyncStatus } from '@core/sync/types';

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ status: SyncStatus }>).detail;
      setStatus(detail.status);
    };
    window.addEventListener('gdrive-sync-status', handler);
    return () => window.removeEventListener('gdrive-sync-status', handler);
  }, []);

  const labels: Record<SyncStatus, string> = {
    disconnected: 'No conectado',
    connecting: 'Conectando…',
    synced: 'Sincronizado',
    syncing: 'Sincronizando…',
    token_expired: 'Sesión expirada',
    error: 'Error de sincronización',
  };
  const colorClass: Record<SyncStatus, string> = {
    disconnected: 'bg-gris-100 text-gris-700',
    connecting: 'bg-tulipTree-100 text-tulipTree-800',
    synced: 'bg-turquesa-100 text-turquesa-800',
    syncing: 'bg-tulipTree-100 text-tulipTree-800',
    token_expired: 'bg-rosa-100 text-rosa-800',
    error: 'bg-rosa-100 text-rosa-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass[status]}`}>
      {labels[status]}
    </span>
  );
}
```

- [ ] **Step 2: GoogleSyncCard**

Archivo nuevo `src/ui/components/sync/GoogleSyncCard.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { connect, disconnect, isConnected, getSyncInfo, init } from '@integrations/gdrive/sync';
import { isConfigured } from '@integrations/gdrive/config';
import { SyncStatusBadge } from './SyncStatusBadge';

export function GoogleSyncCard() {
  const [connected, setConnected] = useState<boolean>(isConnected());
  const [email, setEmail] = useState<string>(getSyncInfo().email ?? '');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void init(); }, []);

  if (!isConfigured()) {
    return (
      <div className="rounded-lg border border-gris-200 bg-white p-4 text-sm text-gris-600">
        <p>Sincronización con Google Drive no configurada en este despliegue.</p>
      </div>
    );
  }

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await connect();
      setConnected(true);
      setEmail(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnect();
      setConnected(false);
      setEmail('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gris-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-gris-800">Sincronizar con Google Drive</h3>
        <SyncStatusBadge />
      </div>
      <p className="text-sm text-gris-600">
        Opcional. Tus ajustes (peso, FTP, FCmáx, preferencias musicales y sesiones guardadas)
        viajan en una carpeta privada de tu propio Drive — invisible para nosotros.
        Cadencia funciona igual sin esto.
      </p>
      {connected ? (
        <div className="space-y-2">
          <p className="text-sm text-gris-700">Conectado como <strong>{email || 'tu cuenta'}</strong>.</p>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 hover:bg-gris-50 disabled:opacity-50 min-h-[44px]"
          >
            {busy ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-turquesa-600 text-white hover:bg-turquesa-700 disabled:opacity-50 min-h-[44px]"
        >
          {busy ? 'Conectando…' : 'Conectar mi Google Drive'}
        </button>
      )}
      {error && <p className="text-sm text-rosa-700" role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Integrar GoogleSyncCard en `EditDataPanel`**

En `src/ui/pages/EditDataPanel.tsx`, importar y renderizar el componente al final del panel (debajo de los inputs):

```typescript
import { GoogleSyncCard } from '@ui/components/sync/GoogleSyncCard';
// ... dentro del JSX, al final:
<div className="mt-6 pt-6 border-t border-gris-200">
  <GoogleSyncCard />
</div>
```

- [ ] **Step 4: Init sync en main.tsx**

En `src/main.tsx`, después de `migrateLegacyStorageOnce()`:

```typescript
import { init as initGDriveSync } from '@integrations/gdrive/sync';
void initGDriveSync();
```

- [ ] **Step 5: Verificación manual**

Run: `pnpm dev`. Sin Client ID en `.env.local` → la card debe decir "no configurada". Tras meter un Client ID válido → botón "Conectar".

- [ ] **Step 6: Verificar tsc + tests**

Run: `pnpm typecheck && pnpm test:run && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/sync/ src/ui/pages/EditDataPanel.tsx src/main.tsx
git commit -m "feat(ui): GoogleSyncCard en EditDataPanel + init sync en main"
```

---

## Task 12: UI — SaveSessionDialog y MySavedSessionsTab (Fase 2)

**Files:**
- Create: `src/ui/components/session-builder/SaveSessionDialog.tsx`
- Create: `src/ui/components/session-builder/MySavedSessionsTab.tsx`
- Modify: `src/ui/components/session-builder/TemplateGallery.tsx`
- Modify: `src/ui/pages/SessionBuilder.tsx`

- [ ] **Step 1: SaveSessionDialog**

Archivo nuevo `src/ui/components/session-builder/SaveSessionDialog.tsx`:

```typescript
import { useState } from 'react';
import type { EditableSessionPlan } from '@core/segmentation';
import { createSavedSession } from '@core/sessions/saved';

interface Props {
  plan: EditableSessionPlan;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function SaveSessionDialog({ plan, onClose, onSaved }: Props) {
  const [name, setName] = useState<string>(plan.name || '');
  const [description, setDescription] = useState<string>('');
  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const created = createSavedSession({
      name: name.trim(),
      description: description.trim() || undefined,
      plan,
    });
    onSaved(created.id);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="font-display text-xl text-gris-800">Guardar como mi sesión</h2>
        <label className="block">
          <span className="text-sm text-gris-700">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2"
            placeholder="Mi Noruego de los martes"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-sm text-gris-700">Descripción (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-gris-300 px-3 py-2"
            rows={2}
          />
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-gris-300 text-gris-700 min-h-[44px]">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-md bg-turquesa-600 text-white disabled:opacity-50 min-h-[44px]"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MySavedSessionsTab**

Archivo nuevo `src/ui/components/session-builder/MySavedSessionsTab.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { listSavedSessions, deleteSavedSession } from '@core/sessions/saved';
import type { SavedSession } from '@core/sync/types';
import type { EditableSessionPlan } from '@core/segmentation';

interface Props {
  onLoad: (plan: EditableSessionPlan) => void;
}

export function MySavedSessionsTab({ onLoad }: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>(listSavedSessions());

  useEffect(() => {
    const handler = () => setSessions(listSavedSessions());
    window.addEventListener('cadencia-data-saved', handler);
    return () => window.removeEventListener('cadencia-data-saved', handler);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="text-center text-gris-600 py-8">
        <p>No tienes sesiones guardadas todavía.</p>
        <p className="text-sm mt-2">
          Construye una sesión y pulsa <strong>"Guardar como mi sesión"</strong> para reusarla luego.
        </p>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Borrar esta sesión guardada?')) return;
    deleteSavedSession(id);
    setSessions(listSavedSessions());
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sessions.map((s) => (
        <div key={s.id} className="rounded-lg border border-gris-200 p-3 bg-white">
          <h4 className="font-display text-base text-gris-800">{s.name}</h4>
          {s.description && <p className="text-sm text-gris-600 mt-1">{s.description}</p>}
          <p className="text-xs text-gris-500 mt-1">
            Guardada {new Date(s.createdAt).toLocaleDateString('es-ES')}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onLoad(s.plan)}
              className="px-3 py-1 rounded-md bg-turquesa-600 text-white text-sm min-h-[44px]"
            >
              Cargar
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="px-3 py-1 rounded-md border border-gris-300 text-gris-700 text-sm min-h-[44px]"
            >
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Integrar tab en TemplateGallery**

En `src/ui/components/session-builder/TemplateGallery.tsx`, añadir state `activeTab` con dos opciones (`'templates' | 'mine'`) y conditional render. Mostrar tabs:

```typescript
import { MySavedSessionsTab } from './MySavedSessionsTab';

// dentro del componente:
const [tab, setTab] = useState<'templates' | 'mine'>('templates');

// JSX al inicio del componente:
<div className="flex gap-2 mb-4 border-b border-gris-200">
  <button
    onClick={() => setTab('templates')}
    className={`px-4 py-2 ${tab === 'templates' ? 'border-b-2 border-turquesa-600 text-turquesa-700' : 'text-gris-600'}`}
  >
    Plantillas científicas
  </button>
  <button
    onClick={() => setTab('mine')}
    className={`px-4 py-2 ${tab === 'mine' ? 'border-b-2 border-turquesa-600 text-turquesa-700' : 'text-gris-600'}`}
  >
    Mis sesiones
  </button>
</div>
{tab === 'templates' ? (
  <>{/* JSX existente con plantillas built-in */}</>
) : (
  <MySavedSessionsTab onLoad={(plan) => onSelect({ name: plan.name, items: plan.items })} />
)}
```

(Adaptar `onSelect` a la firma exacta del componente actual.)

- [ ] **Step 4: Botón "Guardar como mi sesión" en SessionBuilder**

En `src/ui/pages/SessionBuilder.tsx`, añadir un botón al lado de los controles principales:

```typescript
import { useState } from 'react';
import { SaveSessionDialog } from '@ui/components/session-builder/SaveSessionDialog';

// state:
const [savingDialog, setSavingDialog] = useState<boolean>(false);

// JSX (junto a otros controles):
<button
  onClick={() => setSavingDialog(true)}
  disabled={editablePlan.items.length === 0}
  className="px-4 py-2 rounded-md border border-turquesa-600 text-turquesa-700 hover:bg-turquesa-50 disabled:opacity-50 min-h-[44px]"
>
  Guardar como mi sesión
</button>
{savingDialog && (
  <SaveSessionDialog
    plan={editablePlan}
    onClose={() => setSavingDialog(false)}
    onSaved={() => setSavingDialog(false)}
  />
)}
```

- [ ] **Step 5: Verificar tsc + tests + lint**

Run: `pnpm typecheck && pnpm test:run && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Probar manual**

Run: `pnpm dev`. Construir una sesión → "Guardar como mi sesión" → Volver a empezar wizard → Indoor → ver tab "Mis sesiones" con la sesión guardada → cargarla.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/session-builder/ src/ui/pages/SessionBuilder.tsx
git commit -m "feat(sessions): UI guardar/cargar sesiones del usuario en TemplateGallery"
```

---

## Task 13: Privacidad y copy de la landing

**Files:**
- Create: `public/privacidad-google.html` (sección específica)
- Modify: `src/ui/pages/Landing.tsx` (copy)

- [ ] **Step 1: Crear `public/privacidad-google.html`**

Archivo nuevo `public/privacidad-google.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cadencia — Sincronización con Google Drive</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/index.css">
</head>
<body class="bg-white text-gris-800 max-w-2xl mx-auto p-6 font-sans leading-relaxed">
  <h1 class="font-display text-3xl">Sincronización con Google Drive</h1>
  <p>Cadencia ofrece sincronización opcional con Google Drive. Esta página describe qué se sincroniza, cómo y por qué.</p>

  <h2 class="font-display text-xl mt-6">Qué se sincroniza</h2>
  <ul class="list-disc pl-6">
    <li><strong>Tus inputs fisiológicos</strong>: peso, FTP, FCmáx, FC reposo, año de nacimiento, sexo biológico.</li>
    <li><strong>Tus preferencias musicales</strong>: géneros preferidos, semilla de generación, modo "todo con energía".</li>
    <li><strong>Tus sesiones indoor guardadas</strong>: planes que has creado y guardado con un nombre.</li>
  </ul>

  <h2 class="font-display text-xl mt-6">Dónde viven los datos</h2>
  <p>En una carpeta oculta y privada de <strong>tu propio Google Drive</strong> (espacio "<code>appDataFolder</code>"). Esta carpeta es invisible para ti en la UI normal de Drive — solo Cadencia puede leer y escribir en ella, y solo en tu cuenta.</p>
  <p>Nosotros no tenemos servidores intermedios. Tus datos viajan directamente entre tu navegador y Google Drive.</p>

  <h2 class="font-display text-xl mt-6">Permisos solicitados</h2>
  <p>Cadencia solicita un único permiso OAuth: <code>https://www.googleapis.com/auth/drive.appdata</code>.</p>
  <p>Este permiso no da acceso a otros archivos de tu Drive. Solo a la carpeta privada de Cadencia.</p>

  <h2 class="font-display text-xl mt-6">Cómo desconectar</h2>
  <p>En cualquier momento puedes pulsar "Desconectar" en la sección de Ajustes. Esto revoca el token y borra la información de conexión local. Tus datos en Drive permanecen — para borrarlos completamente:</p>
  <ol class="list-decimal pl-6">
    <li>Visita <a href="https://drive.google.com/drive/u/0/settings" rel="noopener">drive.google.com/drive/u/0/settings</a>.</li>
    <li>"Administrar aplicaciones" → busca "Cadencia" → "Eliminar datos ocultos de la aplicación".</li>
  </ol>

  <h2 class="font-display text-xl mt-6">Sin Drive, también funciona</h2>
  <p>La sincronización es 100% opcional. Si nunca conectas Google Drive, todos tus datos viven solo en tu navegador (<code>localStorage</code>). La app es funcionalmente idéntica.</p>

  <p class="mt-8"><a href="/" class="text-turquesa-600 hover:underline">← Volver a Cadencia</a></p>
</body>
</html>
```

- [ ] **Step 2: Ajustar copy de la landing**

En `src/ui/pages/Landing.tsx`, donde hoy diga "sin registros", añadir matiz. Buscar el texto actual con `grep -n "registros\|Sin registros" src/ui/pages/Landing.tsx` y cambiar a algo como:

```
"Sin registros obligatorios. Funciona 100% en tu navegador. Opcional: conecta tu Google Drive si quieres llevar tus ajustes entre dispositivos — viajan en una carpeta privada tuya, nosotros nunca los vemos."
```

- [ ] **Step 3: Commit**

```bash
git add public/privacidad-google.html src/ui/pages/Landing.tsx
git commit -m "docs(privacidad): página de privacidad Google Drive + copy landing"
```

---

## Task 14: Verificación final end-to-end

- [ ] **Step 1: Pre-commit suite completo**

Run: `pnpm typecheck && pnpm lint && pnpm test:run`
Expected: 0 errores TS, 0 warnings ESLint, todos los tests verde.

- [ ] **Step 2: Build production**

Run: `pnpm build`
Expected: bundle generado en `dist/` sin errores.

- [ ] **Step 3: Verificación manual sin Client ID**

Vaciar `VITE_GOOGLE_CLIENT_ID` en `.env.local`. `pnpm dev`. Confirmar:
- App funciona idéntica.
- `EditDataPanel` muestra "Sincronización no configurada" en vez del botón.
- Datos persisten en localStorage al refrescar.
- "Mis sesiones" funciona offline.

- [ ] **Step 4: Verificación manual con Client ID** (la usuaria genera el Client ID real ahora)

La usuaria:
1. Va a https://console.cloud.google.com/apis/credentials → New Project "Cadencia".
2. OAuth consent screen → External, scope `drive.appdata`, app name "Cadencia", logo, links a privacidad-google.html, dominios autorizados.
3. Credentials → Create OAuth client ID → Web application. Authorized JS origins: `http://127.0.0.1:5173`, `https://cadencia.movimientofuncional.app`.
4. Copia Client ID a `.env.local`.

Reiniciar `pnpm dev`. Probar:
- Conectar Drive → consentir → ver "Conectado como [email]".
- Cambiar peso → esperar 5 s → recargar la pestaña → peso persiste.
- Abrir en otro navegador, conectar misma cuenta → tras pull, peso aparece.
- "Mis sesiones" guarda en navegador A → aparece en navegador B en ≤30 s (poll).
- Desconectar → comprobación local sigue intacta, Drive desvinculado.

- [ ] **Step 5: Final commit con README/docs si hace falta y tag**

```bash
git tag -a v0.x.0-gdrive-sync -m "feat: Google Drive sync Fase 1 + Fase 2"
```

(El tag puede esperar al push final.)

---

## Self-review checklist

**Cobertura del spec:**
- ✅ Sincronización userInputs (atomic LWW) — Tasks 1, 2, 5, 6
- ✅ Sincronización musicPreferences (atomic LWW) — Tasks 1, 2, 5, 6
- ✅ Saved sessions (CRUD + array merge + tombstones) — Tasks 1, 3, 7, 12
- ✅ Drive auth + REST + sync orchestration — Tasks 8, 9, 10
- ✅ UI conectar/desconectar — Task 11
- ✅ UI guardar/cargar/borrar sesiones — Task 12
- ✅ Privacidad + copy — Task 13
- ✅ Migración de storage legacy — Task 6 step 3
- ✅ Anti-regresión (richness check) — Task 4
- ✅ Tombstone cleanup automático — Task 3 step 5

**No hay placeholders.** Cada step tiene código completo.

**Consistencia de tipos verificada:** `SyncedData`, `SavedSession`, `MergeResult`, `SyncState`, `SyncStatus` consistentes a lo largo de tasks.

**Tareas que NO están en este plan (deliberadamente fuera de Fase 1+2):**
- Sync de listas de música propias (CSVs subidos) → Fase 3.
- Historial de playlists generadas → no scope.
- Edit name de SavedSession con UI → puede añadirse en Fase 2.5.
- Conflict log persistente con UI de revisión → no urgente, los conflictos son raros con LWW por sección.

---

## Backlog para estudiar — Descarte inline desde ResultStep

**Contexto:** hoy el único modo de quitar una canción del pool es ir al editor del catálogo (`CatalogEditorPage`), descartarla y descargar el CSV propio. Es un viaje largo para algo que el usuario querría hacer en 1 click cuando "A pedalear!" le saca la canción que no le gusta.

**Idea propuesta:** botón X (con confirmación) por track en `ResultStep`, que marca la canción como **descartada permanentemente** del pool del usuario. Persistencia local + sync vía Drive.

### Diseño preliminar (a refinar antes de implementar)

**Modelo de datos:** nueva sección atómica del `SyncedData` (siguiendo el patrón de `userInputs` / `musicPreferences`):

```typescript
// Añadir a SyncedData:
dismissedTracks: DismissedTrackEntry[];

interface DismissedTrackEntry {
  trackUri: string;       // identificador estable (ya único en el catálogo)
  dismissedAt: string;    // ISO timestamp
  reason?: string;        // futuro: "no me gusta" / "letra explícita" / "muy lenta"…
}
```

Estrategia de merge: **array-by-uri** (similar al array-by-id de savedSessions, sin tombstones — dejar de descartar = quitar la entrada). El union natural conserva descartes de cualquier dispositivo. Un descarte siempre gana sobre un "no descartado" porque la ausencia no se propaga en arrays.

**Reactivación**: panel "Mis descartes" (en `EditDataPanel` o sección Ajustes) listando todos los URIs descartados con botón "Restaurar". Para no hinchar la UI con cientos de canciones, paginado y/o búsqueda por título.

**Filtro en matching:** `dedupeByUri` ya filtra duplicados; añadir paso similar en `loadNativeTracks` o donde se construya el pool — un `filter(t => !dismissedSet.has(t.uri))` antes de pasar a `matchTracksToSegments`. Pool curado a la entrada, sin tocar el motor.

**UI ResultStep:** botón X pequeño (no llamativo) en cada `TrackCard` o `TrackRow`. Confirmación modal con copy explícito:

> "¿Descartar **{título}** del catálogo? No volverá a aparecer en futuras playlists. Puedes restaurarla más tarde desde Ajustes → Mis descartes."

Distinto visualmente de "Otro tema" (icono ⟳) que es local-a-este-slot. **Esto** es un icono X.

**Coste estimado:** ~250 LoC + tests. Una sesión.

### Open questions a decidir antes de codificar

1. **Granularidad temporal**: ¿"descartar siempre" o también "descartar de esta zona/profile"? (ej: "esta canción me sirve para Z3 climb pero no para Z2 flat"). Empezar con "siempre" — más simple y cubre el 90% del caso.
2. **Sustitución automática**: cuando el usuario descarta, ¿la app re-corre el matching para rellenar el slot vacío automáticamente? Probablemente sí (sería raro dejar un slot sin canción). Reusar `replaceTrackInSegment`.
3. **Sin Drive**: ¿se persiste en localStorage igual? Sí, igual que `userInputs` y `musicPreferences`: cadenciaStore es la SoT, Drive sync es opt-in. Sin Drive, los descartes viven en este navegador hasta que se "olviden mis datos".
4. **Migración**: si en el futuro alguien sube un CSV propio donde una canción descartada sale duplicada con otro URI… edge case, no urgente.

### Cuándo implementarlo

- **NO** dentro de este plan (Fase 1+2). Fuera de scope.
- Recomendado **tras** Fase 2 cerrada y verificada en navegador. La feature reusa el motor de sync ya construido sin modificarlo, así que el riesgo arquitectónico es bajo.
- Buen candidato para una "Fase 2.5" o un PR separado tras un soak de la sync básica.
